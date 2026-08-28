import { NextResponse } from "next/server";
import {sql} from "@/app/lib/db"

// Adjust table/column names to match your actual chart_of_accounts schema.
export async function GET() {
  try {
    const accounts = await sql`
      SELECT
        gl_account_id,
        account_code,
        account_name,
        account_type
      FROM gl_accounts
      WHERE is_active = true
      ORDER BY account_code ASC
    `;

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("Chart of accounts fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch chart of accounts" }, { status: 500 });
  }
}