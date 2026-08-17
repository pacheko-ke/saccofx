import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/app/lib/auth";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const { pathname } = req.nextUrl;

  const isProtectedPath =
    pathname.startsWith("/dashboard") || pathname.startsWith("/member/dashboard") || pathname.startsWith("/api");

  if (isProtectedPath) {
    if (!token) {
      const loginUrl = new URL("/auth/login", req.url);
      return NextResponse.redirect(loginUrl);
    }

    const payload = await verifyAuthToken(token);

    if (!payload) {
      // Clear cookie if invalid or expired, then redirect to login
      const response = NextResponse.redirect(new URL("/auth/login", req.url));
      response.cookies.delete("auth_token");
      return response;
    }
  }
console.log("successsss")
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/member/dashboard/:path*","/api/:path((?!auth).*)"],
};