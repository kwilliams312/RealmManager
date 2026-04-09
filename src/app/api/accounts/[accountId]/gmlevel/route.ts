import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query, executeDb, DB_REALMD } from "@/lib/db";
import { getSession, isSuperAdmin } from "@/lib/session";

interface Params { params: Promise<{ accountId: string }>; }

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { accountId } = await params;
  const id = parseInt(accountId);
  const session = await getSession();

  let body: { gmlevel?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newLevel = Number(body.gmlevel ?? 0);
  if (newLevel < 0 || newLevel > 6 || !Number.isInteger(newLevel)) {
    return NextResponse.json({ error: "Invalid GM level (0-6)" }, { status: 400 });
  }

  // Only ADMIN user can set gmlevel >= 3
  if (newLevel >= 3 && !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Only the ADMIN account can grant admin privileges" }, { status: 403 });
  }

  // Check target account exists and isn't a superadmin (unless caller is superadmin)
  try {
    const rows = await query<{ gmlevel: number }>(
      `SELECT IFNULL(MAX(aa.gmlevel), 0) AS gmlevel FROM ${DB_REALMD}.account a
       LEFT JOIN ${DB_REALMD}.account_access aa ON a.id = aa.id WHERE a.id = ? GROUP BY a.id`,
      [id]
    );
    if (!rows.length) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (rows[0].gmlevel >= 3 && !isSuperAdmin(session)) {
      return NextResponse.json({ error: "Cannot modify admin accounts" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    if (newLevel === 0) {
      await executeDb(DB_REALMD, "DELETE FROM account_access WHERE id = ?", [id]);
    } else {
      await executeDb(
        DB_REALMD,
        "INSERT INTO account_access (id, gmlevel, RealmID) VALUES (?, ?, -1) ON DUPLICATE KEY UPDATE gmlevel = ?",
        [id, newLevel, newLevel]
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update GM level" }, { status: 500 });
  }
}
