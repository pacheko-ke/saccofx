import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const loanProducts = await sql`
      SELECT
       *
      FROM loan_products
      ORDER BY product_name ASC
    `;

    return NextResponse.json( {loanProducts} );
  } catch (error) {
    console.error("Failed to fetch loan products:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan products" },
      { status: 500 }
    );
  }
}