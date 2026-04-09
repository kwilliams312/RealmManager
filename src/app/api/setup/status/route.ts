import { NextResponse } from "next/server";
import { query, DB_REALMD, checkDbHealth } from "@/lib/db";

/**
 * GET /api/setup/status — check if initial setup is needed.
 * No auth required (this is called before any accounts exist).
 *
 * Returns { needsSetup: true/false, dbConnected: true/false }
 */
export async function GET() {
  // Check DB connectivity
  const dbConnected = await checkDbHealth();
  if (!dbConnected) {
    return NextResponse.json({ needsSetup: true, dbConnected: false });
  }

  // Check if setup_complete flag exists in webui_settings
  try {
    const rows = await query<{ value: string }>(
      `SELECT \`value\` FROM ${DB_REALMD}.webui_settings WHERE \`key\` = 'setup_complete'`
    );
    if (rows.length > 0) {
      const val = JSON.parse(rows[0].value);
      if (val === true) {
        return NextResponse.json({ needsSetup: false, dbConnected: true });
      }
    }
  } catch {
    // Table may not exist yet on first run — that means setup is needed
  }

  return NextResponse.json({ needsSetup: true, dbConnected: true });
}
