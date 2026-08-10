import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const offset = (page - 1) * pageSize;

    const [loans, totalResult] = await Promise.all([
      sql`
        SELECT
          loans.loan_id,
          loans.loan_account_number,
          loans.status,
          loans.principal_amount,
          loans.outstanding_principal,
          loans.member_id,
          loans.created_at,

          members.member_number,
          members.first_name,
          members.last_name,
          members.id_number,
          members.phone_primary,

          loan_products.product_name,
          loan_products.product_code

        FROM loans
        INNER JOIN members
          ON loans.member_id = members.member_id
        INNER JOIN loan_products
          ON loans.loan_product_id = loan_products.loan_product_id
        ORDER BY loans.created_at DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM loans
        INNER JOIN members
          ON loans.member_id = members.member_id
        INNER JOIN loan_products
          ON loans.loan_product_id = loan_products.loan_product_id
      `,
    ]);

    const total = totalResult[0].count;

    return NextResponse.json({ loans, total, page, pageSize });
  } catch (error) {
    console.log("Failed to fetch loans:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}