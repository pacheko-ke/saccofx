import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/app/lib/auth";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const { pathname } = req.nextUrl;

  const isApiPath = pathname.startsWith("/api");
  const isProtectedPath =
    pathname.startsWith("/dashboard") || pathname.startsWith("/member/dashboard") || isApiPath;

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // API routes must return JSON, never a redirect — fetch() follows
  // redirects and hands the caller back an HTML login page, which then
  // fails to parse as JSON ("Unexpected token '<'"). Pages can redirect
  // because a browser navigation actually benefits from landing on login.
  if (!token) {
    if (isApiPath) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/auth/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyAuthToken(token);

  if (!payload) {
    if (isApiPath) {
      const response = NextResponse.json({ error: "Invalid session" }, { status: 401 });
      response.cookies.delete("auth_token");
      return response;
    }
    const response = NextResponse.redirect(new URL("/auth/login", req.url));
    response.cookies.delete("auth_token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/member/dashboard/:path*", "/api/v1/:path((?!auth).*)"],
};