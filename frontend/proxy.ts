import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get("acx_access")?.value;
  const refreshToken = request.cookies.get("acx_refresh")?.value;
  const token = accessToken || refreshToken;
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isPublicPage = request.nextUrl.pathname === "/";

  if (!token && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
