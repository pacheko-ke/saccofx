// Retrieve charges per member

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {

  // authenticate user
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

  if (!payload || ['loan.approve'].includes(payload.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!UUID_RE.test(payload.tenantId)) {

    return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
  }

  const tenantID = payload.tenantId;


  const client = await pool.connect()
  try {
    const feeCharges = await client.query(`
    SELECT m.member_id,ft.fee_name as "feeTypeName",m.first_name,f.amount as "amount",m.member_number as "memberNumber",m.last_name 
    FROM fee_charges f INNER JOIN
     members m ON m.member_id=f.member_id
     INNER JOIN fee_types ft ON ft.fee_type_id=f.fee_type_id  WHERE f.tenant_id=$1
  `, [tenantID])
    console.log(feeCharges.rows)
    return NextResponse.json(feeCharges.rows);
  } catch (error) {
    return NextResponse.json(error)
  } finally {
    client.release();
  }
}