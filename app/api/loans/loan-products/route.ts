import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const loanProducts = await sql`
      SELECT
        loan_product_id,
        product_name,
        product_code,
        min_principal,
        max_principal,
        min_tenure_months,
        max_tenure_months,
        interest_rate_pa,
        interest_method,
        repayment_frequency,
        max_multiplier_of_shares,
        requires_guarantors,
        min_guarantors,
        requires_collateral,
        processing_fee_pct,
        insurance_fee_pct,
        penalty_rate_pct,
        grace_period_days,
        is_active
      FROM loan_products
      ORDER BY product_name ASC
    `;

    return NextResponse.json({ loanProducts });
  } catch (error) {
    console.error("Failed to fetch loan products:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan products" },
      { status: 500 }
    );
  }
}