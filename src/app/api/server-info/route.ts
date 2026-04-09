import { NextResponse } from "next/server";
import { query, DB_REALMD } from "@/lib/db";
import { queryCharDb } from "@/lib/db-realm";
import { IS_PLAYER } from "@/lib/db-realm";

export async function GET() {
  const info: Record<string, unknown> = {};

  // Total accounts (non-bot)
  try {
    const rows = await query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM ${DB_REALMD}.account a WHERE ${IS_PLAYER}`
    );
    info.total_accounts = rows[0]?.cnt ?? 0;
  } catch { info.total_accounts = 0; }

  // Characters online (realm 1 default)
  try {
    const rows = await queryCharDb<{ total: number; online: number }>(
      1,
      "SELECT COUNT(*) AS total, SUM(online) AS online FROM characters"
    );
    info.total_characters = rows[0]?.total ?? 0;
    info.players_online = Number(rows[0]?.online ?? 0);
  } catch { info.total_characters = 0; info.players_online = 0; }

  // Peak players
  try {
    const rows = await query<{ maxplayers: number }>(
      `SELECT maxplayers FROM ${DB_REALMD}.uptime ORDER BY starttime DESC LIMIT 1`
    );
    info.peak_players = rows[0]?.maxplayers ?? 0;
  } catch { info.peak_players = 0; }

  // Realm info
  try {
    const rows = await query<{ name: string; address: string }>(
      `SELECT name, address FROM ${DB_REALMD}.realmlist ORDER BY id LIMIT 1`
    );
    if (rows.length) { info.realm_name = rows[0].name; info.realm_address = rows[0].address; }
  } catch { /* ignore */ }

  return NextResponse.json(info);
}
