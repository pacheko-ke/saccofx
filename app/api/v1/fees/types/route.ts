import { NextResponse } from "next/server";
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
  if (!UUID_RE.test(payload.tenantId) ) {
    
    return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
  }
const tenantID = payload.tenantId;
  const client = await pool.connect();
  try {
    const feeTypes = await client.query(`
    SELECT * FROM fee_types WHERE tenant_id=$1
  `,[tenantID])
    return NextResponse.json(feeTypes.rows);
  } catch (error) {
    return NextResponse.json(error)
  } finally {
    client.release();
  }
}