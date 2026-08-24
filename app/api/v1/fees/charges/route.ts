import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/app/lib/db";

export async function GET(){

  const feeCharges = await sql`
    SELECT m.member_id,ft.fee_name as "feeTypeName",m.first_name,f.amount as "amount",m.member_number as "memberNumber",m.last_name 
    FROM fee_charges f INNER JOIN
     members m ON m.member_id=f.member_id
     INNER JOIN fee_types ft ON ft.fee_type_id=f.fee_type_id
  

  `
  return NextResponse.json(feeCharges);
}