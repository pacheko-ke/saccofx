import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { verifyAuthToken } from '@/app/lib/auth';
import { cookies } from 'next/headers';

const REVIEW_ROLES = ['admin', 'manager'];

// POST /api/v1/reversals/[id]/reject   { rejectionReason }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
   const { id } = await params;
 
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

  const { rejectionReason } = await req.json();
  if (!rejectionReason?.trim()) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = $1`, [auth.tenantId]);

    const { rows } = await client.query(
      `SELECT * FROM transaction_reversals WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [id, auth.tenantId]
    );
    const reversal = rows[0];
    if (!reversal) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Reversal request not found' }, { status: 404 });
    }
    if (reversal.status !== 'pending') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `Reversal is already ${reversal.status}` }, { status: 409 });
    }
    if (reversal.requested_by === auth.userId) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Maker-checker: you cannot review a reversal you requested yourself' },
        { status: 403 }
      );
    }

    await client.query(
      `UPDATE transaction_reversals
       SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), rejection_reason = $2
       WHERE id = $3`,
      [auth.userId, rejectionReason.trim(), id]
    );

    await client.query(
      `INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
       VALUES ($1,$2,'reversal_rejected','transaction_reversals',$3,$4)`,
      [auth.tenantId, auth.userId, id, JSON.stringify({ rejectionReason })]
    );

    await client.query('COMMIT');
    return NextResponse.json({ status: 'rejected' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('reject reversal failed', err);
    return NextResponse.json({ error: 'Failed to reject reversal' }, { status: 500 });
  } finally {
    client.release();
  }
}