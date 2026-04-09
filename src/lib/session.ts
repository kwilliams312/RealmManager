import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: number;
  username?: string;
  gmlevel?: number;
}

const SESSION_OPTIONS = {
  password:
    process.env.SECRET_KEY ??
    "change-this-in-production-must-be-at-least-32-chars!",
  cookieName: "realmmanager_session",
  cookieOptions: {
    secure: process.env.COOKIE_SECURE === "true",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

export function isAdmin(session: SessionData): boolean {
  return (session.gmlevel ?? 0) >= 3;
}

export function isSuperAdmin(session: SessionData): boolean {
  return session.username?.toUpperCase() === "ADMIN";
}
