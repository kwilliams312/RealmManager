import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { startRealm, ensureRealmConfig } from "@/lib/docker";
import { executeDb, query, DB_REALMD } from "@/lib/db";
import { charDb, worldDb } from "@/lib/db-realm";
import { getRealmActiveBuild, isRealmRemote, getSourceBySlug } from "@/lib/build-sources-db";
import { getBuild } from "@/lib/builds-db";
import { imageRef, dbImportRef } from "@/lib/build-pipeline";
import { generateRealmCompose, buildManifestEnv, dbImportImageTag } from "@/lib/realm-compose";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";

interface Params { params: Promise<{ realmId: string }>; }

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { realmId } = await params;
  const id = parseInt(realmId);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid realm ID" }, { status: 400 });

  if (await isRealmRemote(id))
    return NextResponse.json({ error: "Cannot start a remote realm" }, { status: 400 });

  try {
    // Create per-realm databases if they don't exist (first start)
    const charDatabase = charDb(id);
    const worldDatabase = worldDb(id);
    try {
      await executeDb(DB_REALMD, `CREATE DATABASE IF NOT EXISTS \`${charDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, []);
      await executeDb(DB_REALMD, `CREATE DATABASE IF NOT EXISTS \`${worldDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, []);
    } catch { /* may already exist */ }

    // Create extra databases declared in source manifest and import SQL if needed
    const activeBuildIdForDb = await getRealmActiveBuild(id);
    if (activeBuildIdForDb) {
      const buildForDb = await getBuild(activeBuildIdForDb);
      if (buildForDb) {
        const sourceForDb = await getSourceBySlug(buildForDb.source_id);
        const extraDbs = sourceForDb?.sourceManifest?.databases ?? [];
        const dbImportImage = dbImportImageTag(imageRef(buildForDb.image_tag));
        const dbHost = process.env.DB_HOST ?? "ac-database";
        const dbPort = process.env.DB_PORT ?? "3306";
        const composeProject = process.env.COMPOSE_PROJECT ?? "realmmanager";

        for (const db of extraDbs) {
          const dbName = `acore_${db.name}_${id}`;
          try {
            await executeDb(DB_REALMD, `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, []);
          } catch { /* may already exist */ }

          // Import SQL from db-import image if database is empty and importSqlFrom is set
          if (db.importSqlFrom) {
            try {
              const tables = await query<{ cnt: number }>(
                `SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`, [dbName]
              );
              if ((tables[0]?.cnt ?? 0) === 0) {
                console.log(`[realm ${id}] Importing SQL for ${dbName} from ${db.importSqlFrom}...`);
                await exec("docker", [
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
                console.log(`[realm ${id}] SQL import for ${dbName} complete.`);
              }
            } catch (err) {
              console.error(`[realm ${id}] SQL import for ${dbName} failed:`, err);
            }
          }
        }
      }
    }

    // Ensure config files exist and compose is up-to-date
    const activeBuildId = await getRealmActiveBuild(id);
    if (activeBuildId) {
      const build = await getBuild(activeBuildId);
      if (build) {
        const fullRef = imageRef(build.image_tag);
        const source = await getSourceBySlug(build.source_id);

        // Regenerate compose to ensure host paths are current
        const realmDir = join(DATA_DIR, String(id));
        await mkdir(realmDir, { recursive: true });
        const manifestEnv = buildManifestEnv(source?.sourceManifest, id, build.source_id);
        const compose = generateRealmCompose(id, fullRef, source ? {
          configPath: source.configPath,
          dataPath: source.dataPath,
          logsPath: source.logsPath,
        } : undefined, manifestEnv);
        await writeFile(join(realmDir, "docker-compose.yml"), compose);

        await ensureRealmConfig(id, fullRef, source?.refConfigPath);
      }
    }

    await startRealm(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message ?? String(err);
    // Split compose error from container logs if present
    const sep = "--- Container logs ---";
    const sepIdx = msg.indexOf(sep);
    if (sepIdx !== -1) {
      const error = msg.slice(0, sepIdx).trim();
      const logs = msg.slice(sepIdx + sep.length).trim();
      return NextResponse.json({ error, logs }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
