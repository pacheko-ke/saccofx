import { neon } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";
export const sql = neon(process.env.DATABASE_URL!);
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });