import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";
import { pool } from "@/app/lib/db";

// ---------------------------------------------------------------------------
// GET /api/v1/members/[id]
//
// Returns a single member's profile plus nested next_of_kin and
// savings/loan/share account summaries, shaped to match the MemberProfile
// interface used by the member profile page.
//
// ASSUMPTIONS (verify against your actual schema and adjust column/table
// names accordingly — these follow the naming pattern established in the
// loan_defaulters route: loans.loan_id, loans.outstanding_principal, etc.):
//   members:               member_id, member_no, first_name, middle_name,
//                          last_name, id_number, date_of_birth, gender,
//                          marital_status, phone_primary, phone_alternate,
//                          email, physical_address, branch_id, status,
//                          kyc_status, membership_date, photo_url
//   branches:              branch_id, branch_name
//   next_of_kin:           id, member_id, full_name, relationship, phone,
//                          id_number, percentage_share
//   savings_accounts:      savings_account_id, member_id, account_number,
//                          balance, status, savings_product_id
//   savings_products:      savings_product_id, product_name
//   loans:                 loan_id, member_id, loan_account_number,
//                          outstanding_principal, status, loan_product_id
//   loan_products:         loan_product_id, product_name
//   loan_repayment_schedule: loan_id, due_date, is_paid  (for days_overdue)
//   member_share_accounts:        share_account_id, member_id, shares_held,
//                          value_at_par
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
  }

  // --- Auth (inline) ---
  const cookieStore = await cookies();
  const token = cookieStore.get("sfx_session")?.value ?? cookieStore.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyAuthToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  // Staff roles can view any member's profile. A member_portal_user may
  // only ever view their own — never someone else's, since this endpoint
  // returns ID numbers, phone numbers, and next-of-kin details.
  const staffRoles = ["admin", "manager", "loan_officer", "credit_officer"];
  const isStaff = payload?.role && staffRoles.includes(payload.role);
  const isSelf = payload?.role === "member_portal_user" && payload?.memberId === id;

  if (isStaff && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = payload?.tenantId as string | undefined;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant context" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const { rows } = await client.query(
      `
      SELECT
        m.member_id,
        m.member_number,
        m.first_name,
        m.middle_name,
        m.last_name,
        m.id_number,
        m.date_of_birth,
        m.gender,
        m.marital_status,
        m.phone_primary,
        m.phone_secondary,
        m.email,
        m.physical_address,
        COALESCE(b.branch_name, 'Unassigned') AS branch_name,
        m.status,
        m.join_date,
        m.photo_url,
        COALESCE(nok.next_of_kin, '[]'::json)         AS next_of_kin,
        COALESCE(sav.savings_accounts, '[]'::json)    AS savings_accounts,
        COALESCE(loa.loan_accounts, '[]'::json)       AS loan_accounts,
        COALESCE(shr.member_share_accounts, '[]'::json)      AS member_share_accounts
      FROM members m
      LEFT JOIN branches b ON b.branch_id = m.branch_id
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', nk.kin_id,
            'full_name', nk.full_name,
            'relationship', nk.relationship,
            'phone', nk.phone,
            'id_number', nk.id_number,
            'percentage_share', nk.percentage_share
          )
        ) AS next_of_kin
        FROM next_of_kin nk
        WHERE nk.member_id = m.member_id
      ) nok ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'savings_account_id', sa.savings_account_id,
            'account_no', sa.account_number,
            'product_name', sp.product_name,
            'balance', sa.balance,
            'status', sa.status
          )
        ) AS savings_accounts
        FROM savings_accounts sa
        JOIN savings_products sp ON sp.savings_product_id = sa.savings_product_id
        WHERE sa.member_id = m.member_id
      ) sav ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'loan_account_id', la.loan_id,
            'loan_no', la.loan_account_number,
            'product_name', lp.product_name,
            'principal_outstanding', la.outstanding_principal,
            'status', la.status,
            'days_overdue', eo.days_overdue
          )
        ) AS loan_accounts
        FROM loans la
        JOIN loan_products lp ON lp.loan_product_id = la.loan_product_id
        LEFT JOIN LATERAL (
          SELECT (CURRENT_DATE - ls.due_date)::int AS days_overdue
          FROM loan_repayment_schedule ls
          WHERE ls.loan_id = la.loan_id
            AND ls.is_paid = 'f'
            AND ls.due_date < CURRENT_DATE
          ORDER BY ls.due_date ASC
          LIMIT 1
        ) eo ON true
        WHERE la.member_id = m.member_id
      ) loa ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'share_account_id', sh.share_account_id,
            'shares_held', sh.number_of_shares,
            'value_at_par', sh.total_value
          )
        ) AS member_share_accounts
        FROM member_share_accounts sh
        WHERE sh.member_id = m.member_id
      ) shr ON true
      WHERE m.member_id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    if (rows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({ member: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`GET /api/v1/members/${id} failed:`, err);
    return NextResponse.json({ error: "Failed to load member" }, { status: 500 });
  } finally {
    client.release();
  }
}