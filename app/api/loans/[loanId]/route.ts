import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  try {
    const { loanId } = await params;

    if (!UUID_RE.test(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID format" }, { status: 400 });
    }

    const [loan] = await sql`
      SELECT * FROM loans 
      INNER JOIN members ON loans.member_id=members.member_id 
      INNER JOIN loan_products ON loans.loan_product_id=loan_products.loan_product_id
      WHERE loan_id = ${loanId}
    `;

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    return NextResponse.json({ loan });
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}