import { pool } from "@/app/lib/db";
import { NextRequest,NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/app/lib/auth";

 const client = await pool.connect();

 export async function POST(req:NextRequest){
      const token = req.cookies.get("auth_token")?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    
      const payload = await verifyAuthToken(token);
      if (!payload) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    
      const tenantId = payload.tenantId as string;
      const userId = payload.userId as string;

 try{
    const body = req.json()
const{memberId,productId,initialDeposit} =await body;
    await client.query("BEGIN")
    const newAccount =await client.query(`INSERT INTO savings_accounts(member_id,savings_product_id,balance,tenant_id)VALUES($1,$2,$3,$4) RETURNING member_id,account_number`,[memberId,productId,initialDeposit,tenantId])
    await client.query(`INSERT INTO audit_logs()`)

     const productName = newAccount.rows[0].member_id;
     const accountNumber = newAccount.rows[0].member_id;

    const actionDescription :string = `open account ${accountNumber}`
    await client.query(`INSERT INTO audit_logs(user_id,action_description,action) VALUES($1,$2,$3)`,[userId,actionDescription,'OPEN-ACCOUNT'])
     await client.query("COMMIT")
    return NextResponse.json({newAccount})
    
 }catch(error){
    await client.query("ROLLBACK")
    return NextResponse.json({error})
 }finally{
    // client.release()
 }

}