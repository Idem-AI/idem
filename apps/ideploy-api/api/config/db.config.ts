/**
 * Raw PostgreSQL pool against the SHARED iDeploy database.
 *
 * This is the same database the Laravel app uses (strangler-fig: both stacks
 * read/write it concurrently). Prefer the Prisma client (see prisma.config.ts)
 * for typed model access; this raw pool is kept for ad-hoc queries, health
 * checks, and bootstrap code that runs before the Prisma client is generated.
 */
import { Pool } from 'pg';
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
