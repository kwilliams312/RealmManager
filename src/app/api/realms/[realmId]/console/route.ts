import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sendRACommand, sendRACommandDirect } from "@/lib/ra-console";
import { getSession } from "@/lib/session";
import { getRealmRemoteConfig } from "@/lib/build-sources-db";

interface Params {
  params: Promise<{ realmId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { realmId } = await params;
  const id = parseInt(realmId);

  let body: { command?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { command, password } = body;
  if (!command?.trim()) {
    return NextResponse.json({ error: "command required" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "password required for RA authentication" }, { status: 400 });
  }

  const session = await getSession();
  const username = session.username!;

  // Check if this is a remote realm — use stored RA host/port
  const remoteConfig = await getRealmRemoteConfig(id);
  const result = remoteConfig.isRemote && remoteConfig.raHost
    ? await sendRACommandDirect(
        remoteConfig.raHost,
        remoteConfig.raPort ?? 3443,
        username,
        password,
        command.trim()
      )
    : await sendRACommand(id, username, password, command.trim());

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.error.includes("timed out") || result.error.includes("Cannot connect") ? 503 : 401 });
  }

  return NextResponse.json({ output: result.output });
}
