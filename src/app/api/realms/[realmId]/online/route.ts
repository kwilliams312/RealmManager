import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { queryCharAuthDb, RACE_NAMES, CLASS_NAMES, ALLIANCE_RACES, IS_BOT, BOT_JOIN } from "@/lib/db-realm";
import { getCache, setCache } from "@/lib/cache";

interface Params {
  params: Promise<{ realmId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);

  const cacheKey = `online-${id}`;
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const rows = await queryCharAuthDb<{
      name: string; level: number; race: number; cls: number;
      zone: number; guild_name: string | null; is_bot: number;
    }>(
      id,
      `SELECT c.name, c.level, c.race, c.\`class\` AS cls, c.zone,
              g.name AS guild_name,
              CASE WHEN ${IS_BOT} THEN 1 ELSE 0 END AS is_bot
       FROM characters c
       ${BOT_JOIN}
       LEFT JOIN guild_member gm ON c.guid = gm.guid
       LEFT JOIN guild g ON gm.guildid = g.guildid
       WHERE c.online = 1
       ORDER BY c.level DESC, c.name`
    );

    const players = rows.map((r) => ({
      name: r.name,
      level: r.level,
      race: RACE_NAMES[r.race] ?? `Unknown(${r.race})`,
      class: CLASS_NAMES[r.cls] ?? `Unknown(${r.cls})`,
      faction: ALLIANCE_RACES.has(r.race) ? "Alliance" : "Horde",
      guild: r.guild_name ?? null,
      zone: r.zone, // zone name resolved client-side from zone-names.json
      is_bot: Boolean(r.is_bot),
    }));

    const payload = { players };
    setCache(cacheKey, payload, 5000);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Character database unavailable" }, { status: 503 });
  }
}
