import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getAllSourceConfigs,
  createSource,
} from "@/lib/realm-sources-config-db";
import { validateRepoUrl } from "@/lib/build-pipeline";

/** GET /api/settings/sources — list all sources with masked tokens (admin only). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const sources = await getAllSourceConfigs();
  return NextResponse.json({ sources });
}

/** POST /api/settings/sources — create a new source (admin only). */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: {
    id?: string;
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

  if (!body.id || !body.name || !body.url) {
    return NextResponse.json(
      { error: "id, name, and url are required" },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(body.id) || body.id.length > 64) {
    return NextResponse.json(
      { error: "ID must be lowercase letters, numbers, and hyphens (max 64 chars)" },
      { status: 400 }
    );
  }

  // Validate repo URL and branch via git ls-remote
  const branch = body.defaultBranch ?? "master";
  const check = await validateRepoUrl(body.url, branch, body.token);
  if (!check.valid) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  try {
    await createSource(
      body.id,
      body.name,
      body.url,
      branch,
      body.token
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "A source with this ID already exists" },
        { status: 409 }
      );
    }
    console.error("Source creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create source" },
      { status: 500 }
    );
  }
}
