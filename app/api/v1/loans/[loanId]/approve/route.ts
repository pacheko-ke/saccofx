import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { verifyAuthToken } from '@/app/lib/auth';
import { cookies } from 'next/headers';
import { sendSMS } from '@/app/lib/africastalking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUAL_APPROVAL_THRESHOLD = 500_000; // KES — move to sacco_config table if you want this tenant-configurable

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  const { loanId } = await params;
  // const auth = await verifyAuthToken(req);
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

  const body = await req.json().catch(() => ({}));
  const comment: string = (body.comment ?? '').slice(0, 500);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${payload.tenantId}'`);

    const loanRes = await client.query(
      `
      SELECT la.loan_id, la.status, la.principal_amount AS "principalAmount",
             la.first_approved_by AS "firstApprovedBy", la.member_id AS "memberId",
             m.phone_primary AS "phoneNumber", m.first_name AS "firstName"
      FROM loans la
      JOIN members m ON m.member_id = la.member_id
      WHERE la.loan_id = $1
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

    const needsDualApproval = Number(loan.principalAmount) >= DUAL_APPROVAL_THRESHOLD;
    let newStatus: string;
    let finalized = false;

    if (loan.status === 'pending' && needsDualApproval) {
      // First signature only
      newStatus = 'pending_second_approval';
      await client.query(
        `UPDATE loans
         SET status = $1, first_approved_by = $2, first_approved_at = NOW()
         WHERE loan_id = $3`,
        [newStatus, payload.userId, loanId]
      );
    } else if (loan.status === 'pending_second_approval') {
      // Second signature — must be a different person
      if (loan.firstApprovedBy === payload.userId) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Second approval must come from a different officer' },
          { status: 403 }
        );
      }
      newStatus = 'approved';
      finalized = true;
      await client.query(
        `UPDATE loans
         SET status = $1, approved_by = $2, approved_at = NOW()
         WHERE loan_id = $3`,
        [newStatus, payload.userId, loanId]
      );
    } else {
      // Below threshold, single signature suffices
      newStatus = 'approved';
      finalized = true;
      await client.query(
        `UPDATE loans
         SET status = $1, approved_by = $2, approved_at = NOW()
         WHERE loan_id = $3`,
        [newStatus, payload.userId, loanId]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, action_description)
       VALUES ($1, $2, $3, 'loans', $4, $5)`,
      [
        payload.tenantId,
        payload.userId,
        finalized ? 'loan_approved' : 'loan_first_approval',
        loanId,
        JSON.stringify({ comment, newStatus }),
      ]
    );

    await client.query('COMMIT');

    if (finalized && loan.phoneNumber) {
      await sendSMS(
        '0734871064',
        `Dear ${loan.firstName}, your loan application of KES ${Number(loan.principalAmount).toLocaleString()} has been approved. Disbursement will follow shortly.`
      ).catch((e) => console.error('SMS send failed', e));
    }

    return NextResponse.json({ status: newStatus, finalized });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('loan approve error', err);
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}