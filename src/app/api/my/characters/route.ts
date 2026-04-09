import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { query, DB_REALMD } from "@/lib/db";
import { queryCharDb, RACE_NAMES, CLASS_NAMES, ALLIANCE_RACES } from "@/lib/db-realm";

interface CharRow {
  guid: number;
  name: string;
  level: number;
  race: number;
  cls: number;
  gender: number;
  online: number;
  at_login: number;
}

interface RealmRow {
  id: number;
  name: string;
}

export interface MyCharacter {
  guid: number;
  name: string;
  level: number;
  race: number;
  raceName: string;
  class: number;
  className: string;
  gender: number;
  faction: "Alliance" | "Horde";
  online: boolean;
  realmId: number;
  realmName: string;
  atLogin: number;
}

/** GET /api/my/characters — list all characters for the logged-in user across all realms. */
export async function GET() {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  const accountId = auth.session.userId;
  const characters: MyCharacter[] = [];

  try {
    const realms = await query<RealmRow>(
      `SELECT id, name FROM ${DB_REALMD}.realmlist ORDER BY id`
    );

    for (const realm of realms) {
      try {
        const chars = await queryCharDb<CharRow>(
          realm.id,
          `SELECT c.guid, c.name, c.level, c.race, c.\`class\` AS cls,
                  c.gender, c.online, c.at_login
           FROM characters c
           WHERE c.account = ?
           ORDER BY c.level DESC, c.name`,
          [accountId]
        );

        for (const c of chars) {
          characters.push({
            guid: c.guid,
            name: c.name,
            level: c.level,
            race: c.race,
            raceName: RACE_NAMES[c.race] ?? `Unknown(${c.race})`,
            class: c.cls,
            className: CLASS_NAMES[c.cls] ?? `Unknown(${c.cls})`,
            gender: c.gender,
            faction: ALLIANCE_RACES.has(c.race) ? "Alliance" : "Horde",
            online: c.online === 1,
            realmId: realm.id,
            realmName: realm.name,
            atLogin: c.at_login,
          });
        }
      } catch {
        // Realm DB may not exist yet — skip silently
      }
    }

    return NextResponse.json({ characters });
  } catch (err: unknown) {
    console.error("Failed to fetch characters:", err);
    return NextResponse.json(
      { error: "Failed to load characters" },
      { status: 500 }
    );
  }
}
