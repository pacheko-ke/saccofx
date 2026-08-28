import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db"

export async function GET() {
  const client = await pool.connect();
  try {

    const savingsProducts = await client.query(`
      SELECT
       savings_product_id,product_name
      FROM savings_products
    
    `);
console.log(savingsProducts.rows)
    return NextResponse.json( savingsProducts.rows );
  } catch (error) {
    console.error("Failed to fetch savings products:", error);
    return NextResponse.json(
      { error: "Failed to fetch savings products" },
      { status: 500 }
    );
  } finally {
    client.release()
  }
}