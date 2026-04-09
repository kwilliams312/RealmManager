import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllSources, createSource, getSourceBySlug } from "@/lib/build-sources-db";
import { validateRepoUrl } from "@/lib/build-pipeline";
import { parseManifest, getPreset, serializeManifest } from "@/lib/manifest";

/** GET /api/builds/sources — list all sources */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sources = await getAllSources();
  // Include manifest as YAML string for the UI editor
  const sourcesWithYaml = sources.map((s) => ({
    ...s,
    manifestYaml: s.sourceManifest ? serializeManifest(s.sourceManifest) : null,
  }));
  return NextResponse.json({ sources: sourcesWithYaml });
}

/** POST /api/builds/sources — add a new source */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: {
    sourceId?: string;
    name?: string;
    url?: string;
    defaultBranch?: string;
    githubTokenId?: number | null;
    sourceType?: "image" | "git";
    imageName?: string;
    imageTag?: string;
    manifest?: string;
    manifestPreset?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sourceId, name, sourceType } = body;
  if (!sourceId || !name) {
    return NextResponse.json({ error: "sourceId and name are required" }, { status: 400 });
  }

  // Check uniqueness
  const existing = await getSourceBySlug(sourceId);
  if (existing) {
    return NextResponse.json({ error: `Source '${sourceId}' already exists` }, { status: 409 });
  }

  // Parse manifest if provided
  let sourceManifest = null;
  if (body.manifestPreset) {
    sourceManifest = getPreset(body.manifestPreset);
    if (!sourceManifest) {
      return NextResponse.json({ error: `Unknown preset: ${body.manifestPreset}` }, { status: 400 });
    }
  } else if (body.manifest) {
    try {
      sourceManifest = parseManifest(body.manifest);
    } catch (err) {
      return NextResponse.json({ error: `Invalid manifest: ${(err as Error).message}` }, { status: 400 });
    }
  }

  if (sourceType === "image") {
    // Image source: validate image name is provided
    if (!body.imageName) {
      return NextResponse.json({ error: "imageName is required for image sources" }, { status: 400 });
    }
    const id = await createSource(
      sourceId, name, "", "latest",
      null, "image", body.imageName, body.imageTag ?? "latest", sourceManifest
    );
    return NextResponse.json({ success: true, id }, { status: 201 });
  }

  // Git source: validate repo URL
  const url = body.url;
  if (!url) {
    return NextResponse.json({ error: "url is required for git sources" }, { status: 400 });
  }

  let token: string | undefined;
  if (body.githubTokenId) {
    const { getTokenSecret } = await import("@/lib/github-tokens-db");
    const tok = await getTokenSecret(body.githubTokenId);
    if (tok) token = tok.token;
  }

  const branch = body.defaultBranch ?? "master";
  const check = await validateRepoUrl(url, branch, token);
  if (!check.valid) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const id = await createSource(
    sourceId, name, url, branch,
    body.githubTokenId, "git", null, "latest", sourceManifest
  );
  return NextResponse.json({ success: true, id }, { status: 201 });
}
