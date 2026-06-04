import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ADMIN_COOKIE, cookieIsValid } from "./lib/admin-auth";
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";

// Kawakeeb custom routes bypass the TEMPLATE's chat auth, but the ones below
// are gated by the admin password (see adminGated()). Webhooks/runners that are
// called by external services use their own secrets, so they stay fully public.
const KAWAKEEB_PUBLIC_PREFIXES = [
  "/admin",
  "/api/agents",
  "/api/tools",
  "/api/skills",
  "/api/agent-chat",
  "/api/cron-jobs",
  "/api/usage",
  "/api/telegram",
  "/api/research",
  "/api/admin-login",
];

// Paths protected by the admin password. /admin/login is excluded so the user
// can reach the login form. Telegram webhook + cron runner are excluded because
// they authenticate with their own secrets.
function adminGated(pathname: string): boolean {
  if (pathname.startsWith("/admin/login")) {
    return false;
  }
  if (pathname.startsWith("/api/telegram")) {
    return false;
  }
  if (pathname.startsWith("/api/cron-jobs/run")) {
    return false;
  }
  if (pathname.startsWith("/api/admin-login")) {
    return false;
  }
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/agents") ||
    pathname.startsWith("/api/tools") ||
    pathname.startsWith("/api/skills") ||
    pathname.startsWith("/api/agent-chat") ||
    pathname.startsWith("/api/cron-jobs") ||
    pathname.startsWith("/api/usage") ||
    pathname.startsWith("/api/research")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Kawakeeb admin + agent APIs: bypass the template guest auth, but enforce
  // the admin password gate where applicable.
  if (KAWAKEEB_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (adminGated(pathname)) {
      const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
      const ok = await cookieIsValid(cookie);
      if (!ok) {
        // APIs get a 401; pages redirect to the login form.
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const next = encodeURIComponent(pathname);
        return NextResponse.redirect(
          new URL(`/admin/login?next=${next}`, request.url)
        );
      }
    }
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  if (!token) {
    const redirectUrl = encodeURIComponent(new URL(request.url).pathname);

    return NextResponse.redirect(
      new URL(`${base}/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/admin/:path*",
    "/login",
    "/register",

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
