/**
 * In-memory build state for live build log/status polling.
 * Keyed by sourceId (not realmId) since builds are global.
 */

interface BuildState {
  status: string;
  log: string[];
  lastUpdated: number;
  sourceId: string;
  branch: string;
}

const buildState = new Map<string, BuildState>();
const buildingSet = new Set<string>();

export function initBuildState(
  sourceId: string,
  status: string,
  firstLine: string,
  branch: string
): void {
  buildState.set(sourceId, {
    status,
    log: [`[${new Date().toISOString()}] ${firstLine}`],
    lastUpdated: Date.now(),
    sourceId,
    branch,
  });
}

export function appendBuildLog(sourceId: string, line: string): void {
  const state = buildState.get(sourceId);
  if (state) {
    state.log.push(`[${new Date().toISOString()}] ${line}`);
    state.lastUpdated = Date.now();
  }
}

export function updateBuildStatus(sourceId: string, status: string): void {
  const state = buildState.get(sourceId);
  if (state) {
    state.status = status;
    state.lastUpdated = Date.now();
  }
}

export function getBuildLog(sourceId: string): { status: string; log: string[] } {
  const state = buildState.get(sourceId);
  return {
    status: state?.status ?? "idle",
    log: state?.log ?? [],
  };
}

export function getBuildStatus(sourceId: string): string {
  return buildState.get(sourceId)?.status ?? "idle";
}

export function isSourceBuilding(sourceId: string): boolean {
  return buildingSet.has(sourceId);
}

export function markBuilding(sourceId: string): void {
  buildingSet.add(sourceId);
}

export function clearBuilding(sourceId: string): void {
  buildingSet.delete(sourceId);
}
