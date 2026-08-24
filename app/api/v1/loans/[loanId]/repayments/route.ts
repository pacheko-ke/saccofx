import { NextResponse } from "next/server";
import {sql} from "@/app/lib/db"

export async function GET(request: Request) {
  
    return NextResponse.json("{ members, total, page, pageSize }");

}