import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { verifyAuthToken } from '@/app/lib/auth';
import { cookies } from 'next/headers';

// GET /api/v1/transactions/search?q=<receipt no / member name/no>&type=savings_deposit|savings_withdrawal|loan_repayment|all
//
// ASSUMPTION: adjust table/column names below to match your real schema.
// Expected shape per source table (rename as needed):
//   transactions(id, tenant_id, account_id, member_id, tx_type, amount, receipt_number, created_at)
//   loan_repayments(id, tenant_id, loan_id, member_id, amount_paid, receipt_number, paid_at)
export async function GET(req: NextRequest) {
  
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  
    const auth = await verifyAuthToken(token);
    if (!auth) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
  
    const { tenantId, userId, role } = auth;
  // AUTHETICATE ROLES

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const type = searchParams.get('type') ?? 'all';

  if (q.length < 2) {
    return NextResponse.json({ error: 'Search query too short' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = $1`, [auth.tenantId]);

    const like = `%${q}%`;
    const results: any[] = [];

    if (type === 'all' || type === 'savings_deposit' || type === 'savings_withdrawal') {
      const { rows } = await client.query(
        `SELECT
           st.transaction_id                    AS "id",
           'savings_' || st.tx_type AS "transactionType",
           st.member_id              AS "memberId",
           m.first_name || ' ' || m.last_name AS "memberName",
           st.amount                 AS "amount",
           st.receipt_number         AS "receiptNumber",
           st.created_at             AS "createdAt",
           st.description            AS "description",
           EXISTS (
             SELECT 1 FROM transaction_reversals tr
             WHERE tr.original_transaction_id = st.transaction_id
               AND tr.status IN ('pending','executed')
           ) AS "alreadyReversed"
         FROM transactions st
         JOIN members m ON m.id = st.member_id
         WHERE st.tenant_id = $1
           AND (st.receipt_number ILIKE $2 OR m.first_name ILIKE $2 OR m.last_name ILIKE $2 OR m.member_number ILIKE $2)
         ORDER BY st.created_at DESC
         LIMIT 25`,
        [auth.tenantId, like]
      );
      results.push(...rows);
    }

    if (type === 'all' || type === 'loan_repayment') {
      const { rows } = await client.query(
        `SELECT
           lr.id                     AS "id",
           'loan_repayment'          AS "transactionType",
           lr.member_id              AS "memberId",
           m.first_name || ' ' || m.last_name AS "memberName",
           lr.amount_paid            AS "amount",
           lr.receipt_number         AS "receiptNumber",
           lr.paid_at                AS "createdAt",
           NULL                      AS "description",
           EXISTS (
             SELECT 1 FROM transaction_reversals tr
             WHERE tr.original_transaction_id = lr.id
               AND tr.status IN ('pending','executed')
           ) AS "alreadyReversed"
         FROM loan_repayments lr
         JOIN members m ON m.id = lr.member_id
         WHERE lr.tenant_id = $1
           AND (lr.receipt_number ILIKE $2 OR m.first_name ILIKE $2 OR m.last_name ILIKE $2 OR m.member_number ILIKE $2)
         ORDER BY lr.paid_at DESC
         LIMIT 25`,
        [auth.tenantId, like]
      );
      results.push(...rows);
    }

    await client.query('COMMIT');

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ results });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('transaction search failed', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  } finally {
    client.release();
  }
}