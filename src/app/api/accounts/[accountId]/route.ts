import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query, executeDb, DB_REALMD } from "@/lib/db";
import { getSession, isSuperAdmin } from "@/lib/session";

interface Params { params: Promise<{ accountId: string }>; }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { accountId } = await params;
  const id = parseInt(accountId);
  const session = await getSession();

  if (id === session.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 403 });
  }

  try {
    const rows = await query<{ gmlevel: number }>(
      `SELECT IFNULL(MAX(aa.gmlevel), 0) AS gmlevel FROM ${DB_REALMD}.account a
       LEFT JOIN ${DB_REALMD}.account_access aa ON a.id = aa.id WHERE a.id = ? GROUP BY a.id`,
      [id]
    );
    if (!rows.length) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (rows[0].gmlevel >= 3 && !isSuperAdmin(session)) {
      return NextResponse.json({ error: "Cannot delete admin accounts" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    await executeDb(DB_REALMD, "DELETE FROM account_access WHERE id = ?", [id]);
    await executeDb(DB_REALMD, "DELETE FROM account WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
