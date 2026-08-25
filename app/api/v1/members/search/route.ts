import { NextRequest, NextResponse } from "next/server";
import {pool} from "@/app/lib/db"
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";

// GET /api/members/search?q=
// Returns members matching the query along with their active savings accounts,
// for use in the teller deposit flow (member -> pick account -> deposit).
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ members: [] });
  }

  try {
     const client = await pool.connect();
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [
      payload.tenantId,
    ]);

    const result = await client.query(
      `
      SELECT
        m.member_id,
        m.member_number       AS "memberNo",
        m.first_name       AS "firstName",
        m.last_name        AS "lastName",
        m.phone_primary,
        COALESCE(
          json_agg(
            json_build_object(
              'accountId', sa.savings_account_id,
              'accountNo', sa.account_number,
              'productName', sp.product_name,
              'balance', sa.balance
            )
          ) FILTER (WHERE sa.savings_account_id IS NOT NULL),
          '[]'
        ) AS accounts
      FROM members m
      LEFT JOIN savings_accounts sa ON sa.member_id = m.member_id AND sa.status = 'active'
      LEFT JOIN savings_products sp ON sp.savings_product_id = sa.savings_product_id
      WHERE m.status = 'active'
        AND (
          m.first_name ILIKE $1
          OR m.last_name ILIKE $1
          OR m.member_number ILIKE $1
          OR m.phone_primary ILIKE $1
        )
      GROUP BY m.member_id, m.member_number, m.first_name, m.last_name, m.phone_primary
      ORDER BY m.last_name, m.first_name
      LIMIT 15
      `,
      [`%${q}%`]
    );

    return NextResponse.json({ members: result.rows });
  } catch (error) {
    console.error("Member search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}