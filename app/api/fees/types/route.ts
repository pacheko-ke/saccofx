import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const offset = (page - 1) * pageSize;

    const [fees]  = await Promise.all([
      sql`
      SELECT * FROM fee_types
      `,
    
    ]);

    // const total = totalResult[0].count;

    return NextResponse.json({ fees });
  } catch (error) {
    console.log("Failed to fetch loans:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}