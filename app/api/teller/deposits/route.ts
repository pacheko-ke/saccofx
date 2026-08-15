import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";

const ALLOWED_METHODS = new Set(["cash", "cheque", "mpesa", "bank_transfer"]);
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authenticate(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

// GET /api/teller/deposits?date=YYYY-MM-DD
// Returns deposits posted by the logged-in teller for a given day (defaults to today),
// used for the running list + receipt reprints on the deposit page.
export async function GET(request: NextRequest) {
  const payload = await authenticate(request);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const safeDate = dateParam && dateRegex.test(dateParam) ? dateParam : null;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [
      payload.tenantId,
    ]);

    const result = await client.query(
      `
      SELECT
        st.transaction_id,
        st.reference_number,
        st.amount,
        st.channel,
        st.narrative,
        st.balance_after   AS "balanceAfter",
        st.created_at      AS "createdAt",
        st.journal_id AS "journalEntryId",
        sa.account_number       AS "accountNo",
        m.member_number         AS "memberNo",
        m.first_name          AS "firstName",
        m.last_name           AS "lastName"
      FROM transactions st
      JOIN savings_accounts sa ON sa.savings_account_id = st.savings_account_id
      JOIN members m ON m.member_id = sa.member_id
      WHERE st.tx_type = 'deposit'
        AND st.processed_by = $1
        AND st.created_at::date = COALESCE($2::date, CURRENT_DATE)
      ORDER BY st.created_at DESC
      LIMIT 100
      `,
      [payload.userId, safeDate]
    );

    return NextResponse.json({ deposits: result.rows });
  } catch (error) {
    console.error("Failed to fetch teller deposits:", error);
    return NextResponse.json({ error: "Failed to fetch deposits" }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}

// Chart-of-accounts codes used for the GL postings below.
// ADJUST THESE to match your actual seeded chart_of_accounts.code values.
// Debit side depends on deposit channel (where the money "lands"):
//   cash          -> teller's cash till (asset)
//   cheque        -> cheques-in-clearing (asset, until it clears)
//   mpesa         -> M-Pesa clearing/paybill settlement account (asset)
//   bank_transfer -> bank clearing account (asset)
// Credit side is a single Member Savings control account (liability);
// per-member/per-account detail lives in the savings subsidiary ledger,
// not as separate GL accounts.
const DEBIT_ACCOUNT_CODE: Record<string, string> = {
  cash: "TILL-CASH",
  cheque: "CHEQUES-CLEARING",
  mpesa: "MPESA-CLEARING",
  bank_transfer: "BANK-CLEARING",
};
const SAVINGS_CONTROL_ACCOUNT_CODE = "MEMBER-SAVINGS";

// POST /api/teller/deposits
// Body: { accountId, amount, method, reference?, narration? }
// Posts a deposit as a balanced double-entry journal entry
// (Dr. Cash/Till or clearing account, Cr. Member Savings control account),
// records the subsidiary savings_transactions row, and updates the
// member's savings_accounts balance — all atomically in one DB transaction.
export async function POST(request: NextRequest) {
  const payload = await authenticate(request);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only tellers/admins should be able to post deposits
  if (!["teller", "admin", "branch_manager"].includes(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    accountId?: string;
    amount?: number;
    method?: string;
    reference?: string;
    narration?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { accountId, amount, method, reference, narration } = body;

  if (!accountId || !uuidRegex.test(accountId)) {
    return NextResponse.json({ error: "Valid accountId is required" }, { status: 400 });
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  // Guard against float precision issues past 2dp for KES
  const amountKobo = Math.round(amount * 100);
  if (amountKobo <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }
  const safeAmount = amountKobo / 100;

  if (!method || !ALLOWED_METHODS.has(method)) {
    return NextResponse.json(
      { error: `method must be one of: ${[...ALLOWED_METHODS].join(", ")}` },
      { status: 400 }
    );
  }

  const safeReference = typeof reference === "string" ? reference.slice(0, 100) : null;
  const safeNarration = typeof narration === "string" ? narration.slice(0, 250) : null;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [
      payload.tenantId,
    ]);

    // Lock the account row to prevent concurrent deposits/withdrawals racing
    // on the same balance.
    const accountResult = await client.query(
      `
      SELECT id, member_id AS "memberId", account_no AS "accountNo", balance, status
      FROM savings_accounts
      WHERE id = $1
      FOR UPDATE
      `,
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const account = accountResult.rows[0];

    if (account.status !== "active") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `Account is ${account.status}, cannot post deposit` },
        { status: 400 }
      );
    }

    // Resolve the two GL accounts this deposit touches
    const debitCode = DEBIT_ACCOUNT_CODE[method];
    const glResult = await client.query(
      `
      SELECT code, id
      FROM chart_of_accounts
      WHERE code IN ($1, $2)
        AND is_active = true
      `,
      [debitCode, SAVINGS_CONTROL_ACCOUNT_CODE]
    );

    const debitAccount = glResult.rows.find((r) => r.code === debitCode);
    const creditAccount = glResult.rows.find(
      (r) => r.code === SAVINGS_CONTROL_ACCOUNT_CODE
    );

    if (!debitAccount || !creditAccount) {
      await client.query("ROLLBACK");
      console.error(
        `Missing chart_of_accounts entry for code(s): ${debitCode}, ${SAVINGS_CONTROL_ACCOUNT_CODE}`
      );
      return NextResponse.json(
        { error: "GL accounts are not configured for this deposit method" },
        { status: 500 }
      );
    }

    const entryNarration =
      safeNarration ||
      `Savings deposit — ${account.accountNo} via ${method.replace("_", " ")}`;

    // 1. Journal entry (event header)
    const journalEntryResult = await client.query(
      `
      INSERT INTO journal_entries (
        tenant_id, entry_date, reference, narration,
        source_type, source_id, created_by, created_at
      )
      VALUES ($1, CURRENT_DATE, $2, $3, 'savings_deposit', $4, $5, now())
      RETURNING id
      `,
      [payload.tenantId, safeReference, entryNarration, accountId, payload.userId]
    );
    const journalEntryId = journalEntryResult.rows[0].id;

    // 2. Journal lines — debits must equal credits
    await client.query(
      `
      INSERT INTO journal_lines
        (tenant_id, journal_entry_id, account_id, debit, credit, description)
      VALUES
        ($1, $2, $3, $5, 0, $6),
        ($1, $2, $4, 0, $5, $6)
      `,
      [
        payload.tenantId,
        journalEntryId,
        debitAccount.id,
        creditAccount.id,
        safeAmount,
        entryNarration,
      ]
    );

    // 3. Subsidiary ledger row — member/account-level detail behind the
    // control account, linked back to the journal entry.
    const newBalance = Number(account.balance) + safeAmount;

    const txResult = await client.query(
      `
      INSERT INTO transactions (
        tenant_id, account_id, member_id, type, amount,
        balance_after, channel, reference, narration,
        teller_id, journal_entry_id, created_at
      )
      VALUES ($1, $2, $3, 'deposit', $4, $5, $6, $7, $8, $9, $10, now())
      RETURNING id, created_at AS "createdAt"
      `,
      [
        payload.tenantId,
        accountId,
        account.memberId,
        safeAmount,
        newBalance,
        method,
        safeReference,
        safeNarration,
        payload.userId,
        journalEntryId,
      ]
    );

    // 4. Update the account balance
    await client.query(
      `UPDATE savings_accounts SET balance = $1, updated_at = now() WHERE id = $2`,
      [newBalance, accountId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      id: txResult.rows[0].id,
      journalEntryId,
      createdAt: txResult.rows[0].createdAt,
      accountId,
      amount: safeAmount,
      balanceAfter: newBalance,
      method,
      reference: safeReference,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to post deposit:", error);
    return NextResponse.json({ error: "Failed to post deposit" }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}