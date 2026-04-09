import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { queryCharDb, RACE_NAMES, CLASS_NAMES, ALLIANCE_RACES } from "@/lib/db-realm";
import { query, DB_REALMD } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Search across realm 1 (default) — can be extended to multi-realm
  const realmId = parseInt(req.nextUrl.searchParams.get("realm") ?? "1");

  try {
    const rows = await queryCharDb<{
      guid: number; name: string; level: number; race: number;
      cls: number; online: number; account: number;
    }>(
      realmId,
      `SELECT c.guid, c.name, c.level, c.race, c.\`class\` AS cls, c.online, c.account
       FROM characters c
       WHERE LOWER(c.name) LIKE LOWER(?)
       ORDER BY c.level DESC LIMIT 20`,
      [`%${q}%`]
    );

    // Get usernames for bot detection
    const accountIds = [...new Set(rows.map((r) => r.account))];
    const usernameMap: Record<number, string> = {};
    if (accountIds.length > 0) {
      const placeholders = accountIds.map(() => "?").join(",");
      const accRows = await query<{ id: number; username: string }>(
        `SELECT id, username FROM ${DB_REALMD}.account WHERE id IN (${placeholders})`,
        accountIds
      );
      for (const a of accRows) usernameMap[a.id] = a.username;
    }

    const results = rows.map((r) => ({
      guid: r.guid,
      name: r.name,
      level: r.level,
      race: RACE_NAMES[r.race] ?? `Unknown(${r.race})`,
      race_id: r.race,
      class: CLASS_NAMES[r.cls] ?? `Unknown(${r.cls})`,
      class_id: r.cls,
      online: Boolean(r.online),
      is_bot: (usernameMap[r.account] ?? "").startsWith("RNDBOT"),
      faction: ALLIANCE_RACES.has(r.race) ? "Alliance" : "Horde",
      realm_id: realmId,
    }));

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message ?? "Search failed" }, { status: 500 });
  }
}
