import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/session";

const SESSION_OPTIONS = {
  password:
    process.env.SECRET_KEY ??
    "change-this-in-production-must-be-at-least-32-chars!",
  cookieName: "realmmanager_session",
  cookieOptions: {
    secure: process.env.COOKIE_SECURE === "true",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

// Public routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/landing",
  "/getting-started",
  "/setup",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/server-info",
  "/api/settings/branding",
  "/api/setup-script",
  "/api/setup",
  "/api/addons",
];

// File extension pattern — only allow actual static files through
const STATIC_FILE_RE = /\.(?:ico|png|jpg|jpeg|svg|webp|gif|woff2?|ttf|otf|eot|css|js|json|txt|xml|map)$/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow actual static files (not API paths with dots)
  if (pathname.startsWith("/_next") || STATIC_FILE_RE.test(pathname)) {
    return NextResponse.next();
  }

  // Check session for protected routes
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, SESSION_OPTIONS);

  if (!session.userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
