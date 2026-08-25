import { neon } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";
export const sql = neon(process.env.DATABASE_URL!);

declare global {
  var postgresPool: Pool | undefined;
}

export const pool =
  global.postgresPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== 'production') {
  global.postgresPool = pool;
}