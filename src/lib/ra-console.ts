/**
 * AzerothCore Remote Administration (RA) console client.
 *
 * Protocol: raw TCP socket
 *   Connect → recv "Username:" → send username\r\n
 *   recv "Password:" → send password\r\n
 *   recv "AC>" prompt → send command\r\n → recv output until "AC>"
 *
 * Ref: azerothcore_webui/app.py:1462-1541
 */

import { createConnection } from "node:net";
import { raPort } from "./realm-compose";

async function recvUntil(
  socket: ReturnType<typeof createConnection>,
  marker: string,
  timeoutMs: number = 5000
): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    const timer = setTimeout(() => {
      socket.removeAllListeners("data");
      resolve(buf);
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8", 0, chunk.length);
      if (buf.includes(marker)) {
        clearTimeout(timer);
        socket.removeListener("data", onData);
        resolve(buf);
      }
    };

    socket.on("data", onData);
  });
}

export interface RACommandResult {
  output: string;
  error?: string;
}

/**
 * Send an RA command to a specific host:port (for remote realms or direct connections).
 */
export async function sendRACommandDirect(
  host: string,
  port: number,
  username: string,
  password: string,
  command: string
): Promise<RACommandResult> {
  return _sendRA(host, port, username, password, command);
}

export async function sendRACommand(
  realmId: number,
  username: string,
  password: string,
  command: string
): Promise<RACommandResult> {
  const host = process.env.WORLDSERVER_HOST ?? `ac-worldserver-${realmId}`;
  // Inside Docker network, RA always listens on 3443 regardless of host port mapping
  const port = process.env.WORLDSERVER_HOST ? raPort(realmId) : 3443;
  return _sendRA(host, port, username, password, command);
}

function _sendRA(
  host: string,
  port: number,
  username: string,
  password: string,
  command: string
): Promise<RACommandResult> {

  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    sock.setTimeout(5000);

    sock.on("timeout", () => {
      sock.destroy();
      resolve({ output: "", error: `Connection to ${host}:${port} timed out. Is Ra.Enable = 1?` });
    });

    sock.on("error", (err) => {
      resolve({ output: "", error: `Cannot connect to RA (${host}:${port}): ${err.message}` });
    });

    sock.on("connect", async () => {
      try {
        // Read username prompt
        await recvUntil(sock, ":");

        // Send username
        sock.write(`${username}\r\n`);
        await recvUntil(sock, ":");

        // Send password
        sock.write(`${password}\r\n`);
        const loginResp = await recvUntil(sock, "AC>", 5000);

        if (!loginResp.includes("AC>")) {
          sock.write("quit\r\n");
          sock.end();
          const errLine = loginResp.trim().split(/\r?\n/)[0] || "Login failed";
          resolve({ output: "", error: errLine });
          return;
        }

        // Send the command
        sock.write(`${command}\r\n`);
        const output = await recvUntil(sock, "AC>", 10000);

        // Cleanup
        try { sock.write("quit\r\n"); } catch { /* ignore */ }
        sock.end();

        // Strip trailing AC> prompt
        const cleaned = output.replace(/AC>\s*$/, "").trim();
        resolve({ output: cleaned });
      } catch (err) {
        sock.end();
        resolve({ output: "", error: String(err) });
      }
    });
  });
}
