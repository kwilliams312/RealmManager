/**
 * DB-backed realm source configuration (realm_sources_config table).
 * Replaces the hardcoded REALM_SOURCES array with a DB-backed CRUD store.
 * Creates/seeds the table on first use.
 */

import { query, executeDb, DB_REALMD } from "./db";
import { encrypt, decrypt } from "./crypto";
import type { RealmSource, RealmSourceConfig } from "@/types/realm";
import { REALM_SOURCES } from "@/data/realm-sources";

let tableCreated = false;
let seeded = false;

async function ensureTable(): Promise<void> {
  if (tableCreated) return;
  try {
    await executeDb(
      DB_REALMD,
      `CREATE TABLE IF NOT EXISTS realm_sources_config (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        url VARCHAR(512) NOT NULL,
        default_branch VARCHAR(128) NOT NULL DEFAULT 'master',
        github_token_enc TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      []
    );
    tableCreated = true;
  } catch (err) {
    console.error("realm_sources_config table creation failed:", err);
  }
}

async function seedIfEmpty(): Promise<void> {
  if (seeded) return;
  seeded = true;
  await ensureTable();
  try {
    const rows = await query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM ${DB_REALMD}.realm_sources_config`
    );
    if ((rows[0]?.cnt ?? 0) > 0) return;

    for (const src of REALM_SOURCES) {
      await executeDb(
        DB_REALMD,
        `INSERT IGNORE INTO ${DB_REALMD}.realm_sources_config (id, name, url, default_branch) VALUES (?, ?, ?, ?)`,
        [src.id, src.name, src.url, src.defaultBranch]
      );
    }
  } catch {
    // Non-critical
  }
}

interface SourceRow {
  id: string;
  name: string;
  url: string;
  default_branch: string;
  github_token_enc: string | null;
}

function rowToSource(row: SourceRow): RealmSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    defaultBranch: row.default_branch,
  };
}

function rowToConfig(row: SourceRow): RealmSourceConfig {
  const token = row.github_token_enc ? decrypt(row.github_token_enc) : undefined;
  const hasToken = !!row.github_token_enc;
  let tokenMasked: string | undefined;
  if (token && token.length > 4) {
    tokenMasked = "••••" + token.slice(-4);
  } else if (token) {
    tokenMasked = "••••";
  }
  return {
    ...rowToSource(row),
    token: token ?? undefined,
    hasToken,
    tokenMasked,
  };
}

/** Get all sources (public view — no tokens). */
export async function getAllSources(): Promise<RealmSource[]> {
  await seedIfEmpty();
  try {
    const rows = await query<SourceRow>(
      `SELECT id, name, url, default_branch, github_token_enc FROM ${DB_REALMD}.realm_sources_config ORDER BY name`
    );
    return rows.map(rowToSource);
  } catch {
    return REALM_SOURCES;
  }
}

/** Get all sources with masked token info (for settings UI). */
export async function getAllSourceConfigs(): Promise<RealmSourceConfig[]> {
  await seedIfEmpty();
  try {
    const rows = await query<SourceRow>(
      `SELECT id, name, url, default_branch, github_token_enc FROM ${DB_REALMD}.realm_sources_config ORDER BY name`
    );
    return rows.map((row) => {
      const cfg = rowToConfig(row);
      // Strip the actual token for API responses — only expose masked version
      return { ...cfg, token: undefined };
    });
  } catch {
    return REALM_SOURCES.map((s) => ({ ...s, hasToken: false }));
  }
}

/** Get a single source config with decrypted token (for build pipeline). */
export async function getSourceConfig(
  id: string
): Promise<RealmSourceConfig | null> {
  await seedIfEmpty();
  try {
    const rows = await query<SourceRow>(
      `SELECT id, name, url, default_branch, github_token_enc FROM ${DB_REALMD}.realm_sources_config WHERE id = ?`,
      [id]
    );
    if (!rows.length) {
      // Fallback to hardcoded
      const fallback = REALM_SOURCES.find((s) => s.id === id);
      return fallback ? { ...fallback } : null;
    }
    return rowToConfig(rows[0]);
  } catch {
    const fallback = REALM_SOURCES.find((s) => s.id === id);
    return fallback ? { ...fallback } : null;
  }
}

/** Create a new source. Token is encrypted before storage. */
export async function createSource(
  id: string,
  name: string,
  url: string,
  defaultBranch: string,
  token?: string
): Promise<void> {
  await ensureTable();
  const tokenEnc = token ? encrypt(token) : null;
  await executeDb(
    DB_REALMD,
    `INSERT INTO ${DB_REALMD}.realm_sources_config (id, name, url, default_branch, github_token_enc) VALUES (?, ?, ?, ?, ?)`,
    [id, name, url, defaultBranch, tokenEnc]
  );
}

/** Update an existing source. Pass token="" to clear, undefined to keep. */
export async function updateSource(
  id: string,
  updates: { name?: string; url?: string; defaultBranch?: string; token?: string }
): Promise<boolean> {
  await ensureTable();
  const fields: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    params.push(updates.name);
  }
  if (updates.url !== undefined) {
    fields.push("url = ?");
    params.push(updates.url);
  }
  if (updates.defaultBranch !== undefined) {
    fields.push("default_branch = ?");
    params.push(updates.defaultBranch);
  }
  if (updates.token !== undefined) {
    fields.push("github_token_enc = ?");
    params.push(updates.token === "" ? null : encrypt(updates.token));
  }

  if (fields.length === 0) return false;
  params.push(id);

  const result = await executeDb(
    DB_REALMD,
    `UPDATE ${DB_REALMD}.realm_sources_config SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

/** Delete a source by ID. */
export async function deleteSource(id: string): Promise<boolean> {
  await ensureTable();
  const result = await executeDb(
    DB_REALMD,
    `DELETE FROM ${DB_REALMD}.realm_sources_config WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}
