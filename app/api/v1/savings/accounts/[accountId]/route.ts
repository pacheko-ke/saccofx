import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db'; // shared pool — do NOT call pool.end() here
import { verifyAuthToken } from '@/app/lib/auth';

const ALLOWED_ROLES = new Set(['admin', 'teller', 'loan_officer', 'manager', 'member_portal_user']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  if (!UUID_REGEX.test(accountId)) {
    return NextResponse.json({ success: false, error: 'Invalid account id' }, { status: 400 });
  }

  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyAuthToken(token);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

//   if (!ALLOWED_ROLES.has(payload.role)) {
//     return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
//   }

//CHECKING ROLES HERE



  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

  const client = await pool.connect();
  const tenantID = payload?.tenantId
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${tenantID}'`);

    const accountResult = await client.query(
      `SELECT
         sa.savings_account_id,
         sa.account_number      AS "accountNumber",
         sa.status,
         sa.balance,
         sa.available_balance   AS "availableBalance",
         sa.opened_at           AS "openedAt",
         sa.closed_at           AS "closedAt",
         sp.product_name                AS "productName",
         sp.interest_rate_pa       AS "interestRate",
         sp.minimum_balance     AS "minimumBalance",
         m.member_id                   AS "memberId",
         m.member_number        AS "memberNumber",
         m.first_name           AS "firstName",
         m.last_name            AS "lastName",
         m.phone_primary         AS "phoneNumber"
       FROM savings_accounts sa
       JOIN savings_products sp ON sp.savings_product_id = sa.savings_product_id
       JOIN members m ON m.member_id = sa.member_id
       WHERE sa.savings_account_id = $1::uuid`,
      [accountId]
    );

    if (accountResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    const account = accountResult.rows[0];

    // Member portal users may only view their own account
    // if (payload?.role === 'member_portal_user' && account.memberId !== payload.memberId) {
    //   await client.query('ROLLBACK');
    //   return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    // }

    const transactionsResult = await client.query(
      `SELECT
         transaction_id,
         tx_type AS "transactionType",
         amount,
         balance_after     AS "balanceAfter",
         narrative,
         reference_number,
         created_at        AS "createdAt"
       FROM transactions
       WHERE savings_account_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM transactions WHERE savings_account_id = $1::uuid`,
      [accountId]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: {
        account,
        transactions: transactionsResult.rows,
        pagination: { limit, offset, total: countResult.rows[0].count },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('GET /api/v1/savings/accounts/[accountId] error:', error);
    return NextResponse.json(error);
  } finally {
    client.release();
  }
}