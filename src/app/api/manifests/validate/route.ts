import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { parseManifest } from "@/lib/manifest";

/** POST /api/manifests/validate — validate a manifest YAML without saving */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: { manifest?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.manifest?.trim()) {
    return NextResponse.json({ error: "manifest is required" }, { status: 400 });
  }

  try {
    parseManifest(body.manifest);
    return NextResponse.json({ valid: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
