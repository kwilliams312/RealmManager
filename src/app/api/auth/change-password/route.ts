import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth";
import { query, executeDb, DB_REALMD } from "@/lib/db";
import { verifySRP6Password, computeSRP6Verifier } from "@/lib/srp6";

export async function POST(req: NextRequest) {
  const auth = await requireLogin();
  if (!auth.ok) return auth.response;

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new password required" },
      { status: 400 }
    );
  }

  const { session } = auth;
  const username = session.username!;

  let rows: Array<{ salt: Buffer; verifier: Buffer }>;
  try {
    rows = await query<{ salt: Buffer; verifier: Buffer }>(
      `SELECT salt, verifier FROM ${DB_REALMD}.account WHERE id = ?`,
      [session.userId]
    );
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const salt = Buffer.isBuffer(rows[0].salt) ? rows[0].salt : Buffer.from(rows[0].salt);
  const verifier = Buffer.isBuffer(rows[0].verifier)
    ? rows[0].verifier
    : Buffer.from(rows[0].verifier);

  if (!verifySRP6Password(username, currentPassword, salt, verifier)) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 401 }
    );
  }

  const { salt: newSalt, verifier: newVerifier } = computeSRP6Verifier(
    username,
    newPassword
  );

  try {
    await executeDb(
      DB_REALMD,
      "UPDATE account SET salt = ?, verifier = ? WHERE id = ?",
      [newSalt, newVerifier, session.userId]
    );
  } catch {
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
