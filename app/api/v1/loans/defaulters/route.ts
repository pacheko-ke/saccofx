import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";
import { pool } from "@/app/lib/db"; // TODO: confirm this is your actual pool export path/name

// ---------------------------------------------------------------------------
// GET /api/loans/defaulters
//
// Returns members with loans in arrears, computed from loan_repayment_schedule /
// loan_repayments rather than stored in a dedicated table. "Days overdue" is
// anchored to the EARLIEST unpaid/partially-paid installment for each loan,
// per SASRA PAR aging convention (this matches the pattern used in your
// dashboard PAR bucket calculation).
//
// ASSUMPTIONS (verify against your actual 54-table schema and adjust):
//   loan_repayment_schedule:   loan_id, installment_no, due_date, due_amount,
//                     paid_amount, status
//   loans:   id, member_id, loan_product_id, loan_no, status,
//                     principal_outstanding, branches_id / branches
//   loan_repayments: loan_id, amount, paid_at (or payment_date)
//   loan_guarantors: loan_id, member_id  (optional table — if you
//                     don't have this, the guarantorCount subquery below
//                     will just need removing/adjusting)
//   members:         id, member_no, first_name, last_name, phone,
//                     branches_id / branch_name
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // --- Auth (inline, per your stated preference — no shared session helper) ---
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyAuthToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  // Role-gate: only staff roles should see the defaulters register
  const allowedRoles = ["admin", "manager", "loan_officer", "credit_officer","member_portal_user"];
  if (!payload?.role || !allowedRoles.includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = payload.tenantId as string | undefined;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant context" }, { status: 400 });
  }

  // --- Optional query params (server-side pre-filter; UI also filters client-side) ---
  const { searchParams } = new URL(req.url);
  const minDaysOverdue = Number(searchParams.get("minDaysOverdue") ?? "1");

//   const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // SET LOCAL cannot be parameterized — tenantId is regex-validated above.
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const { rows } = await client.query(
      `
      WITH earliest_overdue AS (
  SELECT DISTINCT ON (ls.loan_id)
    ls.loan_id,
    ls.due_date,
    (CURRENT_DATE - ls.due_date)::int AS days_overdue
  FROM loan_repayment_schedule ls
  WHERE ls.is_paid = 'f'
    AND ls.due_date < CURRENT_DATE
  ORDER BY ls.loan_id, ls.due_date ASC
),
arrears_totals AS (
  SELECT
    ls.loan_id,
    SUM(GREATEST(ls.total_due - COALESCE(ls.principal_paid + ls.interest_paid, 0), 0)) AS arrears_amount
  FROM loan_repayment_schedule ls
  WHERE ls.is_paid = 'f'
    AND ls.due_date < CURRENT_DATE
  GROUP BY ls.loan_id
),
last_payment AS (
  SELECT DISTINCT ON (lr.loan_id)
    lr.loan_id,
    lr.paid_at,
    lr.amount_paid
  FROM loan_repayments lr
  ORDER BY lr.loan_id, lr.paid_at DESC
),
guarantor_counts AS (
  SELECT loan_id, COUNT(*)::int AS guarantor_count
  FROM loan_guarantors
  GROUP BY loan_id
)
SELECT
  la.loan_id                               AS id,
  m.member_number                          AS member_no,
  (m.first_name || ' ' || m.last_name)     AS member_name,
  COALESCE(b.branch_name, 'Unassigned')  AS branches,
  la.loan_account_number                   AS loan_no,
  lp.product_name                          AS loan_product,
  la.outstanding_principal                 AS principal_outstanding,
  at.arrears_amount                        AS arrears_amount,
  eo.days_overdue                          AS days_overdue,
  lpay.paid_at                             AS last_payment_date,
  lpay.amount_paid                         AS last_payment_amount,
  m.phone_primary                          AS phone,
  COALESCE(gc.guarantor_count, 0)          AS guarantor_count
FROM earliest_overdue eo
JOIN loans la              ON la.loan_id = eo.loan_id
JOIN members m             ON m.member_id = la.member_id
JOIN branches b             ON b.branch_id = m.branch_id
JOIN arrears_totals at     ON at.loan_id = la.loan_id
JOIN loan_products lp      ON lp.loan_product_id = la.loan_product_id
LEFT JOIN last_payment lpay    ON lpay.loan_id = la.loan_id
LEFT JOIN guarantor_counts gc  ON gc.loan_id = la.loan_id
WHERE la.status = 'disbursed'
  AND eo.days_overdue >= $1
ORDER BY eo.days_overdue DESC
      `,
      [minDaysOverdue]
    );

    await client.query("COMMIT");

    const defaulters = rows.map((r) => ({
      id: String(r.id),
      memberNo: r.member_no,
      memberName: r.member_name,
      branches: r.branches,
      loanNo: r.loan_no,
      loanProduct: r.loan_product,
      principalOutstanding: Number(r.principal_outstanding),
      arrearsAmount: Number(r.arrears_amount),
      daysOverdue: Number(r.days_overdue),
      lastPaymentDate: r.last_payment_date
        ? new Date(r.last_payment_date).toISOString()
        : null,
      lastPaymentAmount: r.last_payment_amount != null ? Number(r.last_payment_amount) : null,
      phone: r.phone,
      guarantorCount: Number(r.guarantor_count),
    }));

    return NextResponse.json({ defaulters });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("GET /api/v1/loans/defaulters failed:", err);
    return NextResponse.json(
      { error: "Failed to load defaulters register" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}