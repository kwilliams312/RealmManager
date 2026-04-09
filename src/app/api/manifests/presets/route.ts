import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPresetList } from "@/lib/manifest";

/** GET /api/manifests/presets — list all available manifest presets */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const presets = getPresetList();
  return NextResponse.json({ presets });
}
