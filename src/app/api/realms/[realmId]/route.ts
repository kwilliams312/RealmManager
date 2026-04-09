import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query, executeDb, DB_REALMD } from "@/lib/db";

interface Params {
  params: Promise<{ realmId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);

  try {
    const rows = await query(
      `SELECT * FROM ${DB_REALMD}.realmlist WHERE id = ?`,
      [id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Realm not found" }, { status: 404 });
    }
    return NextResponse.json({ realm: rows[0] });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ALLOWED_FIELDS = new Set([
    "name", "address", "localAddress", "localSubnetMask",
    "port", "icon", "flag", "timezone", "allowedSecurityLevel", "gamebuild",
  ]);

  // Handle build change (buildId can be a number or null to clear)
  const hasBuildChange = "buildId" in body;
  const buildId = typeof body.buildId === "number" ? body.buildId : null;
  if (hasBuildChange && buildId !== null) {
    try {
      const { setRealmActiveBuild, getSourceBySlug } = await import("@/lib/build-sources-db");
      const { getBuild } = await import("@/lib/builds-db");
      const build = await getBuild(buildId);
      if (!build || build.status !== "success") {
        return NextResponse.json({ error: "Invalid or unsuccessful build" }, { status: 400 });
      }

      await setRealmActiveBuild(id, buildId);

      // Regenerate compose with new image
      const { generateRealmCompose, buildManifestEnv } = await import("@/lib/realm-compose");
      const { imageRef } = await import("@/lib/build-pipeline");
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";
      const realmDir = join(DATA_DIR, String(id));
      await mkdir(realmDir, { recursive: true });
      const source = await getSourceBySlug(build.source_id);
      const manifestEnv = buildManifestEnv(source?.sourceManifest, id, build.source_id);
      const compose = generateRealmCompose(id, imageRef(build.image_tag), source ? {
        configPath: source.configPath,
        dataPath: source.dataPath,
        logsPath: source.logsPath,
      } : undefined, manifestEnv);
      await writeFile(join(realmDir, "docker-compose.yml"), compose);
    } catch (err) {
      console.error("Build update failed:", err);
      return NextResponse.json({ error: "Failed to update build" }, { status: 500 });
    }
  } else if (hasBuildChange && buildId === null) {
    // Clearing build — only update if realm has a realm_source row
    try {
      const { setRealmActiveBuild } = await import("@/lib/build-sources-db");
      await setRealmActiveBuild(id, null);
    } catch {
      // No realm_source row (e.g. authserver-seeded realm) — not an error
    }
  }

  // Handle RA credential updates (remote realms)
  const RA_FIELDS = new Set(["ra_host", "ra_port", "ra_user", "ra_pass"]);
  const raUpdates = Object.entries(body).filter(([k]) => RA_FIELDS.has(k));
  if (raUpdates.length > 0) {
    try {
      const { setRealmRemoteConfig } = await import("@/lib/build-sources-db");
      const config: Record<string, unknown> = {};
      for (const [k, v] of raUpdates) {
        const key = k === "ra_host" ? "raHost" : k === "ra_port" ? "raPort" : k === "ra_user" ? "raUser" : "raPass";
        config[key] = v;
      }
      await setRealmRemoteConfig(id, config as { raHost?: string; raPort?: number; raUser?: string; raPass?: string });
    } catch {
      return NextResponse.json({ error: "Failed to update RA credentials" }, { status: 500 });
    }
  }

  const updates = Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k));
  if (updates.length === 0 && !hasBuildChange && raUpdates.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (updates.length > 0) {
    const setClauses = updates.map(([k]) => `\`${k}\` = ?`).join(", ");
    const values = updates.map(([, v]) => v);
    try {
      await executeDb(
        DB_REALMD,
        `UPDATE realmlist SET ${setClauses} WHERE id = ?`,
        [...values, id]
      );
    } catch {
      return NextResponse.json({ error: "Failed to update realm" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);

  let body: { confirm_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Realm name confirmation required" }, { status: 400 });
  }

  if (!body.confirm_name) {
    return NextResponse.json({ error: "Realm name confirmation required" }, { status: 400 });
  }

  let rows: Array<{ name: string }>;
  try {
    rows = await query<{ name: string }>(
      `SELECT name FROM ${DB_REALMD}.realmlist WHERE id = ?`,
      [id]
    );
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "Realm not found" }, { status: 404 });
  }

  if (rows[0].name !== body.confirm_name) {
    return NextResponse.json({ error: "Realm name does not match" }, { status: 400 });
  }

  try {
    // Gather source manifest info before deleting (for extra DB cleanup)
    const { getRealmActiveBuild, getSourceBySlug } = await import("@/lib/build-sources-db");
    const { getBuild } = await import("@/lib/builds-db");
    let extraDbNames: string[] = [];
    const activeBuildId = await getRealmActiveBuild(id);
    if (activeBuildId) {
      const build = await getBuild(activeBuildId);
      if (build) {
        const source = await getSourceBySlug(build.source_id);
        extraDbNames = (source?.sourceManifest?.databases ?? []).map(
          (db) => `acore_${db.name}_${id}`
        );
      }
    }

    await executeDb(DB_REALMD, `DELETE FROM realmlist WHERE id = ?`, [id]);

    // Clean up realm-build mapping
    try {
      await executeDb(DB_REALMD, `DELETE FROM realm_source WHERE realmid = ?`, [id]);
    } catch { /* may not exist */ }

    // Stop and remove all realm containers via docker compose down
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    const { rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dataDir = process.env.REALM_DATA_DIR ?? "/data/realms";
    const composePath = join(dataDir, String(id), "docker-compose.yml");

    try {
      await exec("docker", [
        "compose", "-p", `ac-realm-${id}`, "-f", composePath, "down", "--remove-orphans",
      ], { timeout: 30_000 });
    } catch { /* compose file may not exist */ }

    // Force-remove individual containers as fallback
    for (const name of [`ac-worldserver-${id}`, `ac-db-import-${id}`, `ac-client-data-init-${id}`]) {
      try { await exec("docker", ["rm", "-f", name]); } catch { /* may not exist */ }
    }

    // Drop per-realm databases
    const { charDb, worldDb } = await import("@/lib/db-realm");
    const dbsToDrop = [charDb(id), worldDb(id), ...extraDbNames];
    for (const dbName of dbsToDrop) {
      try {
        await executeDb(DB_REALMD, `DROP DATABASE IF EXISTS \`${dbName}\``, []);
      } catch { /* best-effort */ }
    }

    // Remove realm data directory
    try { await rm(join(dataDir, String(id)), { recursive: true, force: true }); } catch { /* best-effort */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete realm" }, { status: 500 });
  }
}
