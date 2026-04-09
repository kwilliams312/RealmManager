import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { query, DB_REALMD } from "@/lib/db";
import { getCache, setCache } from "@/lib/cache";
import {
  queryCharDb,
  queryCharAuthDb,
  ALLIANCE_RACES,
  HORDE_RACES,
  CLASS_NAMES,
  RACE_NAMES,
  IS_BOT,
  IS_PLAYER,
  BOT_JOIN,
} from "@/lib/db-realm";

async function getRealmDashboard(realmId: number) {
  const data: Record<string, unknown> = {};

  // Uptime from realmd
  try {
    const rows = await query<{ starttime: number; maxplayers: number }>(
      `SELECT starttime, maxplayers FROM ${DB_REALMD}.uptime WHERE realmid=? ORDER BY starttime DESC LIMIT 1`,
      [realmId]
    );
    if (rows.length) {
      data.uptime_seconds = Math.floor(Date.now() / 1000) - rows[0].starttime;
      data.peak_players = rows[0].maxplayers;
    } else {
      data.uptime_seconds = null;
      data.peak_players = null;
    }
  } catch {
    data.uptime_seconds = null;
    data.peak_players = null;
  }

  // Character metrics
  try {
    const rows = await queryCharAuthDb<Record<string, number | null>>(
      realmId,
      `SELECT
        SUM(CASE WHEN ${IS_PLAYER} THEN 1 ELSE 0 END) AS player_total,
        SUM(CASE WHEN ${IS_PLAYER} AND c.online = 1 THEN 1 ELSE 0 END) AS players_online,
        SUM(CASE WHEN ${IS_BOT} THEN 1 ELSE 0 END) AS bot_total,
        SUM(CASE WHEN ${IS_BOT} AND c.online = 1 THEN 1 ELSE 0 END) AS bots_online,
        COUNT(*) AS total,
        AVG(c.\`level\`) AS avg_level,
        SUM(c.money) AS total_gold
       FROM characters c${BOT_JOIN}`
    );
    if (rows.length && rows[0].total) {
      const r = rows[0];
      data.total_characters = Number(r.player_total ?? 0);
      data.players_online = Number(r.players_online ?? 0);
      data.bot_characters = Number(r.bot_total ?? 0);
      data.bots_online = Number(r.bots_online ?? 0);
      data.avg_level = Math.round((Number(r.avg_level ?? 0)) * 10) / 10;
      data.total_gold = Math.floor(Number(r.total_gold ?? 0) / 10000);
    } else {
      data.total_characters = 0;
      data.players_online = 0;
      data.bot_characters = 0;
      data.bots_online = 0;
      data.avg_level = 0;
      data.total_gold = 0;
    }
  } catch {
    data.total_characters = null;
    data.players_online = null;
    data.bot_characters = null;
    data.bots_online = null;
    data.avg_level = null;
    data.total_gold = null;
  }

  // Faction balance
  try {
    const rows = await queryCharDb<{ race: number; cnt: number }>(
      realmId,
      "SELECT race, COUNT(*) AS cnt FROM characters GROUP BY race"
    );
    data.alliance_count = rows
      .filter((r) => ALLIANCE_RACES.has(r.race))
      .reduce((s, r) => s + Number(r.cnt), 0);
    data.horde_count = rows
      .filter((r) => HORDE_RACES.has(r.race))
      .reduce((s, r) => s + Number(r.cnt), 0);
  } catch {
    data.alliance_count = null;
    data.horde_count = null;
  }

  // Class distribution
  try {
    const rows = await queryCharDb<{ cls: number; cnt: number }>(
      realmId,
      "SELECT `class` AS cls, COUNT(*) AS cnt FROM characters GROUP BY `class` ORDER BY cnt DESC"
    );
    data.class_distribution = rows.map((r) => ({
      class: CLASS_NAMES[r.cls] ?? `Unknown(${r.cls})`,
      count: Number(r.cnt),
    }));
  } catch {
    data.class_distribution = null;
  }

  // Race distribution
  try {
    const rows = await queryCharDb<{ race: number; cnt: number }>(
      realmId,
      "SELECT race, COUNT(*) AS cnt FROM characters GROUP BY race ORDER BY cnt DESC"
    );
    data.race_distribution = rows.map((r) => ({
      race: RACE_NAMES[r.race] ?? `Unknown(${r.race})`,
      count: Number(r.cnt),
    }));
  } catch {
    data.race_distribution = null;
  }

  // Guild count
  try {
    const rows = await queryCharDb<{ cnt: number }>(
      realmId,
      "SELECT COUNT(*) AS cnt FROM guild"
    );
    data.total_guilds = rows[0]?.cnt ?? 0;
  } catch {
    data.total_guilds = null;
  }

  return data;
}

export async function GET() {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  const cached = getCache("dashboard");
  if (cached) return NextResponse.json(cached);

  // Shared account metrics
  const shared: Record<string, unknown> = {};
  try {
    const rows = await query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM ${DB_REALMD}.account a WHERE ${IS_PLAYER}`
    );
    shared.total_accounts = rows[0]?.cnt ?? 0;
  } catch {
    shared.total_accounts = null;
  }

  // Per-realm data
  let realmRows: Array<{ id: number; name: string }> = [];
  try {
    realmRows = await query<{ id: number; name: string }>(
      `SELECT id, name FROM ${DB_REALMD}.realmlist ORDER BY id`
    );
  } catch {
    // No realms yet
  }

  const realms: Record<number, unknown> = {};
  for (const r of realmRows) {
    const data = await getRealmDashboard(r.id);
    realms[r.id] = { ...data, id: r.id, name: r.name };
  }

  const payload = { shared, realms };
  setCache("dashboard", payload, 10000); // 10s cache
  return NextResponse.json(payload);
}
