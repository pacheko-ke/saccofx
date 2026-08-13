import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { createSession } from "@/app/lib/auth";

// simple in-memory rate limit guard per identifier; swap for Upstash/Redis
// in production if running across multiple serverless instances.
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

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Login happens pre-tenant-context, so this query intentionally runs
    // without SET LOCAL RLS scoping — it looks up the user across tenants
    // by unique identifier, then the session going forward is scoped.
    const result = await client.query(
      `SELECT
         u.id,
         u.tenant_id,
         u.password_hash,
         u.role,
         u.status,
         u.member_id,
         m.first_name,
         m.last_name,
         t.subdomain AS tenant_subdomain,
         t.name AS tenant_name
       FROM users u
       LEFT JOIN members m ON m.id = u.member_id
       JOIN tenants t ON t.id = u.tenant_id
       WHERE lower(u.member_number) = $1
          OR lower(u.phone) = $1
          OR lower(u.email) = $1
       LIMIT 1`,
      [normalizedIdentifier]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid credentials. Please try again." },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    if (user.status !== "active") {
      return NextResponse.json(
        {
          error:
            user.status === "suspended"
              ? "Your account has been suspended. Contact your SACCO branch."
              : "Your account is not yet active. Contact your SACCO branch.",
        },
        { status: 403 }
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Invalid credentials. Please try again." },
        { status: 401 }
      );
    }

    await createSession({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      memberId: user.member_id ?? undefined,
      remember: Boolean(remember),
    });

    await client.query(
      `UPDATE users SET last_login_at = now() WHERE id = $1`,
      [user.id]
    );

    const redirectTo =
      user.role === "member" ? "/member/dashboard" : "/dashboard";

    return NextResponse.json({
      redirectTo,
      user: {
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        tenantName: user.tenant_name,
      },
    });
  } catch (err) {
    console.error("Login failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  } finally {
    client.release();
    await pool.end();
  }
}
