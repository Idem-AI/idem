/**
 * Raw PostgreSQL pool against the SHARED iDeploy database.
 *
 * This is the same database the Laravel app uses (strangler-fig: both stacks
 * read/write it concurrently). Raw SQL is the project's data layer by decision —
 * see the "Architecture decisions" section of the README; the Prisma client is
 * not used at runtime.
 */
import { Pool, PoolClient } from 'pg';
import logger from './logger';

const pool = new Pool({
  // Dev-friendly defaults matching the iDeploy dev database. Docker compose and
  // apps/ideploy-api/.env override these via IDEPLOY_DB_* env vars.
  host: process.env.IDEPLOY_DB_HOST || 'localhost',
  port: parseInt(process.env.IDEPLOY_DB_PORT || '5432', 10),
  database: process.env.IDEPLOY_DB_DATABASE || 'ideploy',
  user: process.env.IDEPLOY_DB_USERNAME || 'ideploy',
  password: process.env.IDEPLOY_DB_PASSWORD || 'password',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => logger.info('Connected to iDeploy PostgreSQL (raw pool)'));
pool.on('error', (err: Error) => logger.error('iDeploy PG pool error', { message: err.message }));

/**
 * Run `fn` inside a single transaction on one dedicated connection.
 *
 * Needed wherever a resource is only meaningful together with its dependants —
 * a server without its settings row and Docker destination, for instance, is a
 * row the rest of the system cannot use. Committing those separately leaves
 * half-created records behind on the first error.
 *
 * `fn` must run all its queries on the `client` it is handed: queries issued
 * against the pool instead would take a different connection and sit outside
 * the transaction.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // A failed rollback must not mask the error that caused it.
    await client.query('ROLLBACK').catch((rollbackErr) => {
      logger.error('Transaction rollback failed', { message: (rollbackErr as Error).message });
    });
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } catch (err) {
    logger.error('DB connection check failed', { message: (err as Error).message });
    return false;
  }
}

export default pool;
