import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateSource, deleteSource, getSourceBySlug } from "@/lib/build-sources-db";
import { getBuildsForSource, deleteBuildsForSource } from "@/lib/builds-db";
import { cleanupSourceArtifacts } from "@/lib/build-pipeline";
import { parseManifest, getPreset } from "@/lib/manifest";

interface Params { params: Promise<{ sourceId: string }>; }

/** PUT /api/builds/sources/{sourceId} — update a source */
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { sourceId } = await params;

  const existing = await getSourceBySlug(sourceId);
  if (!existing) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  let body: {
    name?: string;
    url?: string;
    defaultBranch?: string;
    githubTokenId?: number | null;
    sourceType?: "image" | "git";
    imageName?: string | null;
    imageTag?: string;
    manifest?: string;
    manifestPreset?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Parse manifest update if provided
  const updates: Parameters<typeof updateSource>[1] = {
    name: body.name,
    url: body.url,
    defaultBranch: body.defaultBranch,
    githubTokenId: body.githubTokenId,
    sourceType: body.sourceType,
    imageName: body.imageName,
    imageTag: body.imageTag,
  };

  if (body.manifestPreset !== undefined) {
    const preset = getPreset(body.manifestPreset);
    if (!preset) {
      return NextResponse.json({ error: `Unknown preset: ${body.manifestPreset}` }, { status: 400 });
    }
    updates.sourceManifest = preset;
  } else if (body.manifest !== undefined) {
    if (body.manifest === "") {
      updates.sourceManifest = null;
    } else {
      try {
        updates.sourceManifest = parseManifest(body.manifest);
      } catch (err) {
        return NextResponse.json({ error: `Invalid manifest: ${(err as Error).message}` }, { status: 400 });
      }
    }
  }

  await updateSource(sourceId, updates);
  return NextResponse.json({ success: true });
}

/** DELETE /api/builds/sources/{sourceId} — remove a source */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { sourceId } = await params;

  // Check for in-progress builds
  const builds = await getBuildsForSource(sourceId);
  if (builds.some((b) => b.status === "building")) {
    return NextResponse.json({ error: "Cannot delete source while a build is in progress" }, { status: 400 });
  }

  // Check if any builds from this source are in use by realms
  const { getBuildUsageByRealms } = await import("@/lib/builds-db");
  for (const build of builds) {
    const realmNames = await getBuildUsageByRealms(build.id);
    if (realmNames.length > 0) {
      return NextResponse.json({
        error: `Source has builds in use by: ${realmNames.join(", ")}. Change those realms to a different build first.`,
      }, { status: 400 });
    }
  }

  // Delete build records and collect image tags for cleanup
  const imageTags = await deleteBuildsForSource(sourceId);

  const deleted = await deleteSource(sourceId);
  if (!deleted) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  // Clean up filesystem and Docker images in the background
  cleanupSourceArtifacts(sourceId, imageTags).catch(() => {});

  return NextResponse.json({ success: true });
}
