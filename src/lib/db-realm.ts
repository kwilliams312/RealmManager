/**
 * Per-realm database routing.
 *
 * Each realm N gets:
 *   - characters DB: acore_characters_N
 *   - world DB: acore_world_N
 *
 * All realms share the same auth DB: acore_auth
 *
 * Ref: azerothcore_webui/app.py:516-553
 */

import { queryDb, DB_REALMD } from "./db";

/** Get the character database name for a realm. */
export function charDb(realmId: number): string {
  if (realmId === 1) {
    // Default realm uses the configured DB_CHARACTERS
    return process.env.DB_CHARACTERS ?? "acore_characters";
  }
  return `acore_characters_${realmId}`;
}

/** Get the world database name for a realm. */
export function worldDb(realmId: number): string {
  if (realmId === 1) {
    return process.env.DB_WORLD ?? "acore_world";
  }
  return `acore_world_${realmId}`;
}

/** Get the name of an extra manifest-defined database for a realm.
 *  Always suffixed with realmId for isolation.
 *  e.g. extraDbName("playerbots", 5) → "acore_playerbots_5"
 */
export function extraDbName(baseName: string, realmId: number): string {
  return `acore_${baseName}_${realmId}`;
}

/** Query the character database for a specific realm. */
export async function queryCharDb<T = Record<string, unknown>>(
  realmId: number,
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[]
): Promise<T[]> {
  return queryDb<T>(charDb(realmId), sql, params);
}

/** Query the character DB with access to auth tables via cross-DB syntax. */
export async function queryCharAuthDb<T = Record<string, unknown>>(
  realmId: number,
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[]
): Promise<T[]> {
  // The character DB has access to acore_auth via db.table syntax since they're on the same MySQL instance
  return queryDb<T>(charDb(realmId), sql, params);
}

// Alliance/Horde race IDs for WotLK
export const ALLIANCE_RACES = new Set([1, 3, 4, 7, 11]); // Human, Dwarf, NightElf, Gnome, Draenei
export const HORDE_RACES = new Set([2, 5, 6, 8, 10]); // Orc, Undead, Tauren, Troll, BloodElf

export const CLASS_NAMES: Record<number, string> = {
  1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest",
  6: "Death Knight", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid",
};

export const RACE_NAMES: Record<number, string> = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead",
  6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei",
};

// SQL fragments for bot detection (bots have username matching RNDBOT%)
export const IS_BOT = `a.username LIKE 'RNDBOT%'`;
export const IS_PLAYER = `a.username NOT LIKE 'RNDBOT%'`;
export const BOT_JOIN = ` JOIN ${DB_REALMD}.account a ON a.id = c.account`;
