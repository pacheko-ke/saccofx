import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Pool } from "@neondatabase/serverless";
import { renderToBuffer } from "@react-pdf/renderer";
import { verifyAuthToken } from "@/app/lib/auth";
import { MemberStatementDocument, type StatementTransaction } from "@/app/lib/statement/statementDocument";

// react-pdf needs Node (fs, local fonts) — not the edge runtime.
export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RANGE_DAYS = 366;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Shared auth check ----------------------------------------------------
// Statements are strictly self-service: memberId comes only from the JWT.
// There is no "accountOwnerId" in the request body anywhere in this file.
async function authenticateMember() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const payload = await verifyAuthToken(token);
  if (!payload) return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };

  const { tenantId, userId, memberId } = payload;
  if (!UUID_RE.test(tenantId)) {
    return { error: NextResponse.json({ error: "Invalid tenant" }, { status: 400 }) };
  }
  if (!memberId) {
    // This route is member-facing only — staff should use the admin statement tooling.
    return { error: NextResponse.json({ error: "This endpoint is for member accounts only" }, { status: 403 }) };
  }

  return { tenantId, userId, memberId };
}

// --- GET: list the member's own accounts, for the statement picker --------
export async function GET() {
  const auth = await authenticateMember();
  if ("error" in auth) return auth.error;
  const { tenantId, memberId } = auth;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    // ASSUMPTION: a unified `savings_accounts` table covers savings, share
    // capital, and loan accounts. Adjust the query/columns to your real
    // schema if loans live in a separate accounts table.
    const result = await client.query(
      `SELECT sa.savings_account_id,sp.product_name,  sa.account_number, sa.status, sa.opened_at
       FROM savings_accounts sa
       LEFT JOIN savings_products sp ON sp.savings_product_id=sa.savings_product_id
       WHERE tenant_id = $1 AND member_id = $2 AND status IN ('active', 'dormant')
       ORDER BY sp.product_name, sa.opened_at`,
      [tenantId, memberId]
    );

    await client.query("COMMIT");
    return NextResponse.json({ accounts: result.rows });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to list member accounts:", err);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  } finally {
    client.release();
  }
}

// --- POST: generate and stream back the statement PDF ----------------------
export async function POST(req: NextRequest) {
  const auth = await authenticateMember();
  if ("error" in auth) return auth.error;
  const { tenantId, memberId } = auth;

  const body = await req.json().catch(() => null);
  const accountId: string | undefined = body?.accountId;
  const startDate: string | undefined = body?.startDate;
  const endDate: string | undefined = body?.endDate;

  if (!accountId || !UUID_RE.test(accountId)) {
    return NextResponse.json({ error: "A valid accountId is required" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Statement period cannot exceed ${MAX_RANGE_DAYS} days` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    // Ownership check — the account must belong to this member. This is the
    // real guard against a member fetching someone else's statement; RLS is
    // defense in depth on top of it.
    const accountResult = await client.query(
      `SELECT sa.savings_account_id, sp.product_name, sa.account_number, m.first_name,m.last_name, m.member_number, m.id_number,
              t.tenant_name AS sacco_name,t.sasra_reg_no
       FROM savings_accounts sa
       INNER JOIN savings_products sp ON sp.savings_product_id=sa.savings_product_id
       JOIN members m ON m.member_id = sa.member_id
       JOIN tenant t ON t.tenant_id = sa.tenant_id
       WHERE sa.savings_account_id = $1 AND sa.tenant_id = $2 AND sa.member_id = $3`,
      [accountId, tenantId, memberId]
    );

    if (accountResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    const account = accountResult.rows[0];

    // Opening balance = balance_after of the last transaction before the period start
    const openingResult = await client.query(
      `SELECT amount
       FROM transactions tx
       INNER JOIN savings_accounts sa ON sa.savings_account_id=tx.savings_account_id
       WHERE tx.tenant_id = $1 AND sa.savings_account_id = $2 AND tx_date < $3
       ORDER BY tx_date DESC, transaction_id DESC
       LIMIT 1`,
      [tenantId, accountId, startDate]
    );
    const openingBalance = openingResult.rows[0]?.amount ? Number(openingResult.rows[0].amount) : 0;

    const txResult = await client.query(
      `SELECT tx_date, narrative, amount
       FROM transactions
       WHERE tenant_id = $1 AND savings_account_id = $2 AND tx_date >= $3 AND tx_date <= $4
       ORDER BY tx_date ASC, transaction_id ASC`,
      [tenantId, accountId, startDate, endDate]
    );

    const transactions: StatementTransaction[] = txResult.rows.map((r) => ({
      date: r.tx_date,
      description: r.narrative ?? "",
      debit: r.debit ? Number(r.debit) : null,
      credit: r.credit ? Number(r.credit) : null,
      balanceAfter: Number(r.amount),
    }));

    const totalDebits = transactions.reduce((sum, t) => sum + (t.debit ?? 0), 0);
    const totalCredits = transactions.reduce((sum, t) => sum + (t.credit ?? 0), 0);
    const closingBalance = transactions.length > 0 ? transactions[transactions.length - 1].balanceAfter : openingBalance;

    await client.query("COMMIT");

    const pdfBuffer = await renderToBuffer(
      MemberStatementDocument({
        saccoName: account.sacco_name ?? "SaccoFX",
        saccoRegNo: account.sasra_reg_no ?? undefined,
        member: {

          firstName: account.first_name,
          lastName: account.last_name,

          memberNumber: account.member_number,
          idNumber: account.id_number,
        },
        account: {
          accountType: account.product_name,
          accountNumber: account.account_number,
        },
        period: { startDate, endDate },
        openingBalance,
        closingBalance,
        totalDebits,
        totalCredits,
        transactions,
        generatedAt: new Date().toISOString(),
      })
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statement-${account.account_number}-${startDate}-to-${endDate}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Statement generation failed:", err);
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 });
  } finally {
    client.release();
  }
}