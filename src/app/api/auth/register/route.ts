import { NextRequest, NextResponse } from "next/server";
import { query, executeDb, DB_REALMD } from "@/lib/db";
import { computeSRP6Verifier } from "@/lib/srp6";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username: rawUsername, password } = body;
  if (!rawUsername || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 }
    );
  }

  const username = rawUsername.trim();
  if (username.length < 3 || username.length > 16) {
    return NextResponse.json(
      { error: "Username must be 3-16 characters" },
      { status: 400 }
    );
  }
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be alphanumeric" },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters" },
      { status: 400 }
    );
  }

  let existing: unknown[];
  try {
    existing = await query(
      `SELECT id FROM ${DB_REALMD}.account WHERE UPPER(username) = ?`,
      [username.toUpperCase()]
    );
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  if (existing.length > 0) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const { salt, verifier } = computeSRP6Verifier(username, password);

  try {
    await executeDb(
      DB_REALMD,
      "INSERT INTO account (username, salt, verifier, expansion) VALUES (?, ?, ?, 2)",
      [username.toUpperCase(), salt, verifier]
    );
  } catch {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, username: username.toUpperCase() },
    { status: 201 }
  );
}
