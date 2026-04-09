/**
 * Global builds DB — shared Docker images built from sources.
 * Creates the table on first use if it doesn't exist.
 */

import { query, executeDb, DB_REALMD } from "./db";
import { getRealmsUsingBuild } from "./build-sources-db";

let tableCreated = false;
let orphansCleaned = false;

async function ensureTable(): Promise<void> {
  if (tableCreated) return;
  try {
    await executeDb(
      DB_REALMD,
      `CREATE TABLE IF NOT EXISTS builds (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        source_id VARCHAR(64) NOT NULL,
        image_tag VARCHAR(128) NOT NULL,
        source_branch VARCHAR(128) NOT NULL DEFAULT 'master',
        status VARCHAR(16) NOT NULL DEFAULT 'building',
        build_log MEDIUMTEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_source (source_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      []
    );
    tableCreated = true;
  } catch {
    tableCreated = true;
  }

  // Orphan cleanup: mark interrupted builds as failed (runs once on first access)
  if (!orphansCleaned) {
    orphansCleaned = true;
    try {
      await markOrphanBuilds();
    } catch { /* non-critical */ }
  }
}

export interface BuildRow {
  id: number;
  source_id: string;
  image_tag: string;
  source_branch: string;
  status: string;
  build_log: string | null;
  created_at: string;
}

export interface Build {
  id: number;
  source_id: string;
  image_tag: string;
  source_branch: string;
  status: "building" | "success" | "failed";
  build_log: string[] | null;
  created_at: string;
}

function rowToBuild(row: BuildRow): Build {
  return {
    ...row,
    status: row.status as Build["status"],
    build_log: row.build_log ? row.build_log.split("\n") : null,
  };
}

/** Create a new build record. Returns the inserted ID. */
export async function createBuild(
  sourceId: string,
  imageTag: string,
  sourceBranch: string
): Promise<number> {
  await ensureTable();
  const result = await executeDb(
    DB_REALMD,
    `INSERT INTO builds (source_id, image_tag, source_branch, status) VALUES (?, ?, ?, 'building')`,
    [sourceId, imageTag, sourceBranch]
  );
  return result.insertId;
}

/** Update a build's status, optionally saving the build log. */
export async function updateBuildStatus(
  buildId: number,
  status: "building" | "success" | "failed",
  buildLog?: string[]
): Promise<void> {
  await ensureTable();
  if (buildLog) {
    await executeDb(
      DB_REALMD,
      `UPDATE builds SET status = ?, build_log = ? WHERE id = ?`,
      [status, buildLog.join("\n"), buildId]
    );
  } else {
    await executeDb(
      DB_REALMD,
      `UPDATE builds SET status = ? WHERE id = ?`,
      [status, buildId]
    );
  }
}

/** Get all builds, newest first. */
export async function getAllBuilds(): Promise<Build[]> {
  await ensureTable();
  const rows = await query<BuildRow>(
    `SELECT * FROM ${DB_REALMD}.builds ORDER BY created_at DESC`
  );
  return rows.map(rowToBuild);
}

/** Get builds for a specific source, newest first. */
export async function getBuildsForSource(sourceId: string): Promise<Build[]> {
  await ensureTable();
  const rows = await query<BuildRow>(
    `SELECT * FROM ${DB_REALMD}.builds WHERE source_id = ? ORDER BY created_at DESC`,
    [sourceId]
  );
  return rows.map(rowToBuild);
}

/** Get a single build by ID. */
export async function getBuild(buildId: number): Promise<Build | null> {
  await ensureTable();
  const rows = await query<BuildRow>(
    `SELECT * FROM ${DB_REALMD}.builds WHERE id = ?`,
    [buildId]
  );
  return rows.length > 0 ? rowToBuild(rows[0]) : null;
}

/** Get all successful builds (for realm build selection dropdown). */
export async function getSuccessfulBuilds(): Promise<Build[]> {
  await ensureTable();
  const rows = await query<BuildRow>(
    `SELECT * FROM ${DB_REALMD}.builds WHERE status = 'success' ORDER BY created_at DESC`
  );
  return rows.map(rowToBuild);
}

/** Delete a build record. Returns true if deleted. */
export async function deleteBuild(buildId: number): Promise<boolean> {
  await ensureTable();
  const result = await executeDb(
    DB_REALMD,
    `DELETE FROM builds WHERE id = ?`,
    [buildId]
  );
  return result.affectedRows > 0;
}

/**
 * Check which realms are using a build (for safe deletion).
 * Returns realm names that reference this build.
 */
export async function getBuildUsageByRealms(buildId: number): Promise<string[]> {
  const realms = await getRealmsUsingBuild(buildId);
  return realms.map((r) => r.name);
}

/**
 * Prune old successful builds for a source, keeping the newest `keep` builds.
 * Skips builds in use by any realm.
 * Returns image tags of pruned builds for the caller to `docker rmi`.
 */
export async function pruneOldBuilds(
  sourceId: string,
  keep: number
): Promise<string[]> {
  await ensureTable();
  const rows = await query<BuildRow>(
    `SELECT * FROM ${DB_REALMD}.builds
     WHERE source_id = ? AND status = 'success'
     ORDER BY created_at DESC`,
    [sourceId]
  );

  const toDelete = rows.slice(keep);
  const tags: string[] = [];

  for (const row of toDelete) {
    // Check if any realm uses this build
    const usage = await getRealmsUsingBuild(row.id);
    if (usage.length > 0) continue; // Skip — in use

    await executeDb(DB_REALMD, `DELETE FROM builds WHERE id = ?`, [row.id]);
    tags.push(row.image_tag);
  }

  return tags;
}

/**
 * Delete all build records for a source. Returns image tags for cleanup.
 */
export async function deleteBuildsForSource(sourceId: string): Promise<string[]> {
  await ensureTable();
  const rows = await query<BuildRow>(
    `SELECT image_tag FROM ${DB_REALMD}.builds WHERE source_id = ?`,
    [sourceId]
  );
  if (rows.length > 0) {
    await executeDb(
      DB_REALMD,
      `DELETE FROM builds WHERE source_id = ?`,
      [sourceId]
    );
  }
  return rows.map((r) => r.image_tag);
}

/**
 * Mark any builds with status='building' as 'failed' (orphans from interrupted builds).
 * Returns their image tags for cleanup.
 */
export async function markOrphanBuilds(): Promise<string[]> {
  await ensureTable();
  try {
    const rows = await query<BuildRow>(
      `SELECT * FROM ${DB_REALMD}.builds WHERE status = 'building'`
    );
    if (rows.length === 0) return [];

    await executeDb(
      DB_REALMD,
      `UPDATE ${DB_REALMD}.builds SET status = 'failed' WHERE status = 'building'`
    );
    return rows.map((r) => r.image_tag);
  } catch {
    return [];
  }
}
