import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { checkDbHealth, query, DB_REALMD } from "@/lib/db";
import { createConnection } from "node:net";
import { getContainerStatus, isCrashLoop, stopCrashedContainer } from "@/lib/docker-status";

function checkTcp(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const timer = setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, timeoutMs);
    sock.on("connect", () => {
      clearTimeout(timer);
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export async function GET() {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  const services = [];

  // Database
  const dbOk = await checkDbHealth();
  services.push({
    Service: "ac-database",
    State: dbOk ? "running" : "down",
    Status: dbOk ? "healthy" : "unreachable",
  });

  // Auth server — TCP 3724
  const authOk = await checkTcp(
    process.env.AUTHSERVER_HOST ?? "ac-authserver",
    3724
  );
  services.push({
    Service: "ac-authserver",
    State: authOk ? "running" : "down",
    Status: authOk ? "listening" : "unreachable",
  });

  // Per-realm worldservers
  let realmRows: Array<{ id: number; name: string; port: number }> = [];
  try {
    realmRows = await query<{ id: number; name: string; port: number }>(
      `SELECT id, name, port FROM ${DB_REALMD}.realmlist ORDER BY id`
    );
  } catch {
    // No realms or DB error — ignore
  }

  for (const realm of realmRows) {
    const containerName = `ac-worldserver-${realm.id}`;
    const container = await getContainerStatus(containerName);
    const wsHost = process.env.WORLDSERVER_HOST ?? containerName;
    // Inside Docker network, worldserver always listens on 8085 regardless of host port mapping
    const wsPort = process.env.WORLDSERVER_HOST ? realm.port : 8085;
    const wsOk = container.state === "running" && await checkTcp(wsHost, wsPort);

    let state = "down";
    let status = "unreachable";

    if (isCrashLoop(container)) {
      state = "crashed";
      status = `crash loop (${container.restartCount} restarts, exit ${container.exitCode})`;
      // Auto-stop crashed containers and update build state
      stopCrashedContainer(containerName).catch(() => {});
    } else if (wsOk) {
      state = "running";
      status = "listening";
    } else if (container.state === "running") {
      state = "starting";
      status = "container running, port not ready";
    } else if (container.state === "restarting") {
      state = "restarting";
      status = `restarting (${container.restartCount} restarts)`;
    } else if (container.exists) {
      state = "stopped";
      status = container.exitCode !== 0 ? `exited (code ${container.exitCode})` : "stopped";
    }

    services.push({
      Service: containerName,
      Name: realm.name,
      State: state,
      Status: status,
      realmId: realm.id,
    });
  }

  // WebUI is obviously running if this endpoint responds
  services.push({
    Service: "ac-webui",
    State: "running",
    Status: "healthy",
  });

  return NextResponse.json({ services });
}
