import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { createAuthToken } from "../../../../lib/auth";

// 1. Maintain pool connection across invocations (outside handler)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });


const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const { identifier, password, remember } = await req.json();

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Enter your member number, phone, or email, and password." },
      { status: 400 }
    );
  }

  const normalizedIdentifier = String(identifier).trim().toLowerCase();

  if (isRateLimited(normalizedIdentifier)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  const client = await pool.connect();

  try {
    // 2. Included u.tenant_id, u.role, u.status fallback, and m.member_id in WHERE clause
    const result = await client.query(
      `SELECT
        u.user_id,
        u.username,
        u.password_hash,
        u.tenant_id,
        u.role,
        COALESCE(m.status, u.status, 'active') AS user_status,
        m.first_name,
        m.last_name,
        m.id_number,
        m.member_id
       FROM users u 
       LEFT JOIN members m ON m.member_id = u.member_id
       WHERE lower(u.username) = $1
          OR lower(m.phone_primary) = $1
          OR lower(m.email) = $1
          OR lower(m.member_id) = $1
          OR lower(m.id_number) = $1
       LIMIT 1`,
      [normalizedIdentifier]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Wrong credentials." },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // 3. Safely evaluate user_status
    if (user.user_status !== "active") {
      return NextResponse.json(
        {
          error:
            user.user_status === "suspended"
              ? "Your account has been suspended. Contact your SACCO branch."
              : "Your account is not yet active. Contact your SACCO branch.",
        },
        { status: 403 }
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Invalid Credentials" },
        { status: 401 }
      );
    }

    const activeRole = user.role || "admin";
    const tokenDuration = remember ? "30d" : "1d";

    // 4. Ensure non-null values for JWTPayload
    const token = await createAuthToken(
      {
        userId: String(user.user_id),
        tenantId: String(user.tenant_id ?? ""),
        role: activeRole,
        id_number: user.id_number ?? "",
        memberId: user.member_id ?? undefined,
      },
      tokenDuration
    );

    await client.query(
      `UPDATE users SET last_login_at = now() WHERE user_id = $1`,
      [user.user_id]
    );

    const redirectTo =
      activeRole === "member" ? "/member/dashboard" : "/dashboard";

    const response = NextResponse.json({
      redirectTo,
      user: {
        firstName: user.first_name,
        lastName: user.last_name,
        userId: user.user_id,
        memberId: user.member_id,
        role: activeRole,
      },
    });

    const maxAgeInSeconds = remember
      ? 30 * 24 * 60 * 60
      : 24 * 60 * 60;

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeInSeconds,
    });

    return response;
  } catch (err) {
    console.error("Login failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}