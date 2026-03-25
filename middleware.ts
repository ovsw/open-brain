import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionCookieName, isValidSessionToken } from "@/lib/auth";
import { getSessionSecret } from "@/lib/config";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const isAuthorized = await isValidSessionToken(getSessionSecret(), token);
  const { pathname } = request.nextUrl;

  if (isAuthorized) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/tasks")) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/login", "/api/tasks/:path*"],
};
