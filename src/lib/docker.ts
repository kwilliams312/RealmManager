/**
 * Docker compose helpers for realm lifecycle management.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { access, readdir, mkdir, writeFile, readFile } from "node:fs/promises";

const exec = promisify(execFile);

const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";

function composePath(realmId: number): string {
  return join(DATA_DIR, String(realmId), "docker-compose.yml");
}

function projectName(realmId: number): string {
  return `ac-realm-${realmId}`;
}

function composeArgs(realmId: number, ...args: string[]): string[] {
  return [
    "compose",
    "-p", projectName(realmId),
    "-f", composePath(realmId),
    ...args,
  ];
}

export async function startRealm(realmId: number): Promise<void> {
  // Clear previous startup error on new attempt
  await clearStartupError(realmId);

  try {
    await exec("docker", composeArgs(realmId, "up", "-d", `ac-worldserver-${realmId}`));
  } catch (err: unknown) {
    // Compose failed — fetch logs from containers that may have failed
    const details = await collectContainerLogs(realmId);
    const e = err as { stderr?: string; message?: string };
    const composeErr = e.stderr ?? e.message ?? String(err);

    // Persist to disk so logs survive page navigation
    await saveStartupError(realmId, composeErr, details);

    throw new Error(
      details
        ? `${composeErr}\n\n--- Container logs ---\n${details}`
        : composeErr
    );
  }
}

/** Fetch logs from db-import and worldserver containers after a start failure. */
async function collectContainerLogs(realmId: number): Promise<string> {
  const containers = [
    `ac-db-import-${realmId}`,
    `ac-worldserver-${realmId}`,
  ];
  const parts: string[] = [];
  for (const name of containers) {
    try {
      const { stdout, stderr } = await exec("docker", [
        "logs", "--tail", "100", name,
      ]);
      const output = (stdout || "") + (stderr || "");
      if (output.trim()) {
        parts.push(`[${name}]\n${output.trim()}`);
      }
    } catch {
      // Container may not exist
    }
  }
  return parts.join("\n\n");
}

function startupErrorPath(realmId: number): string {
  return join(DATA_DIR, String(realmId), "logs", "startup-error.log");
}

async function saveStartupError(
  realmId: number,
  composeErr: string,
  containerLogs: string
): Promise<void> {
  try {
    const logsDir = join(DATA_DIR, String(realmId), "logs");
    await mkdir(logsDir, { recursive: true });
    const content = `[${new Date().toISOString()}] Startup failed\n\n`
      + `--- Compose error ---\n${composeErr}\n\n`
      + `--- Container logs ---\n${containerLogs}\n`;
    await writeFile(startupErrorPath(realmId), content, "utf-8");
  } catch { /* best-effort */ }
}

async function clearStartupError(realmId: number): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(startupErrorPath(realmId));
  } catch { /* may not exist */ }
}

/** Read persisted startup error log for a realm. Returns null if none. */
export async function getStartupError(realmId: number): Promise<string | null> {
  try {
    return await readFile(startupErrorPath(realmId), "utf-8");
  } catch {
    return null;
  }
}

export async function stopRealm(realmId: number): Promise<void> {
  await exec("docker", composeArgs(realmId, "stop", `ac-worldserver-${realmId}`));
}

export async function restartRealm(realmId: number): Promise<void> {
  await exec("docker", composeArgs(realmId, "restart", `ac-worldserver-${realmId}`));
}

export async function getContainerLogs(
  realmId: number,
  tail: number = 200
): Promise<string> {
  const containerName = `ac-worldserver-${realmId}`;
  try {
    const { stdout } = await exec("docker", [
      "logs",
      "--tail", String(tail),
      "--timestamps",
      containerName,
    ]);
    return stdout;
  } catch (err: unknown) {
    // docker logs writes to stderr for TTY containers
    const e = err as { stderr?: string; stdout?: string };
    return e.stderr ?? e.stdout ?? String(err);
  }
}

/**
 * Ensure a realm's etc/ directory has config files before starting.
 * Extracts from the build image if worldserver.conf is missing.
 * @param refConfigPath — source-specific path to reference config in the image
 */
export async function ensureRealmConfig(
  realmId: number,
  imageTag: string,
  refConfigPath?: string
): Promise<void> {
  const hostDir = process.env.REALM_HOST_DIR ?? "./data/realms";
  const realmEtcHost = `${hostDir}/${realmId}/etc`;
  const realmEtcData = join(DATA_DIR, String(realmId), "etc");
  const refPath = refConfigPath ?? "/azerothcore/env/ref/etc";

  await mkdir(realmEtcData, { recursive: true });

  // Check if worldserver.conf already exists
  const hasConfig = await hasFile(realmEtcData, "worldserver.conf");
  if (hasConfig) return;

  // Also check for .dist file
  const hasDist = await hasFile(realmEtcData, "worldserver.conf.dist");

  if (!hasDist) {
    // Extract config files from the image directly
    await exec("docker", [
      "run", "--rm",
      "--user", "root",
      "-v", `${realmEtcHost}:/out`,
      "--entrypoint", "sh",
      imageTag,
      "-c", `cp -r ${refPath}/* /out/`,
    ]);
  }

  // Create worldserver.conf from .dist if it exists
  const hasDistNow = await hasFile(realmEtcData, "worldserver.conf.dist");
  if (hasDistNow) {
    try {
      await exec("cp", [
        "-n",
        join(realmEtcData, "worldserver.conf.dist"),
        join(realmEtcData, "worldserver.conf"),
      ]);
    } catch { /* already exists */ }
  }
}

async function hasFile(dir: string, name: string): Promise<boolean> {
  try {
    await access(join(dir, name));
    return true;
  } catch {
    return false;
  }
}
