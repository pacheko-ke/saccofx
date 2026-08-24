import { NextRequest, NextResponse } from "next/server";
import {pool} from "@/app/lib/db"
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";

// GET /api/members/cards?search=&branchId=&status=active
// Returns the minimal member fields needed to render CR80 membership cards.
// Reuses the SET LOCAL app.current_tenant RLS pattern from the rest of the app.
export async function GET(request: NextRequest) {
  // NOTE: adjust the cookie name below to match whatever your login route
  // actually sets (e.g. "auth_token", "session", "sfx_session"). It wasn't
  // included in the auth.ts snippet, so "auth_token" is a placeholder.
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = payload;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const branchId = searchParams.get("branchId");
  const status = searchParams.get("status") ?? "active";

  // Allowlist status to avoid building a dynamic identifier from user input
  const allowedStatuses = new Set(["active", "dormant", "suspended", "all"]);
  const safeStatus = allowedStatuses.has(status) ? status : "active";

  // branchId must be a UUID if provided
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safeBranchId = branchId && uuidRegex.test(branchId) ? branchId : null;
  const client = await pool.connect();

  try {
    // tenantId comes from the verified JWT, never from the request
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [
      tenantId,
    ]);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (safeStatus !== "all") {
      values.push(safeStatus);
      conditions.push(`m.status = $${values.length}`);
    }

    if (safeBranchId) {
      values.push(safeBranchId);
      conditions.push(`m.branch_id = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      const idx = values.length;
      conditions.push(
        `(m.first_name ILIKE $${idx} OR m.last_name ILIKE $${idx} OR m.member_no ILIKE $${idx} OR m.national_id ILIKE $${idx})`
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await client.query(
      `
      SELECT
        m.member_id,
        m.member_number        AS "memberNo",
        m.first_name        AS "firstName",
        m.last_name         AS "lastName",
        m.id_number       AS "nationalId",
        m.phone_primary,
        m.photo_url         AS "photoUrl",
        m.join_date         AS "joinDate",
        m.status,
        b.branch_name               AS "branchName"
      FROM members m
      LEFT JOIN branches b ON b.branch_id = m.branch_id
      ${whereClause}
      ORDER BY m.last_name, m.first_name
      LIMIT 500
      `,
      values
    );

    return NextResponse.json({ members: result.rows });
  } catch (error) {
    console.error("Failed to fetch members for card printing:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  } finally {
    client.release();
    await pool.end();
  }
}