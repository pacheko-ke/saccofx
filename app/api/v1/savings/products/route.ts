import { NextResponse } from "next/server";
import {sql} from "@/app/lib/db"

export async function GET() {
  try {
    const savingsProducts = await sql`
      SELECT
       savings_product_id,product_name
      FROM savings_products
    
    `;

    return NextResponse.json( {savingsProducts} );
  } catch (error) {
    console.error("Failed to fetch savings products:", error);
    return NextResponse.json(
      { error: "Failed to fetch savings products" },
      { status: 500 }
    );
  }
}