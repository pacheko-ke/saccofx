import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/app/lib/db";

export async function GET(){
  const feeTypes = await sql`
    SELECT * FROM fee_charges 
  
  
  `
  return NextResponse.json(feeTypes);
}