/**
 * DB-backed key-value settings store (webui_settings table).
 * Used for branding, getting started config, and other non-DB settings.
 * Creates the table on first use if it doesn't exist.
 */

import { query, executeDb, DB_REALMD } from "./db";

let tableCreated = false;

async function ensureTable(): Promise<void> {
  if (tableCreated) return;
  try {
    await executeDb(
      DB_REALMD,
      `CREATE TABLE IF NOT EXISTS webui_settings (
        \`key\` VARCHAR(128) NOT NULL PRIMARY KEY,
        \`value\` JSON NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      []
    );
    tableCreated = true;
  } catch (err) {
    console.error("webui_settings table creation failed:", err);
  }
}

interface SettingsRow {
  key: string;
  value: string;
}

/**
 * Get a setting value by key. Returns parsed JSON or null if not found.
 */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  await ensureTable();
  try {
    const rows = await query<SettingsRow>(
      `SELECT \`key\`, \`value\` FROM ${DB_REALMD}.webui_settings WHERE \`key\` = ?`,
      [key]
    );
    if (!rows.length) return null;
    // MySQL returns JSON columns as parsed objects already
    const val = rows[0].value;
    return (typeof val === "string" ? JSON.parse(val) : val) as T;
  } catch {
    return null;
  }
}

/**
 * Set a setting value (upsert). Value is stored as JSON.
 */
export async function setSetting<T = unknown>(
  key: string,
  value: T
): Promise<void> {
  await ensureTable();
  const jsonValue = JSON.stringify(value);
  try {
    await executeDb(
      DB_REALMD,
      `INSERT INTO ${DB_REALMD}.webui_settings (\`key\`, \`value\`) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updated_at = NOW()`,
      [key, jsonValue]
    );
  } catch {
    // Silently fail — non-critical
  }
}

/**
 * Delete a setting by key.
 */
export async function deleteSetting(key: string): Promise<void> {
  await ensureTable();
  try {
    await executeDb(
      DB_REALMD,
      `DELETE FROM ${DB_REALMD}.webui_settings WHERE \`key\` = ?`,
      [key]
    );
  } catch {
    // ignore
  }
}
