import { NextRequest, NextResponse } from "next/server";
import { query, DB_REALMD } from "@/lib/db";
import { verifySRP6Password } from "@/lib/srp6";
import { getSession } from "@/lib/session";

interface AccountRow {
  id: number;
  username: string;
  salt: Buffer;
  verifier: Buffer;
  gmlevel: number;
}

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 }
    );
  }

  let rows: AccountRow[];
  try {
    rows = await query<AccountRow>(
      `SELECT a.id, a.username, a.salt, a.verifier,
              IFNULL(MAX(aa.gmlevel), 0) AS gmlevel
       FROM ${DB_REALMD}.account a
       LEFT JOIN ${DB_REALMD}.account_access aa ON a.id = aa.id
       WHERE UPPER(a.username) = ? AND a.locked = 0
       GROUP BY a.id`,
      [username.toUpperCase()]
    );
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  if (!rows.length) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const user = rows[0];
  const salt = Buffer.isBuffer(user.salt) ? user.salt : Buffer.from(user.salt);
  const verifier = Buffer.isBuffer(user.verifier)
    ? user.verifier
    : Buffer.from(user.verifier);

  if (!verifySRP6Password(username, password, salt, verifier)) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.gmlevel = user.gmlevel;
  await session.save();

  return NextResponse.json({
    username: user.username,
    gmlevel: user.gmlevel,
  });
}
