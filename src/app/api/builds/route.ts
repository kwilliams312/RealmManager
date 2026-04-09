import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllBuilds } from "@/lib/builds-db";
import { isSourceBuilding } from "@/lib/build-state";
import { startBuild } from "@/lib/build-pipeline";

/** GET /api/builds — list all builds */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const builds = await getAllBuilds();
  return NextResponse.json({ builds });
}

/** POST /api/builds — trigger a new build */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: { sourceId?: string; branch?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sourceId, branch } = body;
  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  if (isSourceBuilding(sourceId)) {
    return NextResponse.json({ error: "Build already in progress for this source" }, { status: 409 });
  }

  // Fire and forget — the build runs async
  startBuild(sourceId, branch).catch(console.error);

  return NextResponse.json({ success: true, message: "Build started" });
}
