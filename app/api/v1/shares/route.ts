import { NextRequest, NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth"; 

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getAuthPayload() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) return null;
  try {
    return await verifyAuthToken(token);
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  const payload = await getAuthPayload();
  console.log(payload)
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member_id = payload.memberId;

  if (!member_id) {
    console.log(`member id is ${member_id}`)
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // tenantId validated via Number.isInteger() above — SET LOCAL can't take $1 placeholders
    await client.query(`SET LOCAL app.current_tenant = ${member_id}`);

    const { rows } = await client.query(
      `
      SELECT
       number_of_shares AS "sharesHeld",
       join_date AS "dateJoined",
       first_name AS "firstName",
       last_name AS "lastName",
       m.member_number AS "memberNo",
       msa.status,
       msa.updated_at AS "lastActivityAt"

        FROM members m LEFT JOIN member_share_accounts msa ON m.member_id=msa.member_id
      `
    );

    await client.query("COMMIT");
    return NextResponse.json({ holdings: rows, parValueKes: 100, minShares: 100 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("GET /api/shares failed:", err);
    return NextResponse.json({ error: "Failed to load share holdings" }, { status: 500 });
  } finally {
    client.release();
  }
}