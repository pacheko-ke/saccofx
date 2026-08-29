import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { verifyAuthToken } from '@/app/lib/auth';
import { cookies } from 'next/headers';

const REQUESTABLE_ROLES = ['admin', 'manager', 'loan_officer', 'teller'];
const REVIEW_ROLES = ['admin', 'manager'];

// GET /api/v1/reversals?status=pending&type=loan_repayment
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
  const status = searchParams.get('status');
  const type = searchParams.get('type');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = $1`, [auth.tenantId]);

    const conditions: string[] = ['tr.tenant_id = $1'];
    const params: any[] = [auth.tenantId];

    if (status) {
      params.push(status);
      conditions.push(`tr.status = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`tr.transaction_type = $${params.length}`);
    }

    const { rows } = await client.query(
      `SELECT
         tr.id                       AS "id",
         tr.transaction_type         AS "transactionType",
         tr.original_transaction_id  AS "originalTransactionId",
         tr.member_id                AS "memberId",
         m.first_name || ' ' || m.last_name AS "memberName",
         tr.amount                   AS "amount",
         tr.reason                   AS "reason",
         tr.status                   AS "status",
         tr.requested_by             AS "requestedBy",
         ru.name                     AS "requestedByName",
         tr.requested_at             AS "requestedAt",
         tr.reviewed_by              AS "reviewedBy",
         rv.name                     AS "reviewedByName",
         tr.reviewed_at              AS "reviewedAt",
         tr.rejection_reason         AS "rejectionReason",
         tr.reversal_transaction_id  AS "reversalTransactionId",
         tr.executed_at              AS "executedAt"
       FROM transaction_reversals tr
       LEFT JOIN members m ON m.member_id = tr.member_id
       LEFT JOIN users ru ON ru.user_id = tr.requested_by
       LEFT JOIN users rv ON rv.user_id = tr.reviewed_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY tr.requested_at DESC
       LIMIT 200`,
      params
    );

    await client.query('COMMIT');
    return NextResponse.json({ reversals: rows.map(r => ({ ...r, amount: Number(r.amount) })) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('list reversals failed', err);
    return NextResponse.json(err);
  } finally {
    client.release();
  }
}

// POST /api/v1/reversals  { transactionType, originalTransactionId, memberId, amount, reason }
export async function POST(req: NextRequest) {


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

  const body = await req.json();
  const { transactionType, originalTransactionId, memberId, amount, reason } = body;

  if (!transactionType || !originalTransactionId || !amount || !reason?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (reason.trim().length < 10) {
    return NextResponse.json({ error: 'Reason must be at least 10 characters' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = $1`, [auth.tenantId]);

    // Block duplicate active requests against the same source transaction
    const { rows: existing } = await client.query(
      `SELECT id FROM transaction_reversals
       WHERE tenant_id = $1 AND transaction_type = $2 AND original_transaction_id = $3
         AND status IN ('pending','executed')`,
      [auth.tenantId, transactionType, originalTransactionId]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'This transaction already has an active or executed reversal request' },
        { status: 409 }
      );
    }

    const { rows } = await client.query(
      `INSERT INTO transaction_reversals
         (tenant_id, transaction_type, original_transaction_id, member_id, amount, reason, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, status, requested_at AS "requestedAt"`,
      [auth.tenantId, transactionType, originalTransactionId, memberId ?? null, amount, reason.trim(), auth.userId]
    );

    await client.query(
      `INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
       VALUES ($1,$2,'reversal_requested','transaction_reversals',$3,$4)`,
      [auth.tenantId, auth.userId, rows[0].id, JSON.stringify({ transactionType, originalTransactionId, amount, reason })]
    );

    await client.query('COMMIT');
    return NextResponse.json({ reversal: rows[0] }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create reversal request failed', err);
    return NextResponse.json({ error: 'Failed to create reversal request' }, { status: 500 });
  } finally {
    client.release();
  }
}