import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { queryCharDb, RACE_NAMES, CLASS_NAMES, ALLIANCE_RACES } from "@/lib/db-realm";
import { getCache, setCache } from "@/lib/cache";

interface Params {
  params: Promise<{ realmId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);

  const cacheKey = `guilds-${id}`;
  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached);

  let guildRows: Array<{ guildid: number; name: string; createdate: number; BankMoney: number; motd: string; info: string; leader_name: string | null }>;
  try {
    guildRows = await queryCharDb<{ guildid: number; name: string; createdate: number; BankMoney: number; motd: string; info: string; leader_name: string | null }>(
      id,
      `SELECT g.guildid, g.name, g.createdate, g.BankMoney, g.motd, g.info,
              c.name AS leader_name
       FROM guild g
       LEFT JOIN characters c ON c.guid = g.leaderguid
       ORDER BY g.name`
    );
  } catch {
    return NextResponse.json({ error: "Character database unavailable" }, { status: 503 });
  }

  // Fetch members for all guilds
  const guildIds = guildRows.map((g) => g.guildid);
  const membersByGuild: Record<number, unknown[]> = {};

  if (guildIds.length > 0) {
    try {
      const placeholders = guildIds.map(() => "?").join(",");
      const members = await queryCharDb<{ guildid: number; name: string; level: number; race: number; cls: number; online: number }>(
        id,
        `SELECT gm.guildid, c.name, c.level, c.race, c.\`class\` AS cls, c.online
         FROM guild_member gm
         JOIN characters c ON c.guid = gm.guid
         WHERE gm.guildid IN (${placeholders})
         ORDER BY c.level DESC, c.name`,
        guildIds
      );
      for (const m of members) {
        if (!membersByGuild[m.guildid]) membersByGuild[m.guildid] = [];
        membersByGuild[m.guildid].push({
          name: m.name,
          level: m.level,
          race: RACE_NAMES[m.race] ?? `Unknown(${m.race})`,
          class: CLASS_NAMES[m.cls] ?? `Unknown(${m.cls})`,
          online: Boolean(m.online),
          faction: ALLIANCE_RACES.has(m.race) ? "Alliance" : "Horde",
        });
      }
    } catch { /* ignore */ }
  }

  const guilds = guildRows.map((g) => ({
    id: g.guildid,
    name: g.name,
    leader: g.leader_name ?? "Unknown",
    motd: g.motd ?? "",
    info: g.info ?? "",
    members: membersByGuild[g.guildid] ?? [],
    member_count: (membersByGuild[g.guildid] ?? []).length,
    bank_gold: Math.floor((g.BankMoney ?? 0) / 10000),
    created: g.createdate,
  }));

  const payload = { guilds };
  setCache(cacheKey, payload, 15000);
  return NextResponse.json(payload);
}
