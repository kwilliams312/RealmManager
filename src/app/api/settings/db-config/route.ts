import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readSettings, writeSettings } from "@/lib/settings";
import type { DbSettings } from "@/lib/settings";

/** GET /api/settings/db-config — read DB settings (admin only). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const settings = readSettings();
  return NextResponse.json({ db: settings.db });
}

/** PUT /api/settings/db-config — save DB settings (admin only). */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: { db?: Partial<DbSettings> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.db) {
    return NextResponse.json(
      { error: "db object required" },
      { status: 400 }
    );
  }

  const current = readSettings();
  const merged = {
    ...current,
    db: { ...current.db, ...body.db },
  };

  try {
    writeSettings(merged);
    return NextResponse.json({ success: true, db: merged.db });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { error: e.message ?? "Failed to save settings" },
      { status: 500 }
    );
  }
}
