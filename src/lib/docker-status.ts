/**
 * Check Docker container status for worldserver containers.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface ContainerStatus {
  exists: boolean;
  state: "running" | "restarting" | "exited" | "dead" | "created" | "paused" | "unknown";
  exitCode: number;
  restartCount: number;
  startedAt: string;
  error: string;
}

export async function getContainerStatus(containerName: string): Promise<ContainerStatus> {
  try {
    const { stdout } = await exec("docker", [
      "inspect",
      "--format",
      "{{.State.Status}}|{{.State.ExitCode}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.Error}}",
      containerName,
    ]);
    const parts = stdout.trim().split("|");
    return {
      exists: true,
      state: (parts[0] ?? "unknown") as ContainerStatus["state"],
      exitCode: parseInt(parts[1] ?? "0"),
      restartCount: parseInt(parts[2] ?? "0"),
      startedAt: parts[3] ?? "",
      error: parts.slice(4).join("|"),
    };
  } catch {
    return {
      exists: false,
      state: "unknown",
      exitCode: 0,
      restartCount: 0,
      startedAt: "",
      error: "",
    };
  }
}

/** Stop and remove a container that's in a crash loop. */
export async function stopCrashedContainer(containerName: string): Promise<void> {
  try {
    await exec("docker", ["stop", containerName]);
  } catch { /* already stopped */ }
  try {
    await exec("docker", ["rm", containerName]);
  } catch { /* already removed */ }
}

/** Check if container is in a crash loop (restarting with 3+ restarts). */
export function isCrashLoop(status: ContainerStatus): boolean {
  return (
    status.exists &&
    (status.state === "restarting" || (status.state === "exited" && status.exitCode !== 0) ||
      (status.state === "running" && status.restartCount >= 3)) &&
    status.restartCount >= 3
  );
}

/** Seconds to wait for a worldserver to become reachable before declaring failure. */
const STARTUP_TIMEOUT_SECS = 120;

/**
 * Check if a container has exceeded the startup timeout.
 * Returns true when the container is "running" but has been up longer than
 * STARTUP_TIMEOUT_SECS without becoming reachable (TCP check failed).
 */
export function isStartupTimedOut(status: ContainerStatus): boolean {
  if (!status.exists || status.state !== "running" || !status.startedAt)
    return false;
  const started = new Date(status.startedAt).getTime();
  if (Number.isNaN(started)) return false;
  const elapsed = (Date.now() - started) / 1000;
  return elapsed > STARTUP_TIMEOUT_SECS || status.restartCount >= 3;
}
