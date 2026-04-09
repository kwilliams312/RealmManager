import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getContainerLogs, getStartupError } from "@/lib/docker";

interface Params {
  params: Promise<{ realmId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);
  const tail = parseInt(req.nextUrl.searchParams.get("tail") ?? "200");
  const safeTail = Math.min(Math.max(tail, 10), 2000);

  try {
    const [logs, startupError] = await Promise.all([
      getContainerLogs(id, safeTail),
      getStartupError(id),
    ]);
    return NextResponse.json({ logs, startupError });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message ?? "Failed to get logs" }, { status: 500 });
  }
}
