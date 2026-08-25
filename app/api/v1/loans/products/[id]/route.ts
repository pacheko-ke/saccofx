import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";
import { pool } from "@/app/lib/db"; // TODO: confirm this matches your actual pool export

// ---------------------------------------------------------------------------
// GET    /api/v1/loans/products/[id]  -> fetch a single loan product
// PATCH  /api/v1/loans/products/[id]  -> partial update (status toggle, edits)
//
// Column names below are assumed to match the LoanProduct interface 1:1
// (loan_product_id, product_name, product_code, min_principal, ...).
// Adjust if your actual `loan_products` table differs.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fields an edit form is allowed to touch via PATCH. Keeping an allowlist
// here (rather than trusting req.json() wholesale) avoids a client being
// able to smuggle unexpected columns into the UPDATE.
const PATCHABLE_FIELDS = [
  "product_name",
  "product_code",
  "min_principal",
  "max_principal",
  "min_tenure_months",
  "max_tenure_months",
  "interest_rate_pa",
  "interest_method",
  "repayment_frequency",
  "max_multiplier_of_shares",
  "requires_guarantors",
  "min_guarantors",
  "requires_collateral",
  "processing_fee_pct",
  "insurance_fee_pct",
  "penalty_rate_pct",
  "grace_period_days",
  "is_active",
] as const;

type PatchableField = (typeof PATCHABLE_FIELDS)[number];

async function authenticate(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("sfx_session")?.value ?? cookieStore.get("auth_token")?.value;
  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let payload;
  try {
    payload = await verifyAuthToken(token);
  } catch {
    return { error: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }) };
  }

  const tenantId = payload?.tenantId as string | undefined;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return { error: NextResponse.json({ error: "Invalid tenant context" }, { status: 400 }) };
  }

  return { payload, tenantId };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid loan product id" }, { status: 400 });
  }

  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;
  const { tenantId } = auth;

  
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const { rows } = await client.query(
      `SELECT
         loan_product_id,
         product_name,
         product_code,
         min_principal,
         max_principal,
         min_tenure_months,
         max_tenure_months,
         interest_rate_pa,
         interest_method,
         repayment_frequency,
         max_multiplier_of_shares,
         requires_guarantors,
         min_guarantors,
         requires_collateral,
         processing_fee_pct,
         insurance_fee_pct,
         penalty_rate_pct,
         grace_period_days,
         is_active,
         created_at
         
       FROM loan_products
       WHERE loan_product_id = $1`,
      [id]
    );

    await client.query("COMMIT");

    if (rows.length === 0) {
      return NextResponse.json({ error: "Loan product not found" }, { status: 404 });
    }

    return NextResponse.json({ loanProduct: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`GET /api/v1/loans/products/${id} failed:`, err);
    return NextResponse.json({ error: "Failed to load loan product" }, { status: 500 });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid loan product id" }, { status: 400 });
  }

  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;
  const { payload, tenantId } = auth;

  const allowedRoles = ["admin", "manager"];
  if (!payload?.role || !allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates = Object.entries(body).filter(([key]) =>
    PATCHABLE_FIELDS.includes(key as PatchableField)
  ) as [PatchableField, unknown][];

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid fields provided to update" }, { status: 400 });
  }

  // Sanity check the numeric range fields if both bounds are present in the payload
  if (
    "min_principal" in body &&
    "max_principal" in body &&
    Number(body.max_principal) < Number(body.min_principal)
  ) {
    return NextResponse.json({ error: "max_principal must be ≥ min_principal" }, { status: 400 });
  }
  if (
    "min_tenure_months" in body &&
    "max_tenure_months" in body &&
    Number(body.max_tenure_months) < Number(body.min_tenure_months)
  ) {
    return NextResponse.json(
      { error: "max_tenure_months must be ≥ min_tenure_months" },
      { status: 400 }
    );
  }

  // Build a parameterized SET clause dynamically from the allowlisted fields.
  // Column names come only from PATCHABLE_FIELDS (never from user input
  // directly), so this is safe despite the string interpolation of keys.
  const setClauses = updates.map(([key], idx) => `${key} = $${idx + 1}`);
  const values = updates.map(([, value]) => value);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const { rows } = await client.query(
      `UPDATE loan_products
       SET ${setClauses.join(", ")}, updated_at = now()
       WHERE loan_product_id = $${values.length + 1}
       RETURNING
         loan_product_id,
         product_name,
         product_code,
         min_principal,
         max_principal,
         min_tenure_months,
         max_tenure_months,
         interest_rate_pa,
         interest_method,
         repayment_frequency,
         max_multiplier_of_shares,
         requires_guarantors,
         min_guarantors,
         requires_collateral,
         processing_fee_pct,
         insurance_fee_pct,
         penalty_rate_pct,
         grace_period_days,
         is_active,
         created_at,
         updated_at`,
      [...values, id]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Loan product not found" }, { status: 404 });
    }

    await client.query("COMMIT");
    return NextResponse.json({ loanProduct: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`PATCH /api/v1/loans/products/${id} failed:`, err);
    return NextResponse.json({ error: "Failed to update loan product" }, { status: 500 });
  } finally {
    client.release();
  }
}