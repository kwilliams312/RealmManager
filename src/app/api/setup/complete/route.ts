import { NextRequest, NextResponse } from "next/server";
import { query, executeDb, DB_REALMD } from "@/lib/db";
import { computeSRP6Verifier } from "@/lib/srp6";

/**
 * POST /api/setup/complete — finalize initial setup.
 * Creates the admin account and marks setup as complete.
 * No auth required (this is the first account creation).
 */
export async function POST(req: NextRequest) {
  // Verify setup hasn't already been completed
  try {
    const rows = await query<{ value: string }>(
      `SELECT \`value\` FROM ${DB_REALMD}.webui_settings WHERE \`key\` = 'setup_complete'`
    );
    if (rows.length > 0 && JSON.parse(rows[0].value) === true) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
    }
  } catch {
    // Table may not exist — will be created by ensureTable calls
  }

  let body: { username?: string; password?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }

  const upperUser = username.toUpperCase();

  // Check if account already exists
  try {
    const existing = await query<{ id: number }>(
      `SELECT id FROM ${DB_REALMD}.account WHERE username = ?`,
      [upperUser]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "Account already exists" }, { status: 409 });
    }
  } catch {
    // account table may not exist yet — db-import hasn't run
    return NextResponse.json({
      error: "Database not ready — the auth database schema hasn't been imported yet. Start the db-import service first.",
    }, { status: 503 });
  }

  // Create admin account with SRP6 verifier
  const { salt, verifier } = computeSRP6Verifier(upperUser, password);

  try {
    await executeDb(
      DB_REALMD,
      `INSERT INTO account (username, salt, verifier, email, reg_mail, expansion)
       VALUES (?, ?, ?, '', '', 2)`,
      [upperUser, salt, verifier]
    );

    // Get the new account ID
    const rows = await query<{ id: number }>(
      `SELECT id FROM ${DB_REALMD}.account WHERE username = ?`,
      [upperUser]
    );
    const accountId = rows[0]?.id;

    if (accountId) {
      // Grant GM level 3 (full admin)
      await executeDb(
        DB_REALMD,
        `INSERT INTO account_access (id, gmlevel, RealmID) VALUES (?, 3, -1)`,
        [accountId]
      );
    }

    // Mark setup as complete
    // Ensure webui_settings table exists first
    await executeDb(
      DB_REALMD,
      `CREATE TABLE IF NOT EXISTS webui_settings (
        \`key\` VARCHAR(128) NOT NULL PRIMARY KEY,
        \`value\` JSON NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      []
    );

    await executeDb(
      DB_REALMD,
      `INSERT INTO webui_settings (\`key\`, \`value\`) VALUES ('setup_complete', 'true')
       ON DUPLICATE KEY UPDATE \`value\` = 'true'`,
      []
    );

    // Auto-build the first seeded source in the background.
    // The build pipeline's post-build hook will assign the build to realm 1.
    let buildSourceId: string | null = null;
    try {
      const { getAllSources } = await import("@/lib/build-sources-db");
      const { startBuild } = await import("@/lib/build-pipeline");
      const sources = await getAllSources();
      if (sources.length > 0) {
        buildSourceId = sources[0].sourceId;
        startBuild(buildSourceId).catch((err) =>
          console.error(`[setup] Auto-build of ${buildSourceId} failed:`, err)
        );
        console.log(`[setup] Auto-build started for source: ${buildSourceId}`);
      }
    } catch (err) {
      console.error("[setup] Failed to start auto-build:", err);
    }

    return NextResponse.json({ success: true, username: upperUser, buildSourceId });
  } catch (err) {
    console.error("Setup account creation failed:", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
