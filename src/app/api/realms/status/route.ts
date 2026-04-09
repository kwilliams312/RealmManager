import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { query, executeDb, DB_REALMD } from "@/lib/db";
import { queryCharAuthDb, IS_BOT, IS_PLAYER, BOT_JOIN } from "@/lib/db-realm";
import { createConnection } from "node:net";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getContainerStatus, isCrashLoop, isStartupTimedOut, stopCrashedContainer } from "@/lib/docker-status";
import { getRealmRemoteConfig } from "@/lib/build-sources-db";
import { sendRACommandDirect } from "@/lib/ra-console";

function checkTcp(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const timer = setTimeout(() => { sock.destroy(); resolve(false); }, timeoutMs);
    sock.on("connect", () => { clearTimeout(timer); sock.destroy(); resolve(true); });
    sock.on("error", () => { clearTimeout(timer); resolve(false); });
  });
}

async function getVersion(): Promise<string> {
  try {
    const versionPath = process.env.VERSION_PATH ?? join(process.cwd(), "..", "VERSION");
    const text = await readFile(versionPath, "utf8");
    return text.trim();
  } catch {
    return "unknown";
  }
}

export async function GET() {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  const version = await getVersion();

  let realmRows: Array<{ id: number; name: string; address: string; localAddress: string; port: number; flag: number }> = [];
  try {
    realmRows = await query<{ id: number; name: string; address: string; localAddress: string; port: number; flag: number }>(
      `SELECT id, name, address, localAddress, port, flag FROM ${DB_REALMD}.realmlist ORDER BY id`
    );
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const worldserverHost = process.env.WORLDSERVER_HOST ?? "";

  const realms = await Promise.all(
    realmRows.map(async (r) => {
      const remoteConfig = await getRealmRemoteConfig(r.id);

      let online = false;
      let state: "running" | "starting" | "stopped" | "crashed" = "stopped";
      let charStats = { players_online: 0, bots_online: 0, total_characters: 0, bot_characters: 0 };

      if (remoteConfig.isRemote) {
        // Remote realm: TCP check against the actual remote address:port
        online = await checkTcp(r.address, r.port);
        if (online) state = "running";

        // Best-effort RA stats query for player count
        if (online && remoteConfig.raHost && remoteConfig.raUser) {
          try {
            const raResult = await sendRACommandDirect(
              remoteConfig.raHost,
              remoteConfig.raPort ?? 3443,
              remoteConfig.raUser,
              remoteConfig.raPass ?? "",
              ".server info"
            );
            if (raResult.output) {
              // Parse "Players online: N" from .server info output
              const match = raResult.output.match(/Players? online:\s*(\d+)/i);
              if (match) charStats.players_online = parseInt(match[1]);
            }
          } catch {
            // RA unavailable — just show online/offline
          }
        }
      } else {
        // Local realm: Docker container check
        const containerName = `ac-worldserver-${r.id}`;
        const container = await getContainerStatus(containerName);
        const checkHost = worldserverHost || containerName;
        const checkPort = worldserverHost ? r.port : 8085;
        online = container.state === "running" && await checkTcp(checkHost, checkPort);

        if (isCrashLoop(container)) {
          stopCrashedContainer(containerName).catch(() => {});
        }

        // Character stats from local DB
        try {
          const rows = await queryCharAuthDb<Record<string, number | null>>(
            r.id,
            `SELECT
              SUM(CASE WHEN ${IS_PLAYER} THEN 1 ELSE 0 END) AS player_total,
              SUM(CASE WHEN ${IS_PLAYER} AND c.online = 1 THEN 1 ELSE 0 END) AS players_online,
              SUM(CASE WHEN ${IS_BOT} THEN 1 ELSE 0 END) AS bot_total,
              SUM(CASE WHEN ${IS_BOT} AND c.online = 1 THEN 1 ELSE 0 END) AS bots_online
             FROM characters c${BOT_JOIN}`
          );
          if (rows.length && rows[0].player_total !== null) {
            charStats = {
              total_characters: Number(rows[0].player_total ?? 0),
              players_online: Number(rows[0].players_online ?? 0),
              bot_characters: Number(rows[0].bot_total ?? 0),
              bots_online: Number(rows[0].bots_online ?? 0),
            };
          }
        } catch {
          // Character DB may not exist yet
        }

        if (online) state = "running";
        else if (container.state === "running" && isStartupTimedOut(container))
          state = "crashed";
        else if (container.state === "running") state = "starting";
        else if (container.exists && container.state === "exited" && container.exitCode !== 0)
          state = "crashed";
      }

      // Update realmlist for authserver: flag (online/offline) + population level
      const currentFlag = Number(r.flag ?? 0);
      const desiredFlag = online
        ? (currentFlag & ~0x2)  // clear offline bit
        : (currentFlag | 0x2);  // set offline bit

      const players = charStats.players_online;
      const population = players > 500 ? 2 : players > 100 ? 1 : 0;

      if (desiredFlag !== currentFlag || online) {
        executeDb(
          DB_REALMD,
          `UPDATE realmlist SET flag = ?, population = ? WHERE id = ?`,
          [desiredFlag, population, r.id]
        ).catch(() => {});
      }

      return {
        id: r.id, name: r.name, address: r.address, port: r.port,
        online, state, is_remote: remoteConfig.isRemote, ...charStats,
      };
    })
  );

  return NextResponse.json({ realms, version });
}
