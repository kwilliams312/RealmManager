import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query, DB_REALMD } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isSuperAdmin } from "@/lib/session";
import { IS_PLAYER } from "@/lib/db-realm";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const session = await getSession();
  const superAdmin = isSuperAdmin(session);
  const currentUserId = session.userId!;

  try {
    const rows = await query<{
      id: number; username: string; gmlevel: number;
      last_login: string | null; last_ip: string | null;
      expansion: number; locked: number;
    }>(
      `SELECT a.id, a.username, IFNULL(MAX(aa.gmlevel), 0) AS gmlevel,
              a.last_login, a.last_ip, a.expansion, a.locked
       FROM ${DB_REALMD}.account a
       LEFT JOIN ${DB_REALMD}.account_access aa ON a.id = aa.id
       WHERE ${IS_PLAYER}
       GROUP BY a.id ORDER BY a.id`
    );

    const accounts = rows.map((r) => ({
      id: r.id,
      username: r.username,
      gmlevel: r.gmlevel,
      last_login: r.last_login ? String(r.last_login) : null,
      last_ip: r.last_ip,
      expansion: r.expansion,
      locked: r.locked,
      can_manage: superAdmin || r.gmlevel < 3 || r.id === currentUserId,
    }));

    return NextResponse.json({ accounts });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
