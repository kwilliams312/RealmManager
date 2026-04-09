import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_DIR = process.env.CONFIG_DIR ?? "/data/etc";
const AUTH_CONF_PATH = join(CONFIG_DIR, "authserver.conf");

/** GET /api/settings/auth-config — read authserver.conf (admin only). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const content = await readFile(AUTH_CONF_PATH, "utf8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json(
      { error: "authserver.conf not found" },
      { status: 404 }
    );
  }
}

/** PUT /api/settings/auth-config — write authserver.conf (admin only). */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "content required" },
      { status: 400 }
    );
  }

  try {
    await writeFile(AUTH_CONF_PATH, body.content, "utf8");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { error: e.message ?? "Failed to save config" },
      { status: 500 }
    );
  }
}
