import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateSource, deleteSource } from "@/lib/realm-sources-config-db";
import { deleteBuildsForSource } from "@/lib/builds-db";
import { cleanupSourceArtifacts } from "@/lib/build-pipeline";

interface Params {
  params: Promise<{ id: string }>;
}

/** PUT /api/settings/sources/[id] — update a source (admin only). */
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: {
    name?: string;
    url?: string;
    defaultBranch?: string;
    token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const updated = await updateSource(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { error: e.message ?? "Failed to update source" },
      { status: 500 }
    );
  }
}

/** DELETE /api/settings/sources/[id] — delete a source (admin only). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    // Delete build records and collect image tags for cleanup
    const imageTags = await deleteBuildsForSource(id);

    const deleted = await deleteSource(id);
    if (!deleted) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Clean up filesystem and Docker images in the background
    cleanupSourceArtifacts(id, imageTags).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { error: e.message ?? "Failed to delete source" },
      { status: 500 }
    );
  }
}
