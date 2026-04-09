import { NextRequest, NextResponse } from "next/server";
import { getBuildLog, isSourceBuilding } from "@/lib/build-state";

/**
 * GET /api/setup/build-status?sourceId=xxx
 * Public endpoint — returns build log and status during setup.
 * No auth required (setup page is unauthenticated).
 */
export async function GET(req: NextRequest) {
  const sourceId = req.nextUrl.searchParams.get("sourceId");
  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const building = isSourceBuilding(sourceId);
  const { status, log } = getBuildLog(sourceId);

  return NextResponse.json({
    building,
    status: status ?? (building ? "building" : "idle"),
    log: log ?? [],
  });
}
