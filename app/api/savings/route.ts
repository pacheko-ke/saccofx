import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const offset = (page - 1) * pageSize;

    const [members, totalResult] = await Promise.all([
      sql`
        SELECT
        savings_account_id,
        account_number AS "accountNumber",
        members.member_id,
        savings_accounts.member_id AS "idNumber",
        balance AS "balance",
        status AS "status",
        created_at AS "created"
        FROM savings_accounts
        INNER JOIN members ON savings_accounts.member_id=members.member_id
    
        
      `,
      sql`SELECT COUNT(*)::int AS count FROM members`,
    ]);

    const total = totalResult[0].count;

    return NextResponse.json({ members, total, page, pageSize });
  } catch (error) {
    console.log("Failed to fetch members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}