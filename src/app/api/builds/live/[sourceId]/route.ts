import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getBuildLog } from "@/lib/build-state";

interface Params { params: Promise<{ sourceId: string }>; }

/** GET /api/builds/live/{sourceId} — get live build log from memory */
export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { sourceId } = await params;
    const { status, log } = getBuildLog(sourceId);

    return NextResponse.json({ sourceId, status, log });
}
