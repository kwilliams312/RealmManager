import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllTokens, createToken } from "@/lib/github-tokens-db";

/** GET /api/settings/github-tokens — list all tokens (masked). */
export async function GET() {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const tokens = await getAllTokens();
    return NextResponse.json({ tokens });
}

/** POST /api/settings/github-tokens — create a new token. */
export async function POST(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    let body: { name?: string; token?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.name?.trim() || !body.token?.trim()) {
        return NextResponse.json(
            { error: "name and token are required" },
            { status: 400 }
        );
    }

    try {
        const id = await createToken(body.name.trim(), body.token.trim());
        return NextResponse.json({ success: true, id }, { status: 201 });
    } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                { error: "A token with this name already exists" },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: "Failed to create token" },
            { status: 500 }
        );
    }
}
