// app/api/v1/member/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import { verifyAuthToken } from "@/app/lib/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  // This route is member-scoped by design: it always returns the caller's
  // own data, derived from the JWT — never from a query param — so one
  // member can never fetch another member's balances by editing the URL.
  // scope to member_portal_user

  if (payload.role !== "member_portal_user") {
    return NextResponse.json(
      { error: "This endpoint is for member accounts only" },
      { status: 403 }
    );
  }

  const tenantId = String(payload.tenantId ?? "");
  const memberId = String(payload.memberId ?? "");

  if (!UUID_RE.test(memberId)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }
  if (!UUID_RE.test(memberId)) {
    return NextResponse.json({ error: "No member record linked to this account" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // SET LOCAL can't take $1 placeholders — safe here only because
    // tenantId was validated against UUID_RE above.
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const [
      profileResult,
      balancesResult,
      prevBalancesResult,
      nextRepaymentResult,
      savingsTrendResult,
      transactionsResult,
      loansResult,
    ] = await Promise.all([
      // ── Member profile ──────────────────────────────────────
      client.query(
        `SELECT member_id as memberNumber,member_number, first_name, last_name, created_at
         FROM members
         WHERE member_id = $1
         LIMIT 1`,
        [memberId]
      ),

      // ── Current balances ─────────────────────────────────────
      client.query(
        `SELECT
          (SELECT COALESCE(SUM(balance), 0) FROM savings_accounts
            WHERE member_id = $1 AND status = 'active') AS savings_balance,
          (SELECT COALESCE(SUM(number_of_shares), 0) FROM member_share_accounts
            WHERE member_id = $1) AS share_capital,
          (SELECT outstanding_principal+outstanding_interest AS outstanding_balance FROM loans
            WHERE member_id = $1 AND status IN ('active', 'overdue')) AS active_loan_balance`,
        [memberId]
      ),

      // ── Savings balance as of start of this month, for % change ─────
      client.query(
        `SELECT COALESCE(SUM(balance), 0) AS prev_savings_balance
         FROM savings_accounts
         WHERE member_id = $1 AND status = 'active' AND created_at < date_trunc('month', now())`,
        [memberId]
      ),

      // ── Next loan repayment due ───────────────────────────────
      client.query(
        `SELECT ls.total_due, ls.due_date
         FROM loan_repayment_schedule ls
         JOIN loans la ON la.loan_id = ls.loan_id
         WHERE la.member_id = $1 AND ls.is_paid = false
         ORDER BY ls.due_date ASC
         LIMIT 1`,
        [memberId]
      ),

      // ── 7-month savings trend ─────────────────────────────────
      client.query(
        `SELECT
          to_char(month, 'Mon') AS month,
          COALESCE(
            (SELECT SUM(st.amount) FROM transactions st
              WHERE st.member_id = $1
                AND st.tx_type = 'deposit'
                AND st.tx_date <= (month + interval '1 month' - interval '1 day')),
            0
          ) AS balance
         FROM generate_series(
           date_trunc('month', now()) - interval '6 months',
           date_trunc('month', now()),
           interval '1 month'
         ) AS month
         ORDER BY month`,
        [memberId]
      ),

      // ── Recent transactions (last 10, across savings + shares + loans) ─
      client.query(
        `(SELECT
            transaction_id AS id,
            tx_date AS date,
           
            CASE WHEN tx_type = 'deposit' THEN 'deposit' ELSE 'withdrawal' END AS type,
            CASE WHEN tx_type = 'deposit' THEN amount ELSE -amount END AS amount,
            balance_after
          FROM transactions
          WHERE member_id = $1)
         UNION ALL
         (SELECT
            share_tx_id AS id,
            tx_date AS date,
    
            'share_purchase' AS type,
            amount,
            msa.number_of_shares
          FROM share_transactions st
          LEFT JOIN member_share_accounts msa ON msa.share_account_id=st.share_account_id
          WHERE member_id = $1)
         UNION ALL
         (SELECT
            repayment_id AS id,
        paid_at AS date,
         
            'loan_repayment' AS type,
            -amount_paid AS amount,
            principal_component
          FROM loan_repayments
          WHERE member_id = $1
          )
         ORDER BY date DESC
         LIMIT 10`,
        [memberId]
      ),

      // ── Active/overdue/cleared loans ──────────────────────────
      client.query(
        `SELECT
          la.loan_id,
          lp.product_name,
          la.outstanding_principal,
          la.outstanding_interest,
          la.status,
          (SELECT MIN(ls.due_date) FROM loan_repayment_schedule ls
            WHERE ls.loan_id = la.loan_id AND ls.is_paid = false) AS next_due_date
         FROM loans la
         JOIN loan_products lp ON lp.loan_product_id = la.loan_product_id
         WHERE la.member_id = $1
         ORDER BY
           CASE la.status WHEN 'overdue' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
           la.disbursed_at DESC
         LIMIT 10`,
        [memberId]
      ),
    ]);

    await client.query("COMMIT");

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: "Member record not found" }, { status: 404 });
    }

    const profile = profileResult.rows[0];
    const balances = balancesResult.rows[0];
    const num = (v: unknown) => Number(v ?? 0); // Neon returns numeric as string

    const savingsBalance = num(balances.savings_balance);
    const prevSavingsBalance = num(prevBalancesResult.rows[0]?.prev_savings_balance);
    const savingsChangePct =
      prevSavingsBalance === 0
        ? savingsBalance === 0
          ? 0
          : 100
        : ((savingsBalance - prevSavingsBalance) / prevSavingsBalance) * 100;

    const nextRepayment = nextRepaymentResult.rows[0]
      ? {
          amount: num(nextRepaymentResult.rows[0].total_due),
          dueDate: nextRepaymentResult.rows[0].due_date,
        }
      : null;

    return NextResponse.json({
      summary: {
        memberId: profile.member_id,
        memberNumber: profile.member_number,
        fullName: `${profile.first_name} ${profile.last_name}`,
        memberSince: profile.created_at,
        savingsBalance,
        // update per share *100 amount with sacco config from tenant db
        shareCapital: num(balances.share_capital*100),
        activeLoanBalance: num(balances.active_loan_balance),
        nextLoanRepayment: nextRepayment,
        savingsChangePct,
      },
      savingsTrend: savingsTrendResult.rows.map((r) => ({
        month: r.month,
        balance: num(r.balance),
      })),
      recentTransactions: transactionsResult.rows.map((r) => ({
        id: r.id,
        date: r.date,
        narrative: r.narrative,
        type: r.type,
        amount: num(r.amount),
        balanceAfter: num(r.balance_after),
      })),
      loans: loansResult.rows.map((r) => ({
        loanId: r.loan_id,
        productName: r.product_name,
        outstandingBalance: num(r.outstanding_principal+r.outstanding_interest),
        nextDueDate: r.next_due_date ?? null,
        status: r.status,
      })),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Member dashboard fetch failed:", err);
    return NextResponse.json({ error: "Failed to load your dashboard" }, { status: 500 });
  } finally {
    client.release();
  }
}