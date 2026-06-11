import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't need authentication
const PUBLIC_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public routes through
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for access token in cookies (we'll also set this on login)
  // Middleware runs on the server, so we can't read localStorage here —
  // we mirror the access token to a cookie named "ems_at" on login.
  const token = request.cookies.get("ems_at")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the original destination so we can redirect back after login
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};