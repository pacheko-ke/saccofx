import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Pool } from "@neondatabase/serverless";
import { verifyAuthToken } from "@/app/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- GET: list active loan products (member-facing) ------------------------
// Read-only reference data — any authenticated member can see product
// terms, so this only checks that a valid member session exists, not that
// the request is scoped to a specific member's own records.
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { tenantId, memberId } = payload;
  if (!UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }
  if (!memberId) {
    return NextResponse.json({ error: "This endpoint is for member accounts only" }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    // ASSUMPTION: a `loan_products` table holds product terms. Adjust
    // column names to match your real schema if this differs — in
    // particular `interest_method` is assumed to be 'reducing' | 'flat'.
    const result = await client.query(
      `SELECT loan_product_id, product_name, interest_rate_pa, interest_method,
              min_principal::float8, max_principal::float8, min_tenure_months, max_tenure_months
       FROM loan_products
       WHERE tenant_id = $1 AND is_active = 't'
       ORDER BY product_name`,
      [tenantId]
    );

    await client.query("COMMIT");
    return NextResponse.json({ products: result.rows });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to list loan products:", err);
    return NextResponse.json({ error: "Failed to load loan products" }, { status: 500 });
  } finally {
    client.release();
  }
}