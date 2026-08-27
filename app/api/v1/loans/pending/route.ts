import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { verifyAuthToken } from '@/lib/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const auth = await verifyAuthToken(req);
  if (!auth || !['admin', 'loan_supervisor', 'ceo'].includes(auth.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!UUID_RE.test(auth.tenantId)) {
    return NextResponse.json({ error: 'Invalid tenant' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending'; // pending | pending_second_approval | approved | rejected
  const search = searchParams.get('search') ?? '';
  const minAmount = Number(searchParams.get('minAmount') ?? 0);
  const maxAmount = Number(searchParams.get('maxAmount') ?? 0);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = 20;

  if (!Number.isFinite(minAmount) || !Number.isFinite(maxAmount)) {
    return NextResponse.json({ error: 'Invalid amount filter' }, { status: 400 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${auth.tenantId}'`);

    const params: any[] = [status];
    let paramIdx = 2;
    let searchClause = '';
    let amountClause = '';

    if (search) {
      searchClause = `AND (m.first_name || ' ' || m.last_name ILIKE $${paramIdx} OR m.member_number ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (maxAmount > 0) {
      amountClause = `AND la.principal_amount BETWEEN $${paramIdx} AND $${paramIdx + 1}`;
      params.push(minAmount, maxAmount);
      paramIdx += 2;
    }

    const result = await client.query(
      `
      SELECT
        la.id                     AS "loanId",
        la.principal_amount       AS "principalAmount",
        la.term_months            AS "termMonths",
        la.interest_rate          AS "interestRate",
        la.purpose                AS "purpose",
        la.status                 AS "status",
        la.applied_at             AS "appliedAt",
        la.first_approved_by      AS "firstApprovedBy",
        lp.name                   AS "productName",
        m.id                      AS "memberId",
        m.member_number           AS "memberNumber",
        m.first_name || ' ' || m.last_name AS "memberName",
        (
          SELECT COUNT(*) FROM loan_guarantors lg
          WHERE lg.loan_account_id = la.id AND lg.otp_verified = true
        )                         AS "guarantorsVerified",
        (
          SELECT COUNT(*) FROM loan_guarantors lg WHERE lg.loan_account_id = la.id
        )                         AS "guarantorsTotal",
        EXISTS (
          SELECT 1 FROM loan_accounts prior
          WHERE prior.member_id = m.id AND prior.status = 'in_arrears'
        )                         AS "hasArrearsFlag"
      FROM loan_accounts la
      JOIN members m ON m.id = la.member_id
      JOIN loan_products lp ON lp.id = la.loan_product_id
      WHERE la.status = $1
      ${searchClause}
      ${amountClause}
      ORDER BY la.applied_at ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
      params
    );

    const kpiResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')                    AS "pendingCount",
        COUNT(*) FILTER (WHERE status = 'pending_second_approval')    AS "awaitingSecondCount",
        COUNT(*) FILTER (WHERE status = 'approved' AND approved_at::date = CURRENT_DATE) AS "approvedTodayCount",
        COALESCE(SUM(principal_amount) FILTER (WHERE status IN ('pending','pending_second_approval')), 0) AS "totalValuePending"
      FROM loan_accounts
    `);

    await client.query('COMMIT');

    return NextResponse.json({
      loans: result.rows,
      kpis: kpiResult.rows[0],
      page,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('pending loans fetch error', err);
    return NextResponse.json({ error: 'Failed to load loans' }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}