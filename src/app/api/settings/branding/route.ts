import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings-db";
import { DEFAULT_BRANDING, type BrandingSettings } from "@/lib/branding";

/** GET /api/settings/branding — public (used by landing/getting-started pages). */
export async function GET() {
  const branding = await getSetting<BrandingSettings>("branding");
  return NextResponse.json({
    branding: branding
      ? { ...DEFAULT_BRANDING, ...branding }
      : DEFAULT_BRANDING,
  });
}

/** PUT /api/settings/branding — admin only. */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: { branding?: Partial<BrandingSettings> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.branding) {
    return NextResponse.json(
      { error: "branding object required" },
      { status: 400 }
    );
  }

  const current =
    (await getSetting<BrandingSettings>("branding")) ?? DEFAULT_BRANDING;
  const merged: BrandingSettings = {
    ...current,
    ...body.branding,
    colors: { ...current.colors, ...(body.branding.colors ?? {}) },
    gettingStarted: {
      ...current.gettingStarted,
      ...(body.branding.gettingStarted ?? {}),
    },
  };

  await setSetting("branding", merged);
  return NextResponse.json({ success: true, branding: merged });
}
