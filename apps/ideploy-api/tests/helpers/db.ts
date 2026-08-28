/**
 * Integration-test database access.
 *
 * Integration tests run against a real PostgreSQL with the real (Laravel-owned)
 * schema — reimplementing 343 migrations in a fake would prove nothing about
 * the constraints and cascades we actually rely on. The schema is cloned once
 * into a dedicated database by `scripts/prepare-test-db.sh`.
 *
 * Safety: `truncateAll()` refuses to run against a database whose name does not
 * end in `_test`. Wiping the dev database from a stray test run is exactly the
 * kind of accident that guard exists to prevent.
 */
import { Pool } from 'pg';

let pool: Pool | null = null;

function databaseName(): string {
  return process.env.IDEPLOY_DB_DATABASE ?? '';
}

/** Throw unless we are pointed at a database that is unmistakably a test one. */
export function assertTestDatabase(): void {
  const db = databaseName();
  if (!db.endsWith('_test')) {
    throw new Error(
      `Refusing to run destructive test helpers against "${db}". ` +
        'The test database name must end with "_test" (see tests/setup.ts).'
    );
  }
}

/** Lazily-created pool for the test database. */
export function testPool(): Pool {
  assertTestDatabase();
  if (!pool) {
    pool = new Pool({
      host: process.env.IDEPLOY_DB_HOST,
      port: parseInt(process.env.IDEPLOY_DB_PORT ?? '5432', 10),
      database: databaseName(),
      user: process.env.IDEPLOY_DB_USERNAME,
      password: process.env.IDEPLOY_DB_PASSWORD,
      max: 4,
    });
  }
  return pool;
}

/** True when a test database is reachable — lets suites skip instead of failing. */
export async function isTestDatabaseAvailable(): Promise<boolean> {
  try {
    await testPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Empty every application table, preserving the schema. Cheaper and far more
 * reliable than reverse-engineering per-test cleanup, and `CASCADE` handles the
 * foreign-key graph for us.
 */
export async function truncateAll(): Promise<void> {
  assertTestDatabase();
  const { rows } = await testPool().query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename NOT IN ('migrations', 'pgmigrations')`
  );
  if (rows.length === 0) return;

  const list = rows.map((r) => `public."${r.tablename}"`).join(', ');
  await testPool().query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export async function closeTestPool(): Promise<void> {
  await pool?.end();
  pool = null;
}
