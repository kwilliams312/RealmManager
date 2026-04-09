import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { parseConf, renderConf } from "@/lib/worldserver-config";
import { DIRECTIVE_BY_KEY } from "@/data/worldserver-schema";

const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";
const SHARED_ETC = process.env.CONFIG_DIR ?? "/data/etc";

interface Params {
  params: Promise<{ realmId: string }>;
}

function realmEtcDir(realmId: number): string {
  return join(DATA_DIR, String(realmId), "etc");
}

/**
 * Resolve the path to the realm's worldserver.conf.dist, seeding it from the
 * shared etc dir on first access if necessary. Returns null if neither the
 * realm-local nor the shared location has a .dist file (the realm hasn't been
 * built yet).
 *
 * **Side effect:** This function writes to disk on first access (mkdir +
 * copyFile). This matches the "seed on read" pattern already used by the
 * existing `/api/realms/[realmId]/config` route and is safe because:
 *
 *  - Both GET and PUT are behind `requireAdmin()`, so only authenticated
 *    admins can trigger the seed.
 *  - The seed is idempotent — subsequent reads take the fast path.
 *  - The target directory is always inside `REALM_DATA_DIR/{realmId}/etc/`,
 *    which is owned by RealmManager.
 */
async function resolveDistPath(realmId: number): Promise<string | null> {
  const etcDir = realmEtcDir(realmId);
  const realmDist = join(etcDir, "worldserver.conf.dist");

  // Fast path: realm already has it
  try {
    await readFile(realmDist);
    return realmDist;
  } catch {
    // Fall through to seeding
  }

  // Try to seed from shared etc (only if the source file exists)
  const sharedDist = join(SHARED_ETC, "worldserver.conf.dist");
  try {
    await readFile(sharedDist);
  } catch {
    return null;
  }

  await mkdir(etcDir, { recursive: true });
  await copyFile(sharedDist, realmDist);
  return realmDist;
}

/** Path to the realm's worldserver.conf (user-modified file). */
function confPath(realmId: number): string {
  return join(realmEtcDir(realmId), "worldserver.conf");
}

/** Read the realm's current conf values. Prefer worldserver.conf, fall back to .dist. */
async function readCurrentValues(realmId: number): Promise<Record<string, string> | null> {
  const distPath = await resolveDistPath(realmId);
  if (!distPath) return null;

  // Prefer the user-modified conf; fall back to .dist for defaults
  try {
    const content = await readFile(confPath(realmId), "utf8");
    return parseConf(content);
  } catch {
    const content = await readFile(distPath, "utf8");
    return parseConf(content);
  }
}

/**
 * Validate a values payload against the schema constraints for every curated
 * directive type: number (min/max), select (must match an allowed option),
 * and boolean (must be 0/1/true/false). Non-curated directives pass through
 * untouched since the schema has no constraints for them.
 *
 * Returns an array of field errors, or an empty array if valid.
 */
function validateValues(values: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const [key, rawValue] of Object.entries(values)) {
    const directive = DIRECTIVE_BY_KEY.get(key);
    if (!directive) continue; // non-curated directives pass through untouched

    switch (directive.type) {
      case "number": {
        const num = Number(rawValue);
        if (Number.isNaN(num)) {
          errors.push(`${key}: must be a number`);
          break;
        }
        if (directive.min !== undefined && num < directive.min) {
          errors.push(`${key}: must be >= ${directive.min}`);
        }
        if (directive.max !== undefined && num > directive.max) {
          errors.push(`${key}: must be <= ${directive.max}`);
        }
        break;
      }
      case "boolean": {
        const v = rawValue;
        const valid =
          typeof v === "boolean" ||
          v === "0" ||
          v === "1" ||
          v === "true" ||
          v === "false" ||
          v === 0 ||
          v === 1;
        if (!valid) {
          errors.push(`${key}: must be 0, 1, true, or false`);
        }
        break;
      }
      case "select": {
        const allowed = directive.options ?? [];
        const asString = String(rawValue);
        const matched = allowed.some((opt) => String(opt.value) === asString);
        if (!matched) {
          errors.push(
            `${key}: must be one of ${allowed.map((o) => String(o.value)).join(", ")}`,
          );
        }
        break;
      }
      // Strings are free-form — no validation. The conf writer quotes as-is.
    }
  }
  return errors;
}

/**
 * Coerce incoming form values to the string representation expected by the
 * conf writer. Booleans become "0" / "1", numbers become decimal strings,
 * strings pass through unchanged.
 */
function coerceValues(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "boolean") {
      out[key] = value ? "1" : "0";
    } else if (typeof value === "number") {
      out[key] = String(value);
    } else if (value === null || value === undefined) {
      out[key] = "";
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid realm ID" }, { status: 400 });
  }

  const values = await readCurrentValues(id);
  if (!values) {
    return NextResponse.json(
      { error: "No worldserver.conf.dist found for this realm. Build the realm first." },
      { status: 404 },
    );
  }

  return NextResponse.json({ values });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid realm ID" }, { status: 400 });
  }

  let body: { values?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.values || typeof body.values !== "object") {
    return NextResponse.json({ error: "values object required" }, { status: 400 });
  }

  const errors = validateValues(body.values);
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
  }

  const distPath = await resolveDistPath(id);
  if (!distPath) {
    return NextResponse.json(
      { error: "No worldserver.conf.dist found for this realm. Build the realm first." },
      { status: 404 },
    );
  }

  // Read the .dist to use as the Nunjucks template base, merge user values with
  // any existing non-curated values from the current conf, then render.
  let distContent: string;
  try {
    distContent = await readFile(distPath, "utf8");
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message ?? "Failed to read .dist file" }, { status: 500 });
  }

  // Merge: start with current conf values (preserves non-curated edits), then
  // overlay the user's form values.
  const current = await readCurrentValues(id);
  const coerced = coerceValues(body.values);
  const merged: Record<string, string> = { ...(current ?? {}), ...coerced };

  let rendered: string;
  try {
    rendered = renderConf(distContent, merged);
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: `Render failed: ${e.message}` }, { status: 500 });
  }

  try {
    await writeFile(confPath(id), rendered, "utf8");
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message ?? "Failed to write conf" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
