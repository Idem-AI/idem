// @ts-nocheck
/* eslint-disable @typescript-eslint/no-require-imports */
import logger from './logger';

// Inline minimal types to avoid @types/pg resolution issues with ts-node volume mount
interface PgPool {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  on(event: 'connect' | 'error', listener: (arg?: unknown) => void): void;
  end(): Promise<void>;
}

const { Pool } = require('pg') as { Pool: new (cfg: Record<string, unknown>) => PgPool };

const pool = new Pool({
  host:     process.env.IDEPLOY_DB_HOST     || 'postgres',
  port:     parseInt(process.env.IDEPLOY_DB_PORT || '5432'),
  database: process.env.IDEPLOY_DB_DATABASE || 'coolify',
  user:     process.env.IDEPLOY_DB_USERNAME || 'coolify',
  password: process.env.IDEPLOY_DB_PASSWORD || 'password',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => logger.info('Connected to iDeploy PostgreSQL'));
pool.on('error', (err: unknown) => logger.error('iDeploy PG pool error', { message: (err as Error).message }));

export default pool;
export type { PgPool };
