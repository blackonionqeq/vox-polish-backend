import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DATABASE_URL. Set it in ".env" or environment variables.');
}

export const pool = new Pool({ connectionString });

export async function closePool(): Promise<void> {
  await pool.end();
}

