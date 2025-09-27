// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public + auth routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/signin" ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/api/public")
  ) {
    return NextResponse.next();
  }

  // Which paths need auth?
  const needsAuth =
    pathname.startsWith("/docs") ||
    pathname.startsWith("/trash") ||
    pathname.startsWith("/settings");

  if (!needsAuth) return NextResponse.next();

  // 1) JWT-based (works if you ever switch to strategy: 'jwt')
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 2) Database-session-based cookie presence (what you're using now)
  //    Name is "__Secure-next-auth.session-token" over HTTPS, "next-auth.session-token" otherwise.
  const hasDbSessionCookie =
    !!req.cookies.get("__Secure-next-auth.session-token") ||
    !!req.cookies.get("next-auth.session-token");

  if (token || hasDbSessionCookie) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to /signin with a callback
  const url = new URL("/signin", req.url);
  url.searchParams.set("callbackUrl", req.nextUrl.href);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
