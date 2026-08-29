import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { verifyAuthToken } from '@/app/lib/auth';
import { cookies } from 'next/headers';

const REVIEW_ROLES = ['admin', 'manager'];

// POST /api/v1/reversals/[id]/approve
//
// Maker-checker: the approver must NOT be the same user who requested the reversal.
// Executes the reversal as an equal-and-opposite entry — never edits or deletes
// the original row. Adjust the per-type blocks below to match your real balance
// columns (this mirrors the FOR UPDATE + BEGIN/COMMIT pattern used in
// teller deposits / loan disbursement).
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = $1`, [tenantId]);

    const { rows: reversalRows } = await client.query(
      `SELECT * FROM transaction_reversals WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [id, auth.tenantId]
    );
    const reversal = reversalRows[0];
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
        { error: 'Maker-checker: you cannot approve a reversal you requested yourself' },
        { status: 403 }
      );
    }

    let reversalTransactionId: string;

    switch (reversal.transaction_type) {
      case 'savings_deposit':
      case 'savings_withdrawal': {
        const { rows: origRows } = await client.query(
          `SELECT * FROM savings_transactions WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
          [reversal.original_transaction_id, auth.tenantId]
        );
        const orig = origRows[0];
        if (!orig) throw new Error('Original savings transaction no longer exists');

        const { rows: acctRows } = await client.query(
          `SELECT * FROM savings_accounts WHERE id = $1 FOR UPDATE`,
          [orig.account_id]
        );
        const account = acctRows[0];
        if (!account) throw new Error('Savings account not found');

        // Opposite direction of the original movement
        const isReversingDeposit = reversal.transaction_type === 'savings_deposit';
        const newBalance = isReversingDeposit
          ? Number(account.balance) - Number(orig.amount)
          : Number(account.balance) + Number(orig.amount);

        if (newBalance < 0) throw new Error('Reversal would drive the account balance negative');

        const { rows: newTxn } = await client.query(
          `INSERT INTO savings_transactions
             (tenant_id, account_id, member_id, transaction_type, amount, balance_after, description, receipt_number, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id`,
          [
            auth.tenantId,
            orig.account_id,
            orig.member_id,
            isReversingDeposit ? 'withdrawal' : 'deposit',
            orig.amount,
            newBalance,
            `Reversal of receipt ${orig.receipt_number}: ${reversal.reason}`,
            `REV-${orig.receipt_number}`,
            auth.userId,
          ]
        );

        await client.query(`UPDATE savings_accounts SET balance = $1 WHERE id = $2`, [newBalance, account.id]);
        reversalTransactionId = newTxn[0].id;
        break;
      }

      case 'loan_repayment': {
        const { rows: origRows } = await client.query(
          `SELECT * FROM loan_repayments WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
          [reversal.original_transaction_id, auth.tenantId]
        );
        const orig = origRows[0];
        if (!orig) throw new Error('Original loan repayment no longer exists');

        const { rows: loanRows } = await client.query(
          `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
          [orig.loan_id]
        );
        const loan = loanRows[0];
        if (!loan) throw new Error('Loan not found');

        // Undo the FIFO allocation (penalty -> interest -> principal) by adding
        // each component back onto the outstanding balance.
        const newOutstanding =
          Number(loan.outstanding_balance) +
          Number(orig.principal_paid ?? 0) +
          Number(orig.interest_paid ?? 0) +
          Number(orig.penalty_paid ?? 0);

        const { rows: newRepayment } = await client.query(
          `INSERT INTO loan_repayments
             (tenant_id, loan_id, member_id, amount_paid, principal_paid, interest_paid, penalty_paid,
              receipt_number, paid_at, recorded_by, is_reversal, reverses_repayment_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), $9, true, $10)
           RETURNING id`,
          [
            auth.tenantId,
            orig.loan_id,
            orig.member_id,
            -Number(orig.amount_paid),
            -Number(orig.principal_paid ?? 0),
            -Number(orig.interest_paid ?? 0),
            -Number(orig.penalty_paid ?? 0),
            `REV-${orig.receipt_number}`,
            auth.userId,
            orig.id,
          ]
        );

        await client.query(`UPDATE loans SET outstanding_balance = $1 WHERE id = $2`, [newOutstanding, loan.id]);
        reversalTransactionId = newRepayment[0].id;
        break;
      }

      case 'gl_entry': {
        const { rows: origLines } = await client.query(
          `SELECT * FROM journal_lines WHERE journal_entry_id = $1`,
          [reversal.original_transaction_id]
        );
        if (origLines.length === 0) throw new Error('Original journal entry has no lines');

        const { rows: newEntry } = await client.query(
          `INSERT INTO journal_entries (tenant_id, entry_date, description, created_by, reverses_entry_id)
           VALUES ($1, now(), $2, $3, $4)
           RETURNING id`,
          [auth.tenantId, `Reversal: ${reversal.reason}`, auth.userId, reversal.original_transaction_id]
        );

        for (const line of origLines) {
          // Swap debit and credit to mirror the original posting
          await client.query(
            `INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
             VALUES ($1,$2,$3,$4)`,
            [newEntry[0].id, line.account_id, line.credit, line.debit]
          );
        }
        reversalTransactionId = newEntry[0].id;
        break;
      }

      default:
        throw new Error(`Unsupported transaction type: ${reversal.transaction_type}`);
    }

    await client.query(
      `UPDATE transaction_reversals
       SET status = 'executed', reviewed_by = $1, reviewed_at = now(),
           reversal_transaction_id = $2, executed_at = now()
       WHERE id = $3`,
      [auth.userId, reversalTransactionId, id]
    );

    await client.query(
      `INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
       VALUES ($1,$2,'reversal_approved_and_executed','transaction_reversals',$3,$4)`,
      [auth.tenantId, auth.userId, id, JSON.stringify({ reversalTransactionId })]
    );

    await client.query('COMMIT');
    return NextResponse.json({ status: 'executed', reversalTransactionId });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('approve reversal failed', err);
    return NextResponse.json({ error: err.message ?? 'Failed to execute reversal' }, { status: 500 });
  } finally {
    client.release();
  }
}