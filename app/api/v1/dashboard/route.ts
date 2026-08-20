// app/api/v1/dashboard/route.ts
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

  const userId = String(payload.userId ?? "");
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // SET LOCAL can't take $1 placeholders — safe here only because userId
    // was validated against UUID_RE above.
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);

    const [
      totalsResult,
      parResult,
      disbursedMtdResult,
      savingsTrendResult,
      cashflowResult,
      activityResult,
      membersResult,
    ] = await Promise.all([
      // ── Core KPI totals ────────────────────────────────────
      client.query(`
        SELECT
          (SELECT COALESCE(SUM(balance), 0) FROM savings_accounts WHERE status = 'active') AS total_savings,
          (SELECT COALESCE(SUM(shares_count), 0) FROM share_transactions) AS total_shares,
          (SELECT COUNT(*) FROM members WHERE status = 'active') AS active_members,
          (SELECT COUNT(*) FROM loans WHERE status != 'closed') AS active_loans,
          (SELECT COALESCE(SUM(balance), 0) FROM savings_accounts
            WHERE created_at < date_trunc('month', now())) AS prev_savings,
          (SELECT COALESCE(SUM(shares_count), 0) FROM share_transactions
            WHERE created_at < date_trunc('month', now())) AS prev_shares,
          (SELECT COUNT(*) FROM members
            WHERE status = 'active' AND created_at < date_trunc('month', now())) AS prev_members,
          (SELECT COUNT(*) FROM loans
            WHERE status = 'active' AND disbursed_at < date_trunc('month', now())) AS prev_loans
      `),

      // ── Portfolio at Risk buckets (SASRA convention, based on max days
      //    overdue per loan across unpaid schedule installments) ─────────
      client.query(`
        WITH loan_overdue AS (
          SELECT
            ls.loan_id,
            MAX(GREATEST(CURRENT_DATE - ls.due_date, 0)) AS days_overdue
          FROM loan_repayment_schedule ls
          WHERE ls.is_paid = false AND ls.due_date < CURRENT_DATE
          GROUP BY ls.loan_id
        )
        SELECT
          CASE
            WHEN lo.days_overdue IS NULL THEN 'performing'
            WHEN lo.days_overdue BETWEEN 1 AND 30 THEN 'watch'
            WHEN lo.days_overdue BETWEEN 31 AND 90 THEN 'substandard'
            WHEN lo.days_overdue BETWEEN 91 AND 180 THEN 'doubtful'
            ELSE 'loss'
          END AS bucket,
          COUNT(*) AS loan_count
        FROM loans la
        LEFT JOIN loan_overdue lo ON lo.loan_id = la.loan_id
        WHERE la.status = 'active'
        GROUP BY bucket
      `),

      // ── Disbursed month-to-date ─────────────────────────────
      client.query(`
        SELECT COALESCE(SUM(principal_amount), 0) AS disbursed_mtd
        FROM loans
        WHERE disbursed_at >= date_trunc('month', now())
      `),

      // ── 7-month savings & share capital trend ───────────────
      client.query(`
        SELECT
          to_char(month, 'Mon') AS month,
          COALESCE(sav.total, 0) AS savings,
          COALESCE(sh.total, 0) AS share_capital
        FROM generate_series(
          date_trunc('month', now()) - interval '6 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS month
        LEFT JOIN (
          SELECT date_trunc('month', tx_date) AS m, SUM(amount) AS total
          FROM transactions
          WHERE tx_type = 'deposit'
          GROUP BY 1
        ) sav ON sav.m = month
        LEFT JOIN (
          SELECT date_trunc('month', tx_date) AS m, SUM(amount) AS total
          FROM share_transactions
          GROUP BY 1
        ) sh ON sh.m = month
        ORDER BY month
      `),

      // ── 7-month deposits vs withdrawals ──────────────────────
      client.query(`
        SELECT
          to_char(date_trunc('month', tx_date), 'Mon') AS month,
          COALESCE(SUM(amount) FILTER (WHERE tx_type = 'deposit'), 0) AS deposits,
          COALESCE(SUM(amount) FILTER (WHERE tx_type = 'withdrawal'), 0) AS withdrawals
        FROM transactions
        WHERE tx_date >= date_trunc('month', now()) - interval '6 months'
        GROUP BY 1, date_trunc('month', tx_date)
        ORDER BY date_trunc('month', tx_date)
      `),

      // ── Recent activity (audit log) ──────────────────────────
      client.query(`
        SELECT
          u.username AS user_name,
          al.action AS action,
          al.created_at AS time
        FROM audit_logs al
        JOIN users u ON u.user_id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 5
      `),

      // ── Recently active members ──────────────────────────────
      client.query(`
        SELECT
          m.member_id,
          m.first_name || ' ' || m.last_name AS name,
          COALESCE(sa.balance, 0) AS amount,
          m.status
        FROM members m
        LEFT JOIN savings_accounts sa ON sa.member_id = m.member_id AND sa.status = 'active'
        ORDER BY m.created_at DESC
        LIMIT 4
      `),
    ]);

    await client.query("COMMIT");

    // ── Shape response ─────────────────────────────────────────
    const t = totalsResult.rows[0];
    const num = (v: unknown) => Number(v ?? 0); // Neon returns numeric as string

    const pctChange = (curr: number, prev: number) =>
      prev === 0 ? "+0.0%" : `${curr >= prev ? "+" : ""}${(((curr - prev) / prev) * 100).toFixed(1)}%`;

    const totalSavings = num(t.total_savings);
    const totalShares = num(t.total_shares);
    const activeMembers = num(t.active_members);
    const activeLoans = num(t.active_loans);

    const parRows = parResult.rows;
    const parLoanCount = parRows
      .filter((r) => r.bucket !== "performing")
      .reduce((s, r) => s + Number(r.loan_count), 0);
    const totalLoanCount = parRows.reduce((s, r) => s + Number(r.loan_count), 0);
    const parRate = totalLoanCount === 0 ? 0 : (parLoanCount / totalLoanCount) * 100;

    const kpis = [
      {
        label: "Total Savings",
        value: `KES ${(totalSavings / 1_000_000).toFixed(2)}M`,
        change: pctChange(totalSavings, num(t.prev_savings)),
        trend: totalSavings >= num(t.prev_savings) ? "up" : "down",
        icon: "PiggyBank",
      },
      {
        label: "Share Capital",
        // value per share will be obtained from user config
        value: `KES ${(totalShares * 100 / 1_000_000).toFixed(2)}M`,
        change: pctChange(totalShares, num(t.prev_shares)),
        trend: totalShares >= num(t.prev_shares) ? "up" : "down",
        icon: "Wallet",
      },
      {
        label: "Active Members",
        value: String(activeMembers),
        change: pctChange(activeMembers, num(t.prev_members)),
        trend: activeMembers >= num(t.prev_members) ? "up" : "down",
        icon: "Users",
      },
      {
        label: "Active Loans",
        value: String(activeLoans),
        change: pctChange(activeLoans, num(t.prev_loans)),
        trend: activeLoans >= num(t.prev_loans) ? "up" : "down",
        icon: "Landmark",
      },
      {
        label: "Portfolio at Risk",
        value: `${parRate.toFixed(1)}%`,
        change: "",
        trend: parRate > 5 ? "down" : "up",
        sub: "PAR > 30 days",
        icon: "ShieldAlert",
      },
      {
        label: "Disbursed (MTD)",
        value: `KES ${(num(disbursedMtdResult.rows[0].disbursed_mtd) / 1_000_000).toFixed(2)}M`,
        change: "",
        trend: "up",
        icon: "TrendingUp",
      },
    ];

    const portfolio = ["performing", "watch", "substandard", "doubtful", "loss"].map((bucket) => ({
      name: bucket.charAt(0).toUpperCase() + bucket.slice(1),
      value: Number(parRows.find((r) => r.bucket === bucket)?.loan_count ?? 0),
    }));

    const savingsTrend = savingsTrendResult.rows.map((r) => ({
      month: r.month,
      savings: num(r.savings) / 1_000_000,
      shareCapital: num(r.share_capital) / 1_000_000,
    }));

    const cashflow = cashflowResult.rows.map((r) => ({
      month: r.month,
      deposits: num(r.deposits) / 1_000_000,
      withdrawals: num(r.withdrawals) / 1_000_000,
    }));

    const activity = activityResult.rows.map((r) => ({
      user: r.user_name,
      action: r.action,
      time: timeAgo(new Date(r.time)),
    }));

    const members = membersResult.rows.map((r) => ({
      id: r.member_id,
      name: r.name,
      amount: `KES ${num(r.amount).toLocaleString()}`,
      status: r.status.charAt(0).toUpperCase() + r.status.slice(1),
    }));

    return NextResponse.json({ kpis, activity, members, savingsTrend, cashflow, portfolio });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Dashboard fetch failed:", err);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  } finally {
    client.release();
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}