import 'dotenv/config';
import pg from 'pg';
export type { PoolClient, QueryResultRow } from 'pg';
export type Database = pg.Pool;
export type Connection = pg.Pool | pg.PoolClient;

export function createDatabase(connectionString = process.env.DATABASE_URL, options?: string): Database {
  if (!connectionString) throw new Error('DATABASE_URL is required. Run npm run setup.');
  return new pg.Pool({ connectionString, options, max: 10, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000, statement_timeout: 10000 });
}

export async function transaction<T>(db: Database, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
