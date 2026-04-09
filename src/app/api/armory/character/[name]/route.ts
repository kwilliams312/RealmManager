import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { queryCharDb, queryCharAuthDb, RACE_NAMES, CLASS_NAMES, ALLIANCE_RACES } from "@/lib/db-realm";
import { getCache, setCache } from "@/lib/cache";

interface Params { params: Promise<{ name: string }>; }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  const { name } = await params;
  const realmId = parseInt(req.nextUrl.searchParams.get("realm") ?? "1");
  const cacheKey = `armory:${realmId}:${name.toLowerCase()}`;

  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const chars = await queryCharAuthDb<{
      guid: number; name: string; level: number; race: number; cls: number;
      gender: number; online: number; totalKills: number; totalHonorPoints: number;
      arenaPoints: number; account: number; username: string;
    }>(
      realmId,
      `SELECT c.guid, c.name, c.level, c.race, c.\`class\` AS cls, c.gender,
              c.online, c.totalKills, c.totalHonorPoints, c.arenaPoints, c.account,
              a.username
       FROM characters c
       JOIN acore_auth.account a ON a.id = c.account
       WHERE LOWER(c.name) = LOWER(?)
       LIMIT 1`,
      [name]
    );

    if (!chars.length) return NextResponse.json({ error: "Character not found" }, { status: 404 });
    const char = chars[0];

    // Guild
    let guild: { name: string; rank: string } | null = null;
    try {
      const guildRows = await queryCharDb<{ guild_name: string; rank_name: string }>(
        realmId,
        `SELECT g.name AS guild_name, gr.name AS rank_name
         FROM guild_member gm
         JOIN guild g ON g.guildid = gm.guildid
         JOIN guild_rank gr ON gr.guildid = gm.guildid AND gr.rid = gm.rank
         WHERE gm.guid = ?`,
        [char.guid]
      );
      if (guildRows.length) guild = { name: guildRows[0].guild_name, rank: guildRows[0].rank_name };
    } catch { /* ignore */ }

    const result = {
      guid: char.guid,
      name: char.name,
      level: char.level,
      race: RACE_NAMES[char.race] ?? `Unknown(${char.race})`,
      race_id: char.race,
      class: CLASS_NAMES[char.cls] ?? `Unknown(${char.cls})`,
      class_id: char.cls,
      gender: char.gender,
      online: Boolean(char.online),
      total_kills: char.totalKills,
      honor_points: char.totalHonorPoints,
      arena_points: char.arenaPoints,
      faction: ALLIANCE_RACES.has(char.race) ? "Alliance" : "Horde",
      is_bot: char.username.startsWith("RNDBOT"),
      guild,
    };

    setCache(cacheKey, result, 15000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message ?? "Failed to load character" }, { status: 500 });
  }
}
