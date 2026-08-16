import pg from 'pg';
import { SCHEMA_SQL } from './schema.js';

/**
 * Pool factory. Non-local hosts (e.g. Azure Database for PostgreSQL)
 * require TLS; rejectUnauthorized is relaxed because Azure terminates
 * with a platform-managed certificate chain.
 */
export function createPool(connectionString: string): pg.Pool {
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  return new pg.Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
}

/** Applies the idempotent schema — safe to run on every boot. */
export async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);
}
