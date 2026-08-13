import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const COOKIE_NAME = "sacco_session";
const DEFAULT_MAX_AGE = 60 * 60 * 8; // 8 hours
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type Role = "member" | "teller" | "loan_officer" | "branch_manager" | "admin";

export interface SessionPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  role: Role;
  memberId?: string;
}

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed session JWT and sets it as an httpOnly cookie.
 * Call this after verifying credentials in the login route.
 */
export async function createSession(params: {
  userId: string;
  tenantId: string;
  role: Role;
  memberId?: string;
  remember?: boolean;
}) {
  const { userId, tenantId, role, memberId, remember = false } = params;
  const maxAge = remember ? REMEMBER_MAX_AGE : DEFAULT_MAX_AGE;

  const token = await new SignJWT({ userId, tenantId, role, memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return token;
}

/** Clears the session cookie. Call from a logout route or server action. */
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Reads and verifies the session cookie. Returns null if absent, expired,
 * or tampered with — callers decide whether that's a redirect or a 401.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as SessionPayload;
  } catch {
    // expired, malformed, or signature mismatch
    return null;
  }
}

/**
 * Returns the tenant context for the current request, scoped for use in
 * `SET LOCAL app.current_tenant`. Redirects to /login if there's no
 * valid session — use this in server components/route handlers that
 * require an authenticated tenant-scoped user.
 */
export async function getTenantContext(): Promise<{
  tenantId: string;
  userId: string;
  role: Role;
  memberId?: string;
}> {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return {
    tenantId: session.tenantId,
    userId: session.userId,
    role: session.role,
    memberId: session.memberId,
  };
}

/**
 * Guards a server component / route handler to a set of allowed roles.
 * Redirects unauthenticated users to /login, and unauthorized (wrong-role)
 * users to /unauthorized. Returns the session for convenience.
 *
 * Usage:
 *   const session = await requireRole(["admin", "branch_manager"]);
 */
export async function requireRole(allowedRoles: Role[]): Promise<SessionPayload> {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (!allowedRoles.includes(session.role)) {
    redirect("/unauthorized");
  }

  return session;
}