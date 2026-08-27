
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { verifyAuthToken } from '@/app/lib/auth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateAmortizationSchedule({
  principal,
  annualRatePct,
  termMonths,
  startDate,
}: {
  principal: number;
  annualRatePct: number;
  termMonths: number;
  startDate: Date;
}) {
  const monthlyRate = annualRatePct / 100 / 12;
  const installment =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);

  const rows = [];
  let balance = principal;

  for (let period = 1; period <= termMonths; period++) {
    const interestDue = balance * monthlyRate;
    let principalDue = installment - interestDue;

    // Final installment absorbs rounding drift so balance hits exactly 0
    if (period === termMonths) {
      principalDue = balance;
    }

    balance = Math.max(0, balance - principalDue);

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + period);

    rows.push({
      period,
      dueDate: dueDate.toISOString().slice(0, 10),
      principalDue: Number(principalDue.toFixed(2)),
      interestDue: Number(interestDue.toFixed(2)),
      totalDue: Number((principalDue + interestDue).toFixed(2)),
      balanceAfter: Number(balance.toFixed(2)),
    });
  }

  return rows;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuthToken(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId, userId, role } = auth;
  const loanId = params.id;

  if (!UUID_REGEX.test(tenantId) || !UUID_REGEX.test(loanId)) {
    return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
  }

  if (!['loan_officer', 'admin', 'credit_committee'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    // 1. Lock the loan row and pull product terms + guarantor status together
    const loanRes = await client.query(
      `
      SELECT
        la.id,
        la.status,
        la.principal_requested AS "principalRequested",
        la.term_months AS "termMonths",
        la.member_id AS "memberId",
        lp.interest_rate AS "interestRate",
        lp.max_amount AS "maxAmount",
        lp.min_amount AS "minAmount",
        (SELECT COUNT(*) FROM loan_guarantors lg WHERE lg.loan_account_id = la.id) AS "totalGuarantors",
        (SELECT COUNT(*) FROM loan_guarantors lg WHERE lg.loan_account_id = la.id AND lg.status = 'verified') AS "verifiedGuarantors"
      FROM loan_accounts la
      JOIN loan_products lp ON lp.id = la.loan_product_id
      WHERE la.id = $1
      FOR UPDATE
      `,
      [loanId]
    );

    if (loanRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const loan = loanRes.rows[0];

    if (loan.status !== 'pending_approval') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `Cannot approve loan in status '${loan.status}'` },
        { status: 409 }
      );
    }

    if (Number(loan.verifiedGuarantors) < Number(loan.totalGuarantors)) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Not all guarantors have verified' },
        { status: 409 }
      );
    }

    const principal = Number(loan.principalRequested);
    if (principal < Number(loan.minAmount) || principal > Number(loan.maxAmount)) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Requested amount outside product limits' },
        { status: 422 }
      );
    }

    // 2. Flip status to approved
    await client.query(
      `
      UPDATE loan_accounts
      SET status = 'approved', approved_by = $1, approved_at = NOW()
      WHERE id = $2
      `,
      [userId, loanId]
    );

    // 3. Generate the amortization schedule now that terms are locked in
    const schedule = generateAmortizationSchedule({
      principal,
      annualRatePct: Number(loan.interestRate),
      termMonths: Number(loan.termMonths),
      startDate: new Date(),
    });

    for (const row of schedule) {
      await client.query(
        `
        INSERT INTO loan_schedule
          (loan_account_id, period, due_date, principal_due, interest_due, total_due, balance_after, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        `,
        [
          loanId,
          row.period,
          row.dueDate,
          row.principalDue,
          row.interestDue,
          row.totalDue,
          row.balanceAfter,
        ]
      );
    }

    // 4. Audit trail
    await client.query(
      `
      INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, 'LOAN_APPROVED', 'loan_accounts', $3, $4)
      `,
      [
        tenantId,
        userId,
        loanId,
        JSON.stringify({ principal, termMonths: loan.termMonths, installment: schedule[0]?.totalDue }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({ success: true, scheduleRows: schedule.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Loan approval failed:', err);
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}