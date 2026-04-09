import { NextResponse } from "next/server";
import { query, DB_REALMD, checkDbHealth } from "@/lib/db";
import { isSourceBuilding } from "@/lib/build-state";
import { getAllSources } from "@/lib/build-sources-db";

/**
 * GET /api/setup/status — check if initial setup is needed.
 * No auth required (this is called before any accounts exist).
 *
 * Returns { needsSetup, dbConnected, initialBuildInProgress?, initialBuildSourceId? }
 */
export async function GET() {
  // Check DB connectivity
  const dbConnected = await checkDbHealth();
  if (!dbConnected) {
    return NextResponse.json({ needsSetup: true, dbConnected: false });
  }

  // Check if setup_complete flag exists in webui_settings
  let setupComplete = false;
  try {
    const rows = await query<{ value: string }>(
      `SELECT \`value\` FROM ${DB_REALMD}.webui_settings WHERE \`key\` = 'setup_complete'`
    );
    if (rows.length > 0) {
      const val = JSON.parse(rows[0].value);
      if (val === true) setupComplete = true;
    }
  } catch {
    // Table may not exist yet on first run — that means setup is needed
  }

  if (!setupComplete) {
    return NextResponse.json({ needsSetup: true, dbConnected: true });
  }

  // Setup is complete — check if the initial auto-build is still running
  let initialBuildInProgress = false;
  let initialBuildSourceId: string | null = null;
  try {
    const sources = await getAllSources();
    if (sources.length > 0) {
      const firstSourceId = sources[0].sourceId;
      if (isSourceBuilding(firstSourceId)) {
        initialBuildInProgress = true;
        initialBuildSourceId = firstSourceId;
      }
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    needsSetup: false,
    dbConnected: true,
    initialBuildInProgress,
    initialBuildSourceId,
  });
}
