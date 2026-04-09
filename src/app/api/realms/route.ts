import { NextRequest, NextResponse } from "next/server";
import { requireLogin, requireAdmin } from "@/lib/auth";
import { query, executeDb, DB_REALMD } from "@/lib/db";
import { getRealmActiveBuild, getRealmRemoteConfig } from "@/lib/build-sources-db";

interface RealmRow {
  id: number;
  name: string;
  address: string;
  localAddress: string;
  localSubnetMask: string;
  port: number;
  icon: number;
  flag: number;
  timezone: number;
  allowedSecurityLevel: number;
  population: number;
  gamebuild: number;
}

export async function GET() {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  try {
    const rows = await query<RealmRow>(
      `SELECT id, name, address, localAddress, localSubnetMask, port, icon, flag,
              timezone, allowedSecurityLevel, population, gamebuild
       FROM ${DB_REALMD}.realmlist ORDER BY id`
    );

    const realms = await Promise.all(rows.map(async (r) => {
      const [activeBuildId, remoteConfig] = await Promise.all([
        getRealmActiveBuild(r.id),
        getRealmRemoteConfig(r.id),
      ]);
      return {
        ...r,
        population: Number(r.population),
        active_build_id: activeBuildId,
        is_remote: remoteConfig.isRemote,
        ra_host: remoteConfig.raHost,
        ra_port: remoteConfig.raPort,
        ra_user: remoteConfig.raUser,
        // Never send ra_pass to the client — mask it
        ra_pass: remoteConfig.raPass ? "••••••••" : null,
      };
    }));

    return NextResponse.json({ realms });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: {
    name?: string;
    buildId?: number;
    isRemote?: boolean;
    address?: string;
    port?: number;
    raHost?: string;
    raPort?: number;
    raUser?: string;
    raPass?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name || "New Realm";
  const isRemote = body.isRemote === true;

  // Use the host from the request as the default realm address
  const hostHeader = req.headers.get("host") ?? "127.0.0.1";
  const serverAddress = hostHeader.split(":")[0];

  if (isRemote) {
    // Remote realm: address is required, no build needed
    const address = body.address;
    if (!address) {
      return NextResponse.json({ error: "Address is required for remote realms" }, { status: 400 });
    }
    const port = body.port ?? 8085;

    try {
      const result = await executeDb(
        DB_REALMD,
        `INSERT INTO realmlist (name, address, localAddress, port, icon, flag, timezone, gamebuild)
         VALUES (?, ?, ?, ?, 0, 2, 1, 12340)`,
        [name, address, address, port]
      );
      const newId = result.insertId;

      // Create realm_source row with is_remote flag and RA credentials
      const { setRealmActiveBuild } = await import("@/lib/build-sources-db");
      await setRealmActiveBuild(newId, null);
      await executeDb(
        DB_REALMD,
        `UPDATE realm_source SET is_remote = 1, ra_host = ?, ra_port = ?, ra_user = ?, ra_pass = ? WHERE realmid = ?`,
        [body.raHost || address, body.raPort ?? 3443, body.raUser || null, body.raPass || null, newId]
      );

      return NextResponse.json({ success: true, id: newId }, { status: 201 });
    } catch (err) {
      console.error("Remote realm creation failed:", err);
      return NextResponse.json({ error: "Failed to create realm" }, { status: 500 });
    }
  }

  // Local realm: either a build or an image source is required
  const buildId = body.buildId;
  const sourceIdParam = (body as { sourceId?: string }).sourceId;

  let realmImageTag: string;
  let realmSourceId: string;
  let activeBuildId: number | null = null;
  let sourcePaths: { configPath: string; dataPath: string; logsPath: string } | undefined;

  if (sourceIdParam) {
    // Image source: use the image directly (no build needed)
    const { getSourceBySlug } = await import("@/lib/build-sources-db");
    const source = await getSourceBySlug(sourceIdParam);
    if (!source || source.sourceType !== "image") {
      return NextResponse.json({ error: "Invalid image source" }, { status: 400 });
    }
    realmImageTag = `${source.imageName}:${source.imageTag}`;
    realmSourceId = source.sourceId;
    sourcePaths = { configPath: source.configPath, dataPath: source.dataPath, logsPath: source.logsPath };
  } else if (buildId) {
    // Git source build: verify build exists and is successful
    const { getBuild } = await import("@/lib/builds-db");
    const build = await getBuild(buildId);
    if (!build || build.status !== "success") {
      return NextResponse.json({ error: "Invalid or unsuccessful build" }, { status: 400 });
    }
    const { imageRef } = await import("@/lib/build-pipeline");
    realmImageTag = imageRef(build.image_tag);
    realmSourceId = build.source_id;
    activeBuildId = buildId;
    // Look up source for container paths
    const { getSourceBySlug } = await import("@/lib/build-sources-db");
    const source = await getSourceBySlug(build.source_id);
    if (source) {
      sourcePaths = { configPath: source.configPath, dataPath: source.dataPath, logsPath: source.logsPath };
    }
  } else {
    return NextResponse.json({ error: "A build or image source must be selected" }, { status: 400 });
  }

  try {
    const result = await executeDb(
      DB_REALMD,
      `INSERT INTO realmlist (name, address, localAddress, port, icon, flag, timezone, gamebuild)
       VALUES (?, ?, ?, 8085, 0, 2, 1, 12340)`,
      [name, serverAddress, serverAddress]
    );
    const newId = result.insertId;

    // Set port to match Docker host mapping
    const hostPort = 8085 + newId - 1;
    await executeDb(DB_REALMD, `UPDATE realmlist SET port = ? WHERE id = ?`, [hostPort, newId]);

    // Set active build for this realm (null for image sources)
    const { setRealmActiveBuild } = await import("@/lib/build-sources-db");
    await setRealmActiveBuild(newId, activeBuildId);

    // Generate compose file and copy config template
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { generateRealmCompose, buildManifestEnv } = await import("@/lib/realm-compose");
    const { copyConfigToRealm } = await import("@/lib/build-pipeline");

    const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";
    const realmDir = join(DATA_DIR, String(newId));
    await mkdir(join(realmDir, "etc", "modules"), { recursive: true });
    await mkdir(join(realmDir, "logs"), { recursive: true });

    // Fetch source manifest for env var and DB creation
    const { getSourceBySlug: getSourceForManifest } = await import("@/lib/build-sources-db");
    const sourceForManifest = realmSourceId ? await getSourceForManifest(realmSourceId) : null;
    const manifestEnv = buildManifestEnv(sourceForManifest?.sourceManifest, newId, realmSourceId ?? "");

    // Create extra databases from manifest and import SQL if needed
    const extraDbs = sourceForManifest?.sourceManifest?.databases ?? [];
    if (extraDbs.length > 0) {
      const { dbImportImageTag } = await import("@/lib/realm-compose");
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(execFile);
      const dbHost = process.env.DB_HOST ?? "ac-database";
      const dbPort = process.env.DB_PORT ?? "3306";
      const composeProject = process.env.COMPOSE_PROJECT ?? "realmmanager";
      const dbImportImage = dbImportImageTag(realmImageTag);

      for (const db of extraDbs) {
        const dbName = `acore_${db.name}_${newId}`;
        try {
          await executeDb(DB_REALMD, `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, []);
        } catch { /* may already exist */ }

        if (db.importSqlFrom) {
          try {
            console.log(`[realm ${newId}] Importing SQL for ${dbName} from ${db.importSqlFrom}...`);
            await execAsync("docker", [
              "run", "--rm",
              "--network", `${composeProject}_ac-network`,
              "--entrypoint", "sh",
              dbImportImage,
              "-c",
              `for f in ${db.importSqlFrom}/*.sql; do [ -f "$f" ] && mysql -h ${dbHost} -P ${dbPort} -uroot -p"$MYSQL_PWD" ${dbName} < "$f"; done`,
            ], {
              env: { ...process.env, MYSQL_PWD: process.env.DB_ROOT_PASS ?? process.env.DB_PASS ?? "password" },
              timeout: 120_000,
            });
            console.log(`[realm ${newId}] SQL import for ${dbName} complete.`);
          } catch (err) {
            console.error(`[realm ${newId}] SQL import for ${dbName} failed:`, err);
          }
        }
      }
    }

    const compose = generateRealmCompose(newId, realmImageTag, sourcePaths, manifestEnv);
    await writeFile(join(realmDir, "docker-compose.yml"), compose);

    // Copy config template from the build's source (best-effort for image sources)
    await copyConfigToRealm(realmSourceId, newId);

    return NextResponse.json({ success: true, id: newId }, { status: 201 });
  } catch (err) {
    console.error("Realm creation failed:", err);
    return NextResponse.json({ error: "Failed to create realm" }, { status: 500 });
  }
}
