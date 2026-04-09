import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { query, DB_REALMD } from "@/lib/db";
import { queryCharDb, charDb } from "@/lib/db-realm";
import { executeDb } from "@/lib/db";

const SERVICE_FLAGS: Record<string, number> = {
  faction_change: 0x40, // AT_LOGIN_CHANGE_FACTION
  race_change: 0x80,    // AT_LOGIN_CHANGE_RACE
  sex_change: 0x08,     // AT_LOGIN_CUSTOMIZE
};

interface CharRow {
  guid: number;
  online: number;
  at_login: number;
}

/** POST /api/my/characters/service — apply a character service (at_login flag). */
export async function POST(req: NextRequest) {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  let body: { guid?: number; realmId?: number; service?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { guid, realmId, service } = body;
  if (
    typeof guid !== "number" || !Number.isInteger(guid) || guid < 1 ||
    typeof realmId !== "number" || !Number.isInteger(realmId) || realmId < 1 ||
    !service
  ) {
    return NextResponse.json(
      { error: "Valid guid, realmId, and service are required" },
      { status: 400 }
    );
  }

  const VALID_SERVICES = new Set(Object.keys(SERVICE_FLAGS));
  if (!VALID_SERVICES.has(service)) {
    return NextResponse.json(
      { error: `Unknown service: ${service}` },
      { status: 400 }
    );
  }

  const flag = SERVICE_FLAGS[service];
  if (!flag) {
    return NextResponse.json(
      { error: `Unknown service: ${service}` },
      { status: 400 }
    );
  }

  // Step 1: Validate realm exists
  try {
    const realms = await query<{ id: number }>(
      `SELECT id FROM ${DB_REALMD}.realmlist WHERE id = ?`,
      [realmId]
    );
    if (!realms.length) {
      return NextResponse.json(
        { error: "Realm not found" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to validate realm" },
      { status: 500 }
    );
  }

  // Step 2: Verify character exists AND ownership (defense-in-depth)
  const accountId = auth.session.userId;
  let character: CharRow;
  try {
    const chars = await queryCharDb<CharRow>(
      realmId,
      `SELECT guid, online, at_login FROM characters WHERE guid = ? AND account = ?`,
      [guid, accountId]
    );
    if (!chars.length) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }
    character = chars[0];
  } catch {
    return NextResponse.json(
      { error: "Failed to load character" },
      { status: 500 }
    );
  }

  // Step 3: Verify offline
  if (character.online !== 0) {
    return NextResponse.json(
      { error: "Character must be offline to apply this service" },
      { status: 409 }
    );
  }

  // Step 4: Check if flag already pending
  if ((character.at_login & flag) !== 0) {
    return NextResponse.json(
      { error: "This service is already pending for this character" },
      { status: 409 }
    );
  }

  // Step 5: Apply flag using bitwise OR
  try {
    await executeDb(
      charDb(realmId),
      `UPDATE characters SET at_login = at_login | ? WHERE guid = ? AND account = ?`,
      [flag, guid, accountId]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to apply character service:", err);
    return NextResponse.json(
      { error: "Failed to apply service" },
      { status: 500 }
    );
  }
}
