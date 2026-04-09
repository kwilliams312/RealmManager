import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { restartRealm } from "@/lib/docker";
import { isRealmRemote } from "@/lib/build-sources-db";

interface Params { params: Promise<{ realmId: string }>; }

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { realmId } = await params;
  const id = parseInt(realmId);
  if (await isRealmRemote(id))
    return NextResponse.json({ error: "Cannot restart a remote realm" }, { status: 400 });
  try {
    await restartRealm(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message ?? String(err) }, { status: 500 });
  }
}
