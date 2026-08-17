"use server";

// app/actions/loan-repayment.ts
//
// Server actions for the loan repayment page.
// - Auth reads the cookie and calls verifyAuthToken directly — no session
//   abstraction layer in between.
// - Tenant id comes ONLY from the verified JWT (never from client input).
// - Loan id is UUID-validated before being interpolated into SET LOCAL,
//   since SET LOCAL cannot take a bound parameter.
// - Allocation is recomputed server-side; the client preview is UX only.

import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";
import { verifyAuthToken, type JWTPayload } from "@/app/lib/auth";
import { allocateRepayment } from "@/app/lib/loan-repayment/allocate";
import type {
  LoanRepaymentContext,
  RepaymentResult,
  RepaymentSubmission,
} from "@/types/loan-repayment";

const sql = neon(process.env.DATABASE_URL!);

const COOKIE_NAME = "sfx_session"; // <-- adjust to match whatever name you set the cookie with

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_METHODS = new Set(["MPESA", "CASH", "CHEQUE"]);
const ALLOWED_ROLES = new Set(["TELLER", "LOAN_OFFICER", "BRANCH_MANAGER", "ADMIN"]);

/**
 * Reads the cookie and verifies it with verifyAuthToken directly.
 * Returns null instead of throwing so callers decide how to handle it.
 */
async function getAuthPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
    console.log(token)
  return verifyAuthToken(token);

}

// ---------------------------------------------------------------------------
// Search loans by loan number / member number / member name, scoped to tenant
// ---------------------------------------------------------------------------
export async function searchLoansForRepayment(query: string) {
  const payload = await getAuthPayload();
  if (!payload) {
    throw new Error("Not authenticated");
  }
  if (!ALLOWED_ROLES.has(payload.role)) {
    throw new Error("Not permitted");
  }

  const tenantId = payload.tenantId;
  if (!UUID_RE.test(tenantId)) {
    throw new Error("Invalid tenant context");
  }

  const term = `%${query.trim()}%`;

  const rows = await sql`
    SELECT
      set_config('app.current_tenant', ${tenantId}, true),
      l.id                          AS loan_id,
      l.loan_number                 AS loan_number,
      m.id                          AS member_id,
      m.member_number               AS member_number,
      m.full_name                   AS member_name,
      lp.name                       AS product_name,
      l.outstanding_balance         AS outstanding_balance,
      l.par_bucket                  AS par_bucket,
      l.days_in_arrears             AS days_in_arrears,
      ls.next_due_date              AS next_due_date,
      ls.next_due_amount            AS next_due_amount
    FROM loans l
    JOIN members m         ON m.id = l.member_id
    JOIN loan_products lp  ON lp.id = l.product_id
    LEFT JOIN LATERAL (
      SELECT due_date AS next_due_date, total_due AS next_due_amount
      FROM loan_schedule
      WHERE loan_id = l.id AND status <> 'PAID'
      ORDER BY due_date ASC
      LIMIT 1
    ) ls ON true
    WHERE l.status = 'ACTIVE'
      AND (
        l.loan_number ILIKE ${term}
        OR m.member_number ILIKE ${term}
        OR m.full_name ILIKE ${term}
      )
    ORDER BY l.days_in_arrears DESC
    LIMIT 15
  `;

  return rows.map((r: any) => ({
    loanId: r.loan_id,
    loanNumber: r.loan_number,
    memberId: r.member_id,
    memberNumber: r.member_number,
    memberName: r.member_name,
    productName: r.product_name,
    outstandingBalance: Number(r.outstanding_balance),
    parBucket: r.par_bucket,
    daysInArrears: r.days_in_arrears,
    nextDueDate: r.next_due_date,
    nextDueAmount: r.next_due_amount ? Number(r.next_due_amount) : null,
  }));
}

// ---------------------------------------------------------------------------
// Load full context for a single loan (outstanding split by penalty/interest/principal)
// ---------------------------------------------------------------------------
export async function getLoanRepaymentContext(
  loanId: string
): Promise<LoanRepaymentContext> {
  const payload = await getAuthPayload();
  if (!payload) {
    throw new Error("Not authenticated");
  }
  if (!ALLOWED_ROLES.has(payload.role)) {
    throw new Error("Not permitted");
  }

  const tenantId = payload.tenantId;
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(loanId)) {
    throw new Error("Invalid identifier");
  }

  const rows = await sql`
    SELECT
      set_config('app.current_tenant', ${tenantId}, true),
      l.loan_id                     AS loan_id,
      l.loan_number            AS loan_number,
      m.full_name               AS member_name,
      m.member_number           AS member_number,
      lp.name                   AS product_name,
      l.principal_outstanding   AS principal_outstanding,
      l.interest_outstanding    AS interest_outstanding,
      l.penalty_outstanding     AS penalty_outstanding,
      l.par_bucket              AS par_bucket,
      l.days_in_arrears         AS days_in_arrears,
      l.disbursed_amount        AS disbursed_amount,
      l.disbursed_date          AS disbursed_date,
      ls.next_due_date          AS next_due_date
    FROM loans l
    JOIN members m ON m.member_id = l.member_id
    JOIN loan_products lp ON l.loan_product_id.id = l.product_id
    LEFT JOIN LATERAL (
      SELECT due_date AS next_due_date
      FROM loan_schedule
      WHERE loan_id = l.id AND status <> 'PAID'
      ORDER BY due_date ASC
      LIMIT 1
    ) ls ON true
    WHERE l.id = ${loanId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error("Loan not found");
  }

  const r: any = rows[0];
  const principal = Number(r.principal_outstanding);
  const interest = Number(r.interest_outstanding);
  const penalty = Number(r.penalty_outstanding);

  return {
    loanId: r.loan_id,
    loanNumber: r.loan_number,
    memberName: r.member_name,
    memberNumber: r.member_number,
    productName: r.product_name,
    principalOutstanding: principal,
    interestOutstanding: interest,
    penaltyOutstanding: penalty,
    totalOutstanding: round2(principal + interest + penalty),
    parBucket: r.par_bucket,
    daysInArrears: r.days_in_arrears,
    disbursedAmount: Number(r.disbursed_amount),
    disbursedDate: r.disbursed_date,
    nextDueDate: r.next_due_date,
  };
}

// ---------------------------------------------------------------------------
// Post the repayment: recompute allocation server-side, write payment +
// ledger + schedule updates in one transaction, return a receipt number.
// ---------------------------------------------------------------------------
export async function postLoanRepayment(
  submission: RepaymentSubmission
): Promise<RepaymentResult> {
  const payload = await getAuthPayload();
  if (!payload) {
    return { success: false, error: "Your session has expired. Please sign in again." };
  }
  if (!ALLOWED_ROLES.has(payload.role)) {
    return { success: false, error: "You don't have permission to post repayments." };
  }

  const tenantId = payload.tenantId;

  if (!UUID_RE.test(tenantId) || !UUID_RE.test(submission.loanId)) {
    return { success: false, error: "Invalid identifier" };
  }
  if (!ALLOWED_METHODS.has(submission.method)) {
    return { success: false, error: "Invalid payment method" };
  }
  if (!Number.isFinite(submission.amount) || submission.amount <= 0) {
    return { success: false, error: "Amount must be greater than zero" };
  }
  if (submission.method !== "CASH" && !submission.reference.trim()) {
    return { success: false, error: "A reference is required for this payment method" };
  }

  const loan = await getLoanRepaymentContext(submission.loanId);
  const allocation = allocateRepayment(submission.amount, loan);

  try {
    const rows = await sql`
      SELECT
        set_config('app.current_tenant', ${tenantId}, true),
        record_loan_repayment(
          ${submission.loanId}::uuid,
          ${submission.amount}::numeric,
          ${submission.method},
          ${submission.reference},
          ${submission.paidAt}::timestamptz,
          ${payload.userId}::uuid,
          ${submission.notes ?? null}
        ) AS receipt_number
    `;

    const receiptNumber = rows[0]?.receipt_number as string | undefined;

    return {
      success: true,
      receiptNumber,
      allocation,
    };
  } catch (err) {
    console.error("postLoanRepayment failed", err);
    return {
      success: false,
      error: "Could not post this repayment. No funds were recorded.",
    };
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}