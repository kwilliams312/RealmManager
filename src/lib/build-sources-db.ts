/**
 * DB-managed build sources — global git repositories for building worldserver images.
 * Creates the table on first use if it doesn't exist.
 * Also manages the realm→build mapping (active_build_id on realm_source).
 */

import { query, executeDb, DB_REALMD } from "./db";
import { type RealmManifest } from "./manifest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as yamlLoad } from "js-yaml";

let tableCreated = false;
let seeded = false;

async function ensureTable(): Promise<void> {
  if (tableCreated) return;
  try {
    await executeDb(
      DB_REALMD,
      `CREATE TABLE IF NOT EXISTS build_sources (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        source_id VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(128) NOT NULL,
        url VARCHAR(512) NOT NULL,
        default_branch VARCHAR(128) NOT NULL DEFAULT 'master',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_source_id (source_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      []
    );
    tableCreated = true;
  } catch {
    tableCreated = true;
  }

  // Ensure build_sources has github_token_id column
  try {
    await executeDb(DB_REALMD, `ALTER TABLE build_sources ADD COLUMN github_token_id INT UNSIGNED DEFAULT NULL`, []);
  } catch { /* column already exists */ }

  // Ensure build_sources has source_type column (image or git)
  try {
    await executeDb(DB_REALMD, `ALTER TABLE build_sources ADD COLUMN source_type VARCHAR(16) NOT NULL DEFAULT 'git'`, []);
  } catch { /* column already exists */ }

  // Ensure build_sources has image_name column (for image-type sources)
  try {
    await executeDb(DB_REALMD, `ALTER TABLE build_sources ADD COLUMN image_name VARCHAR(256) DEFAULT NULL`, []);
  } catch { /* column already exists */ }

  // Ensure build_sources has image_tag column (for image-type sources)
  try {
    await executeDb(DB_REALMD, `ALTER TABLE build_sources ADD COLUMN image_tag VARCHAR(128) NOT NULL DEFAULT 'latest'`, []);
  } catch { /* column already exists */ }

  // Configurable build pipeline fields (git sources)
  const buildColumns: [string, string][] = [
    ["dockerfile_path", "VARCHAR(256) NOT NULL DEFAULT 'apps/docker/Dockerfile'"],
    ["worldserver_target", "VARCHAR(64) NOT NULL DEFAULT 'worldserver'"],
    ["db_import_target", "VARCHAR(64) DEFAULT 'db-import'"],
    ["build_args", "JSON DEFAULT NULL"],
    ["config_path", "VARCHAR(256) NOT NULL DEFAULT '/azerothcore/env/dist/etc'"],
    ["ref_config_path", "VARCHAR(256) NOT NULL DEFAULT '/azerothcore/env/ref/etc'"],
    ["data_path", "VARCHAR(256) NOT NULL DEFAULT '/azerothcore/env/dist/data'"],
    ["logs_path", "VARCHAR(256) NOT NULL DEFAULT '/azerothcore/env/dist/logs'"],
    ["source_manifest", "JSON DEFAULT NULL"],
  ];
  for (const [col, def] of buildColumns) {
    try {
      await executeDb(DB_REALMD, `ALTER TABLE build_sources ADD COLUMN ${col} ${def}`, []);
    } catch { /* column already exists */ }
  }

  // Ensure realm_source table exists
  try {
    await executeDb(
      DB_REALMD,
      `CREATE TABLE IF NOT EXISTS realm_source (
        realmid INT UNSIGNED NOT NULL PRIMARY KEY COMMENT 'FK to realmlist.id',
        source_id VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'Repository source identifier',
        source_branch VARCHAR(128) NOT NULL DEFAULT 'master' COMMENT 'Git branch name'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      []
    );
  } catch { /* already exists */ }

  // Ensure realm_source has active_build_id column
  try {
    await executeDb(DB_REALMD, `ALTER TABLE realm_source ADD COLUMN active_build_id INT UNSIGNED DEFAULT NULL`, []);
  } catch { /* column already exists */ }

  // Ensure realm_source has remote realm columns
  const remoteColumns = [
    ["is_remote", "TINYINT UNSIGNED NOT NULL DEFAULT 0"],
    ["ra_host", "VARCHAR(255) DEFAULT NULL"],
    ["ra_port", "SMALLINT UNSIGNED DEFAULT NULL"],
    ["ra_user", "VARCHAR(64) DEFAULT NULL"],
    ["ra_pass", "VARCHAR(128) DEFAULT NULL"],
  ];
  for (const [col, def] of remoteColumns) {
    try {
      await executeDb(DB_REALMD, `ALTER TABLE realm_source ADD COLUMN ${col} ${def}`, []);
    } catch { /* column already exists */ }
  }

  // Seed default sources from dist files if table is empty
  if (!seeded) {
    seeded = true;
    try {
      const rows = await query<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM ${DB_REALMD}.build_sources`);
      if ((rows[0]?.cnt ?? 0) === 0) {
        await seedSourcesFromDist();
      }
    } catch { /* ignore seed errors */ }
  }
}

/** Seed build sources from dist files (src/data/seed/) on first boot. */
async function seedSourcesFromDist(): Promise<void> {
  // Resolve seed directory — works in both dev (src/) and production (standalone)
  const seedDirs = [
    join(process.cwd(), "src", "data", "seed"),
    join(process.cwd(), "data", "seed"),
    join(__dirname, "..", "data", "seed"),
  ];
  let seedDir: string | null = null;
  for (const dir of seedDirs) {
    try { readFileSync(join(dir, "sources.json")); seedDir = dir; break; } catch { /* try next */ }
  }
  if (!seedDir) {
    console.log("[seed] No seed directory found — skipping source seeding");
    return;
  }

  try {
    const sourcesJson = readFileSync(join(seedDir, "sources.json"), "utf-8");
    const sources = JSON.parse(sourcesJson) as Array<{
      sourceId: string;
      name: string;
      url: string;
      defaultBranch: string;
      sourceType: string;
      manifest?: string;
    }>;

    for (const src of sources) {
      let manifest: string | null = null;
      if (src.manifest) {
        try {
          const yamlContent = readFileSync(join(seedDir, src.manifest), "utf-8");
          const parsed = yamlLoad(yamlContent);
          manifest = JSON.stringify(parsed);
        } catch (err) {
          console.error(`[seed] Failed to load manifest ${src.manifest}:`, err);
        }
      }

      await executeDb(
        DB_REALMD,
        `INSERT INTO build_sources (source_id, name, url, default_branch, source_type, source_manifest)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [src.sourceId, src.name, src.url, src.defaultBranch, src.sourceType ?? "git", manifest]
      );
      console.log(`[seed] Seeded source: ${src.sourceId} (${src.name})`);
    }
  } catch (err) {
    console.error("[seed] Failed to seed sources:", err);
  }
}

export interface BuildSourceRow {
  id: number;
  source_id: string;
  name: string;
  url: string;
  default_branch: string;
  github_token_id: number | null;
  source_type: string;
  image_name: string | null;
  image_tag: string;
  dockerfile_path: string;
  worldserver_target: string;
  db_import_target: string | null;
  build_args: string | null;
  config_path: string;
  ref_config_path: string;
  data_path: string;
  logs_path: string;
  source_manifest: string | null;
  created_at: string;
}

export interface BuildSource {
  id: number;
  sourceId: string;
  name: string;
  url: string;
  defaultBranch: string;
  githubTokenId: number | null;
  sourceType: "image" | "git";
  imageName: string | null;
  imageTag: string;
  dockerfilePath: string;
  worldserverTarget: string;
  dbImportTarget: string | null;
  buildArgs: Record<string, string> | null;
  configPath: string;
  refConfigPath: string;
  dataPath: string;
  logsPath: string;
  sourceManifest: RealmManifest | null;
  createdAt: string;
}

function rowToSource(row: BuildSourceRow): BuildSource {
  let buildArgs: Record<string, string> | null = null;
  if (row.build_args) {
    try { buildArgs = typeof row.build_args === "string" ? JSON.parse(row.build_args) : row.build_args; } catch { /* invalid JSON */ }
  }
  let sourceManifest: RealmManifest | null = null;
  if (row.source_manifest) {
    try {
      const raw = typeof row.source_manifest === "string" ? JSON.parse(row.source_manifest) : row.source_manifest;
      sourceManifest = raw as RealmManifest;
    } catch { /* invalid JSON */ }
  }
  return {
    id: row.id,
    sourceId: row.source_id,
    name: row.name,
    url: row.url,
    defaultBranch: row.default_branch,
    githubTokenId: row.github_token_id ?? null,
    sourceType: (row.source_type === "image" ? "image" : "git") as BuildSource["sourceType"],
    imageName: row.image_name ?? null,
    imageTag: row.image_tag ?? "latest",
    dockerfilePath: row.dockerfile_path ?? "apps/docker/Dockerfile",
    worldserverTarget: row.worldserver_target ?? "worldserver",
    dbImportTarget: row.db_import_target ?? "db-import",
    buildArgs,
    configPath: row.config_path ?? "/azerothcore/env/dist/etc",
    refConfigPath: row.ref_config_path ?? "/azerothcore/env/ref/etc",
    dataPath: row.data_path ?? "/azerothcore/env/dist/data",
    logsPath: row.logs_path ?? "/azerothcore/env/dist/logs",
    sourceManifest,
    createdAt: row.created_at,
  };
}

/** Get all sources. */
export async function getAllSources(): Promise<BuildSource[]> {
  await ensureTable();
  const rows = await query<BuildSourceRow>(
    `SELECT * FROM ${DB_REALMD}.build_sources ORDER BY created_at`
  );
  return rows.map(rowToSource);
}

/** Get a source by its slug (source_id). */
export async function getSourceBySlug(sourceId: string): Promise<BuildSource | null> {
  await ensureTable();
  const rows = await query<BuildSourceRow>(
    `SELECT * FROM ${DB_REALMD}.build_sources WHERE source_id = ?`,
    [sourceId]
  );
  return rows.length > 0 ? rowToSource(rows[0]) : null;
}

/** Get a source by its numeric ID. */
export async function getSource(id: number): Promise<BuildSource | null> {
  await ensureTable();
  const rows = await query<BuildSourceRow>(
    `SELECT * FROM ${DB_REALMD}.build_sources WHERE id = ?`,
    [id]
  );
  return rows.length > 0 ? rowToSource(rows[0]) : null;
}

/** Create a new source. Returns the inserted ID. */
export async function createSource(
  sourceId: string,
  name: string,
  url: string,
  defaultBranch: string,
  githubTokenId?: number | null,
  sourceType?: "image" | "git",
  imageName?: string | null,
  imageTag?: string,
  sourceManifest?: RealmManifest | null
): Promise<number> {
  await ensureTable();
  const result = await executeDb(
    DB_REALMD,
    `INSERT INTO build_sources (source_id, name, url, default_branch, github_token_id, source_type, image_name, image_tag, source_manifest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sourceId, name, url, defaultBranch, githubTokenId ?? null, sourceType ?? "git", imageName ?? null, imageTag ?? "latest",
      sourceManifest ? JSON.stringify(sourceManifest) : null]
  );
  return result.insertId;
}

/** Update a source. */
export async function updateSource(
  sourceId: string,
  updates: {
    name?: string;
    url?: string;
    defaultBranch?: string;
    githubTokenId?: number | null;
    sourceType?: "image" | "git";
    imageName?: string | null;
    imageTag?: string;
    dockerfilePath?: string;
    worldserverTarget?: string;
    dbImportTarget?: string | null;
    buildArgs?: Record<string, string> | null;
    configPath?: string;
    refConfigPath?: string;
    dataPath?: string;
    logsPath?: string;
    sourceManifest?: RealmManifest | null;
  }
): Promise<void> {
  await ensureTable();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (updates.name !== undefined) { sets.push("name = ?"); vals.push(updates.name); }
  if (updates.url !== undefined) { sets.push("url = ?"); vals.push(updates.url); }
  if (updates.defaultBranch !== undefined) { sets.push("default_branch = ?"); vals.push(updates.defaultBranch); }
  if (updates.githubTokenId !== undefined) { sets.push("github_token_id = ?"); vals.push(updates.githubTokenId); }
  if (updates.sourceType !== undefined) { sets.push("source_type = ?"); vals.push(updates.sourceType); }
  if (updates.imageName !== undefined) { sets.push("image_name = ?"); vals.push(updates.imageName); }
  if (updates.imageTag !== undefined) { sets.push("image_tag = ?"); vals.push(updates.imageTag); }
  if (updates.dockerfilePath !== undefined) { sets.push("dockerfile_path = ?"); vals.push(updates.dockerfilePath); }
  if (updates.worldserverTarget !== undefined) { sets.push("worldserver_target = ?"); vals.push(updates.worldserverTarget); }
  if (updates.dbImportTarget !== undefined) { sets.push("db_import_target = ?"); vals.push(updates.dbImportTarget); }
  if (updates.buildArgs !== undefined) { sets.push("build_args = ?"); vals.push(updates.buildArgs ? JSON.stringify(updates.buildArgs) : null); }
  if (updates.configPath !== undefined) { sets.push("config_path = ?"); vals.push(updates.configPath); }
  if (updates.refConfigPath !== undefined) { sets.push("ref_config_path = ?"); vals.push(updates.refConfigPath); }
  if (updates.dataPath !== undefined) { sets.push("data_path = ?"); vals.push(updates.dataPath); }
  if (updates.logsPath !== undefined) { sets.push("logs_path = ?"); vals.push(updates.logsPath); }
  if (updates.sourceManifest !== undefined) { sets.push("source_manifest = ?"); vals.push(updates.sourceManifest ? JSON.stringify(updates.sourceManifest) : null); }
  if (sets.length === 0) return;
  vals.push(sourceId);
  await executeDb(DB_REALMD, `UPDATE build_sources SET ${sets.join(", ")} WHERE source_id = ?`, vals);
}

/** Delete a source by slug. */
export async function deleteSource(sourceId: string): Promise<boolean> {
  await ensureTable();
  const result = await executeDb(
    DB_REALMD,
    `DELETE FROM build_sources WHERE source_id = ?`,
    [sourceId]
  );
  return result.affectedRows > 0;
}

// --- Realm → Build mapping (active_build_id on realm_source) ---

/** Get the active build ID for a realm. */
export async function getRealmActiveBuild(realmId: number): Promise<number | null> {
  await ensureTable();
  try {
    const rows = await query<{ active_build_id: number | null }>(
      `SELECT active_build_id FROM ${DB_REALMD}.realm_source WHERE realmid = ?`,
      [realmId]
    );
    return rows[0]?.active_build_id ?? null;
  } catch {
    return null;
  }
}

/** Set the active build ID for a realm. */
export async function setRealmActiveBuild(realmId: number, buildId: number | null): Promise<void> {
  await ensureTable();
  // Upsert — create realm_source row if it doesn't exist
  await executeDb(
    DB_REALMD,
    `INSERT INTO realm_source (realmid, active_build_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE active_build_id = VALUES(active_build_id)`,
    [realmId, buildId]
  );
}

/** Get all realm IDs using a specific build. */
export async function getRealmsUsingBuild(buildId: number): Promise<Array<{ realmId: number; name: string }>> {
  await ensureTable();
  try {
    const rows = await query<{ realmid: number; name: string }>(
      `SELECT rs.realmid, r.name
       FROM ${DB_REALMD}.realm_source rs
       JOIN ${DB_REALMD}.realmlist r ON rs.realmid = r.id
       WHERE rs.active_build_id = ?`,
      [buildId]
    );
    return rows.map((r) => ({ realmId: r.realmid, name: r.name }));
  } catch {
    return [];
  }
}

/**
 * Backward-compatible alias for code that imported getSourceConfig from the old
 * realm-sources-config-db.ts (phantom import). Returns a BuildSource or null.
 */
export async function getSourceConfig(sourceId: string): Promise<BuildSource | null> {
  return getSourceBySlug(sourceId);
}

// --- Remote realm config ---

export interface RemoteRealmConfig {
  isRemote: boolean;
  raHost: string | null;
  raPort: number | null;
  raUser: string | null;
  raPass: string | null;
}

/** Check if a realm is remote. */
export async function isRealmRemote(realmId: number): Promise<boolean> {
  await ensureTable();
  try {
    const rows = await query<{ is_remote: number }>(
      `SELECT is_remote FROM ${DB_REALMD}.realm_source WHERE realmid = ?`,
      [realmId]
    );
    return (rows[0]?.is_remote ?? 0) === 1;
  } catch {
    return false;
  }
}

/** Get remote realm config (RA credentials). */
export async function getRealmRemoteConfig(realmId: number): Promise<RemoteRealmConfig> {
  await ensureTable();
  try {
    const rows = await query<{
      is_remote: number;
      ra_host: string | null;
      ra_port: number | null;
      ra_user: string | null;
      ra_pass: string | null;
    }>(
      `SELECT is_remote, ra_host, ra_port, ra_user, ra_pass
       FROM ${DB_REALMD}.realm_source WHERE realmid = ?`,
      [realmId]
    );
    if (!rows.length) return { isRemote: false, raHost: null, raPort: null, raUser: null, raPass: null };
    const r = rows[0];
    return {
      isRemote: r.is_remote === 1,
      raHost: r.ra_host,
      raPort: r.ra_port,
      raUser: r.ra_user,
      raPass: r.ra_pass,
    };
  } catch {
    return { isRemote: false, raHost: null, raPort: null, raUser: null, raPass: null };
  }
}

/** Set remote realm config (RA credentials). */
export async function setRealmRemoteConfig(
  realmId: number,
  config: Partial<Omit<RemoteRealmConfig, "isRemote">>
): Promise<void> {
  await ensureTable();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (config.raHost !== undefined) { sets.push("ra_host = ?"); vals.push(config.raHost); }
  if (config.raPort !== undefined) { sets.push("ra_port = ?"); vals.push(config.raPort); }
  if (config.raUser !== undefined) { sets.push("ra_user = ?"); vals.push(config.raUser); }
  if (config.raPass !== undefined) { sets.push("ra_pass = ?"); vals.push(config.raPass); }
  if (sets.length === 0) return;
  vals.push(realmId);
  await executeDb(DB_REALMD, `UPDATE realm_source SET ${sets.join(", ")} WHERE realmid = ?`, vals);
}
