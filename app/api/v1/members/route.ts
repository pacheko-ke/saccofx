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
        id_number      AS "idNumber",
        member_id,
          member_number   AS "memberNumber",
          first_name      AS "firstName",
          last_name       AS "lastName",
          phone_primary  AS "phone",
          status,
          join_date      AS "createdAt"
        FROM members
        ORDER BY join_date DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
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