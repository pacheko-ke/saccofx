import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { verifyAuthToken } from '@/app/lib/auth';
import { cookies } from 'next/headers';
import { sendSMS } from '@/app/lib/africastalking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const cookieStore = await cookies();
  const auth = cookieStore.get("auth_token")?.value;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyAuthToken(auth);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  if (!payload || ['admin', 'loan_supervisor', 'ceo'].includes(payload.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!UUID_RE.test(payload.tenantId) || !UUID_RE.test(loanId)) {
    console.log(loanId)
    return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
  }


  if (!auth || !['admin', 'loan_supervisor', 'ceo'].includes(payload.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!UUID_RE.test(payload.tenantId) || !UUID_RE.test(loanId)) {
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
    await client.query(`SET LOCAL app.current_tenant = '${payload.tenantId}'`);

    const loanRes = await client.query(
      `
      SELECT la.id, la.status, m.phone_number AS "phoneNumber", m.first_name AS "firstName"
      FROM loan_accounts la
      JOIN members m ON m.id = la.member_id
      WHERE la.id = $1
      FOR UPDATE
      `,
      [loanId]
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
      [payload.userId, reason, loanId]
    );

    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'loan_rejected', 'loan_account', $3, $4)`,
      [payload.tenantId, payload.userId, loanId, JSON.stringify({ reason })]
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