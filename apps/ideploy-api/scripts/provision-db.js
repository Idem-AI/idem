#!/usr/bin/env node
/**
 * Automatic database provisioning — runs once at container start, before
 * the server itself starts (see package.json's `db:provision` and the
 * production Dockerfile's CMD). Idempotent: safe on every deploy, not just
 * the first one.
 *
 * This app never had its own "create everything from scratch" path — the
 * base schema (servers, applications, ...) was always Laravel's
 * (`php artisan migrate`, see migrations/README.md's ownership rule).
 * node-pg-migrate's 4 files here are additive-only and assume that base
 * already exists. Now that Laravel is no longer part of this environment,
 * a fresh database has nothing to be additive *onto*.
 *
 * The fix: bootstrap from tests/schema.sql when the base schema is
 * missing. That file is a committed `pg_dump --schema-only` snapshot of a
 * real, fully-migrated database (see scripts/dump-schema.sh) — it already
 * includes every migration currently in migrations/, which is exactly why
 * this script marks all of them as already-applied in node-pg-migrate's own
 * tracking table right after bootstrapping: without that, `migrate:up`
 * would try to re-run e.g. an `ADD COLUMN` against a column the snapshot
 * already created, and fail.
 *
 * This assumes tests/schema.sql is kept current with migrations/ — the
 * project's own existing convention (migrations/README.md: regenerate the
 * snapshot after adding a migration). A migration added without refreshing
 * the snapshot would be silently marked "applied" on a fresh bootstrap
 * without actually having run. Not a new risk this script introduces — the
 * snapshot's staleness was already possible before; this just makes a
 * stale snapshot matter for a fresh database, not only for tests.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const { rows } = await pool.query("SELECT to_regclass('public.servers') AS exists");
  if (rows[0].exists) {
    console.log('[provision-db] base schema already present — nothing to bootstrap.');
    await pool.end();
    return;
  }

  console.log('[provision-db] base schema missing — bootstrapping from tests/schema.sql...');
  const schemaPath = path.join(__dirname, '../tests/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[provision-db] schema created.');

  const migrationsDir = path.join(__dirname, '../migrations');
  const names = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/, ''))
    .sort();

  // Fully qualified: tests/schema.sql (pg_dump's own convention) sets this
  // session's search_path to empty for safety, and that sticks on whatever
  // pooled connection actually ran it — an unqualified `pgmigrations` here
  // would fail with "no schema has been selected to create in" on that
  // connection. Same shape node-pg-migrate itself creates (-t pgmigrations,
  // per package.json's migrate:* scripts) — CREATE IF NOT EXISTS so this is
  // harmless if node-pg-migrate already made it first.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.pgmigrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      run_on TIMESTAMP NOT NULL
    )
  `);
  for (const name of names) {
    const { rows: existing } = await pool.query('SELECT 1 FROM public.pgmigrations WHERE name = $1', [name]);
    if (existing.length === 0) {
      await pool.query('INSERT INTO public.pgmigrations (name, run_on) VALUES ($1, now())', [name]);
    }
  }
  console.log(`[provision-db] marked ${names.length} existing migration(s) as already applied.`);

  await pool.end();
}

main().catch((err) => {
  console.error('[provision-db] FAILED:', err.message);
  process.exit(1);
});
