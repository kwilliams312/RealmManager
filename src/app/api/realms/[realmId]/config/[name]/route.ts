import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = process.env.REALM_DATA_DIR ?? "/data/realms";

interface Params {
  params: Promise<{ realmId: string; name: string }>;
}

// authserver.conf is global — use /api/settings/auth-config instead
function configPath(realmId: number, name: string): string {
  return join(DATA_DIR, String(realmId), "etc", `${name}.conf`);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId, name } = await params;
  const id = parseInt(realmId);
  const path = configPath(id, name);

  try {
    const content = await readFile(path, "utf8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: `Config file not found: ${name}.conf` }, { status: 404 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId, name } = await params;
  const id = parseInt(realmId);

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const path = configPath(id, name);

  try {
    await writeFile(path, body.content, "utf8");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message ?? "Failed to save config" }, { status: 500 });
  }
}
