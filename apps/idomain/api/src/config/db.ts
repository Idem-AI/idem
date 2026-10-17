/**
 * La base PostgreSQL d'iDomain : sa propre base (`idomain`), sur le serveur PostgreSQL déjà
 * exploité pour iDeploy. Du SQL écrit à la main, comme iDeploy (décision du projet) : chaque
 * requête se lit telle qu'elle part, et les migrations sont des fichiers SQL (node-pg-migrate).
 */
import { Pool, PoolClient, QueryResultRow } from 'pg';
import logger, { logCritical } from './logger';

const pool = new Pool({
  host: process.env.IDOMAIN_DB_HOST || 'localhost',
  port: parseInt(process.env.IDOMAIN_DB_PORT || '5432', 10),
  database: process.env.IDOMAIN_DB_DATABASE || 'idomain',
  user: process.env.IDOMAIN_DB_USERNAME || 'idomain',
  // En production, un secret absent doit faire échouer la connexion, pas tomber sur un mot de passe connu.
  password: process.env.IDOMAIN_DB_PASSWORD || (process.env.NODE_ENV === 'production' ? undefined : 'password'),
  max: parseInt(process.env.IDOMAIN_DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error: Error) => logCritical('db.pool_error', { error }));

let ready = false;

export async function connectDatabase(): Promise<void> {
  await pool.query('SELECT 1');
  ready = true;
  logger.info('db.connected', { event: 'db.connected', database: process.env.IDOMAIN_DB_DATABASE || 'idomain' });
}

export const databaseReady = (): boolean => ready;

/** Un client de requêtes : le pool, ou la connexion d'une transaction en cours. */
export type Db = Pick<Pool, 'query'> | PoolClient;

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const result = await db.query<T>(sql, params);
  return result.rows;
}

export async function one<T extends QueryResultRow>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

/**
 * Plusieurs écritures qui n'ont de sens qu'ensemble (une commande et ses lignes, un débit et son
 * paiement) : toutes ou aucune. `fn` doit passer chaque requête par le `client` reçu.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => logger.error('db.rollback_failed', { event: 'db.rollback_failed', error: rollbackError }));
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export default pool;
