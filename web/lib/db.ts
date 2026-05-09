import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export async function sql<T extends object = Record<string, unknown>>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(query, params);
  return result.rows;
}

export default sql;
