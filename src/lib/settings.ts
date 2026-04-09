/**
 * JSON file-based settings for DB config and other settings that must
 * survive even when the database is unreachable.
 *
 * Primary storage: ${REALM_DATA_DIR}/settings.json
 * Fallback: env vars for DB config, hardcoded defaults for everything else.
 */

import { readFileSync, writeFileSync, renameSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";

export interface DbSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  rootPassword: string;
  authDb: string;
  worldDb: string;
  charactersDb: string;
}

export interface FileSettings {
  db: DbSettings;
}

const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";
const SETTINGS_PATH = join(DATA_DIR, "settings.json");
const CACHE_TTL_MS = 30_000;

let cached: FileSettings | null = null;
let cacheTime = 0;

function defaultDbSettings(): DbSettings {
  return {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: parseInt(process.env.DB_PORT ?? "3306"),
    user: process.env.DB_USER ?? "acore",
    password: process.env.DB_PASS ?? "acore",
    rootPassword:
      process.env.DB_ROOT_PASS ??
      process.env.DOCKER_DB_ROOT_PASSWORD ??
      "password",
    authDb: process.env.DB_REALMD ?? "acore_auth",
    worldDb: process.env.DB_WORLD ?? "acore_world",
    charactersDb: process.env.DB_CHARACTERS ?? "acore_characters",
  };
}

function defaultSettings(): FileSettings {
  return { db: defaultDbSettings() };
}

/**
 * Read settings.json synchronously.
 * Returns cached copy if within TTL. Falls back to defaults if file missing.
 */
export function readSettings(): FileSettings {
  if (cached && Date.now() - cacheTime < CACHE_TTL_MS) return cached;

  try {
    const raw = readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<FileSettings>;
    const defaults = defaultSettings();
    cached = {
      db: { ...defaults.db, ...(parsed.db ?? {}) },
    };
    cacheTime = Date.now();
    return cached;
  } catch {
    // File doesn't exist or is corrupt — use defaults
    return defaultSettings();
  }
}

/**
 * Read settings.json synchronously at startup (used by db.ts).
 * Does NOT cache (this is a one-shot startup read).
 */
export function readSettingsSync(): FileSettings {
  try {
    const raw = readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<FileSettings>;
    const defaults = defaultSettings();
    return {
      db: { ...defaults.db, ...(parsed.db ?? {}) },
    };
  } catch {
    return defaultSettings();
  }
}

/**
 * Write settings.json atomically (write to tmp, rename).
 * Sets file permissions to 600 (owner-only).
 */
export function writeSettings(settings: FileSettings): void {
  const dir = dirname(SETTINGS_PATH);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Dir exists
  }

  const tmpPath = `${SETTINGS_PATH}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(settings, null, 2), "utf8");
  try {
    chmodSync(tmpPath, 0o600);
  } catch {
    // chmod may fail on some filesystems
  }
  renameSync(tmpPath, SETTINGS_PATH);

  // Update cache
  cached = settings;
  cacheTime = Date.now();
}

/** Invalidate the in-memory cache (forces next read from disk). */
export function invalidateSettingsCache(): void {
  cached = null;
  cacheTime = 0;
}
