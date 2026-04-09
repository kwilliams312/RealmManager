import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getBuild, deleteBuild, getBuildUsageByRealms } from "@/lib/builds-db";
import { getBuildLog } from "@/lib/build-state";
import { imageRef } from "@/lib/build-pipeline";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

interface Params { params: Promise<{ buildId: string }>; }

/** GET /api/builds/{buildId} — get build details + log */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { buildId } = await params;
  const id = parseInt(buildId);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid build ID" }, { status: 400 });

  const build = await getBuild(id);
  if (!build) return NextResponse.json({ error: "Build not found" }, { status: 404 });

  // If build is in progress, return live log from memory
  if (build.status === "building") {
    const live = getBuildLog(build.source_id);
    return NextResponse.json({ build: { ...build, build_log: live.log }, live: true });
  }

  return NextResponse.json({ build, live: false });
}

/** DELETE /api/builds/{buildId} — remove a build */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { buildId } = await params;
  const id = parseInt(buildId);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid build ID" }, { status: 400 });

  const build = await getBuild(id);
  if (!build) return NextResponse.json({ error: "Build not found" }, { status: 404 });

  if (build.status === "building") {
    return NextResponse.json({ error: "Cannot delete an in-progress build" }, { status: 400 });
  }

  // Check realm usage
  const realmNames = await getBuildUsageByRealms(id);
  if (realmNames.length > 0) {
    return NextResponse.json({
      error: `Build in use by: ${realmNames.join(", ")}. Change those realms to a different build first.`,
    }, { status: 400 });
  }

  // Remove Docker image
  if (build.status === "success") {
    try { await exec("docker", ["rmi", imageRef(build.image_tag)]); } catch { /* may not exist */ }
  }

  await deleteBuild(id);
  return NextResponse.json({ success: true });
}
