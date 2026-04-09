import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
    updateToken,
    deleteToken,
    getTokenUsageBySources,
} from "@/lib/github-tokens-db";

interface Params {
    params: Promise<{ id: string }>;
}

/** PUT /api/settings/github-tokens/{id} — update a token. */
export async function PUT(req: NextRequest, { params }: Params) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const tokenId = parseInt(id);
    if (isNaN(tokenId))
        return NextResponse.json(
            { error: "Invalid token ID" },
            { status: 400 }
        );

    let body: { name?: string; token?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
        const updated = await updateToken(tokenId, body);
        if (!updated)
            return NextResponse.json(
                { error: "Token not found" },
                { status: 404 }
            );
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                { error: "A token with this name already exists" },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: "Failed to update token" },
            { status: 500 }
        );
    }
}

/** DELETE /api/settings/github-tokens/{id} — delete a token. */
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const tokenId = parseInt(id);
    if (isNaN(tokenId))
        return NextResponse.json(
            { error: "Invalid token ID" },
            { status: 400 }
        );

    // Check usage
    const usedBy = await getTokenUsageBySources(tokenId);
    if (usedBy.length > 0) {
        return NextResponse.json(
            {
                error: `Token in use by sources: ${usedBy.join(", ")}. Remove the token from those sources first.`,
            },
            { status: 400 }
        );
    }

    const deleted = await deleteToken(tokenId);
    if (!deleted)
        return NextResponse.json(
            { error: "Token not found" },
            { status: 404 }
        );
    return NextResponse.json({ success: true });
}
