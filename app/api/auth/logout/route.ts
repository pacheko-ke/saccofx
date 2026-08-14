import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// POST /api/auth/logout
// Clears the auth cookie by setting it with an immediate expiry.
export async function POST() {
  const cookieStore = await cookies();

  // NOTE: "auth_token" is a placeholder — match this to whatever name
  // your login route actually sets the session/JWT cookie as.
  cookieStore.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // expires immediately
  });

  return NextResponse.json({ success: true });
}