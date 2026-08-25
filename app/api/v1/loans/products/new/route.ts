import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";
import { pool } from "@/app/lib/db";
export async function POST(req: NextRequest) {
    // verify session
     const cookieStore = await cookies();
      const token = cookieStore.get("auth_token")?.value;
    
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    
      let payload;
      try {
        payload = await verifyAuthToken(token);
      } catch {
        return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
      }

    const tenantId = payload?.tenantId;
      const userId = payload?.userId;
    const body = await req.json();
    const client = await pool.connect();
    const { grace_period_days, insurance_fee_pct, interest_method, interest_rate_pa, is_active, max_multiplier_of_shares, max_principal, max_tenure_months,min_guarantors,min_principal,min_tenure_months,penalty_rate_pct,
        processing_fee_pct,product_code,product_name,repayment_frequency,requires_collateral,requires_guarantors} = body;
    try{
        client.query("BEGIN")
        await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const newLoanProduct = await client.query(`
        INSERT INTO loan_products (product_name,product_code,interest_rate_pa
        ,interest_method,max_principal,min_principal,max_tenure_months,min_tenure_months,
        repayment_frequency,max_multiplier_of_shares,processing_fee_pct,penalty_rate_pct,
        tenant_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING product_name`,
        [product_name,product_code,interest_rate_pa,interest_method,max_principal,min_principal,max_tenure_months,min_tenure_months,
        repayment_frequency,max_multiplier_of_shares,processing_fee_pct,penalty_rate_pct,tenantId
        ]
    
    )

    // update audit logs
    const productName = newLoanProduct.rows[0].product_name
    const actionDescription :string = `Create loan product ${productName}`
    await client.query(`INSERT INTO audit_logs(user_id,action_description,action) VALUES($1,$2,$3)`,[userId,actionDescription,'LOAN_PRODUCT_CREATED'])
    await client.query("COMMIT")
    return NextResponse.json({newLoanProduct})
}catch( err){
    client.query("ROLLBACK")
    return NextResponse.json("Failed to add loan product " +err)
}
    
}