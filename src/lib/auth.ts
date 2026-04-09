import { NextResponse } from "next/server";
import { getSession, isAdmin } from "./session";

/** Assert request is authenticated. Returns session data or a 401 response. */
export async function requireLogin(): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof getSession>> }
  | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session.userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

/** Assert request is authenticated AND admin (gmlevel >= 3). */
export async function requireAdmin(): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof getSession>> }
  | { ok: false; response: NextResponse }
> {
  const loginResult = await requireLogin();
  if (!loginResult.ok) return loginResult;

  if (!isAdmin(loginResult.session)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
    };
  }
  return loginResult;
}
