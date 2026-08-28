import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { verifyAuthToken } from '@/app/lib/auth';
import { cookies } from 'next/headers';

// Back-office only — this register isn't exposed on the member portal
const ALLOWED_ROLES = new Set(['admin', 'manager', 'teller']);

export async function GET(request: NextRequest) {
   const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let session;
  try {
    session = await verifyAuthToken(token);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // if (!ALLOWED_ROLES.has(session.role)) {
  //   return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  // }


  // CHECKING ROLES HERE


  const client = await pool.connect();
  const tenantId = session?.tenantId;
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const settingsResult = await client.query(
      `SELECT par_value_kes AS "parValueKes", minimum_shares AS "minShares"
       FROM share_settings WHERE tenant_id=$1
       LIMIT 1`,[tenantId]
    );
    const parValueKes = settingsResult.rows[0]?.parValueKes ?? 100;
    const minShares = settingsResult.rows[0]?.minShares ?? 100;

    const holdingsResult = await client.query(
      `SELECT
      m.member_id,
         m.member_number       AS "memberNo",
         m.first_name          AS "firstName",
         m.last_name           AS "lastName",
         (m.first_name || ' ' || m.last_name) AS "name",
        
         sa.number_of_shares        AS "sharesHeld",
         sa.opened_at          AS "dateJoined",
         sa.updated_at   AS "lastActivityAt",
         sa.status
       FROM member_share_accounts sa
       JOIN members m ON m.member_id = sa.member_id
       ORDER BY sa.number_of_shares DESC, m.last_name ASC`
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      holdings: holdingsResult.rows,
      parValueKes,
      minShares,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('GET /api/v1/shares error:', error);
    return NextResponse.json(error);
  } finally {
    client.release();
  }
}