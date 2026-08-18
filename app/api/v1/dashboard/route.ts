import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const [
      savingsResult,
      membersResult,
      loansResult,
      disbursedResult,
    ] = await Promise.all([
      // 1. Convert NULL sum to 0 using COALESCE
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM savings_accounts`,
      // 2. Fixed double quotes to single quotes: 'active'
      sql`SELECT COUNT(*)::int AS count FROM members m WHERE m.status = 'active'`,
      sql`SELECT COUNT(*)::int AS count FROM loans`,
      // 3. Removed trailing comma & fixed single quotes: 'disbursed'
      sql`SELECT COUNT(*)::int AS count FROM loans l WHERE l.status = 'disbursed'`,
    ]);

   
    const totalSavings = savingsResult[0]?.total ?? 0;
    const totalActiveMembers = membersResult[0]?.count ?? 0;
    const totalActiveLoans = loansResult[0]?.count ?? 0;
    const loansDisbursed = disbursedResult[0]?.count ?? 0;

    return NextResponse.json(
      {kpi:{totalSavings,
      totalActiveMembers,
      totalActiveLoans,
      loansDisbursed}}
);
  } catch (error) {
    console.error("Failed to fetch dashboard metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard metrics" },
      { status: 500 }
    );
  }
}