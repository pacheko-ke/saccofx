import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { verifyAuthToken } from '@/app/lib/auth';
import { sendSMS } from '@/app/lib/africastalking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuthToken(req);
  if (!auth || !['admin', 'loan_supervisor', 'ceo'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!UUID_RE.test(auth.tenantId) || !UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const reason: string = (body.reason ?? '').trim().slice(0, 500);
  if (!reason) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${auth.tenantId}'`);

    const loanRes = await client.query(
      `
      SELECT la.id, la.status, m.phone_number AS "phoneNumber", m.first_name AS "firstName"
      FROM loan_accounts la
      JOIN members m ON m.id = la.member_id
      WHERE la.id = $1
      FOR UPDATE
      `,
      [params.id]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    const loan = loanRes.rows[0];
    if (!['pending', 'pending_second_approval'].includes(loan.status)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `Loan is already ${loan.status}` }, { status: 409 });
    }

    await client.query(
      `UPDATE loan_accounts
       SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2
       WHERE id = $3`,
      [auth.userId, reason, params.id]
    );

    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'loan_rejected', 'loan_account', $3, $4)`,
      [auth.tenantId, auth.userId, params.id, JSON.stringify({ reason })]
    );

    await client.query('COMMIT');

    if (loan.phoneNumber) {
      await sendSMS(
        loan.phoneNumber,
        `Dear ${loan.firstName}, your loan application was not approved at this time. Reason: ${reason}. Contact your branch for details.`
      ).catch((e) => console.error('SMS send failed', e));
    }

    return NextResponse.json({ status: 'rejected' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('loan reject error', err);
    return NextResponse.json({ error: 'Rejection failed' }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}