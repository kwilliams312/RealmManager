import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readdir, readFile, mkdir, copyFile } from "node:fs/promises";
import { join, extname } from "node:path";

const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";
const SHARED_ETC = process.env.CONFIG_DIR ?? "/data/etc";

interface Params {
  params: Promise<{ realmId: string }>;
}

function realmEtcDir(realmId: number): string {
  return join(DATA_DIR, String(realmId), "etc");
}

/** List .conf files in a directory (excluding authserver). */
async function listConfFiles(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files.filter(
      (f) => extname(f) === ".conf" && !f.startsWith("authserver")
    );
  } catch {
    return [];
  }
}

/**
 * If the realm has no .conf files, copy defaults from the shared etc directory.
 * Also promotes .conf.dist files to .conf if no .conf version exists.
 */
async function seedRealmConfigs(realmId: number): Promise<void> {
  const etcDir = realmEtcDir(realmId);
  await mkdir(etcDir, { recursive: true });

  // Check shared etc for .conf and .conf.dist files
  let sharedFiles: string[];
  try {
    sharedFiles = await readdir(SHARED_ETC);
  } catch {
    return;
  }

  for (const file of sharedFiles) {
    if (file.startsWith("authserver")) continue;

    if (extname(file) === ".conf") {
      // Copy .conf if realm doesn't have it
      try {
        await readFile(join(etcDir, file));
      } catch {
        await copyFile(join(SHARED_ETC, file), join(etcDir, file));
      }
    } else if (file.endsWith(".conf.dist")) {
      // Promote .conf.dist → .conf if neither exists in realm dir
      const confName = file.replace(".dist", "");
      try {
        await readFile(join(etcDir, confName));
      } catch {
        try {
          await readFile(join(etcDir, file));
        } catch {
          await copyFile(join(SHARED_ETC, file), join(etcDir, confName));
        }
      }
    }
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);
  const etcDir = realmEtcDir(id);

  // Seed from shared etc if realm has no configs yet
  const existing = await listConfFiles(etcDir);
  if (existing.length === 0) {
    await seedRealmConfigs(id);
  }

  const configs: Record<string, string> = {};
  const files = await listConfFiles(etcDir);
  for (const file of files) {
    const name = file.replace(".conf", "");
    try {
      configs[name] = await readFile(join(etcDir, file), "utf8");
    } catch { /* ignore */ }
  }

  return NextResponse.json({ configs });
}
