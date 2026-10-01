#!/usr/bin/env node
/**
 * Runs a command with the application's secrets in its environment.
 *
 * `loadSecretsFromManager` is called by dist/index.js, which is the LAST step
 * of start-provisioned.sh. The two steps before it (provision-db.js and
 * `migrate:up`) connect to the database on their own and therefore never saw
 * the secrets: with IDEPLOY_DB_PASSWORD living in Infisical they fell back to
 * the default password and failed with "password authentication failed".
 *
 * This wrapper loads the secrets first, with the very same compiled loader and
 * manifest the server uses, then runs the rest of the chain with them in its
 * environment. A value already present in the environment is never
 * overwritten, as in the server.
 *
 *   node scripts/with-secrets.js <command> [args…]
 *
 * It also builds DATABASE_URL (node-pg-migrate and Prisma only read that one)
 * from the IDEPLOY_DB_* variables, percent-encoding each part: a generated
 * password routinely contains `@`, `/`, `+` or `#`, which would otherwise
 * corrupt the URL. An existing DATABASE_URL is left untouched.
 */
'use strict';

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

async function main() {
  const command = process.argv.slice(2);
  if (command.length === 0) {
    console.error('usage: node scripts/with-secrets.js <command> [args…]');
    process.exit(2);
  }

  const { loadSecretsFromManager } = require(path.join(__dirname, '../dist/config/secret-loader'));
  const { SECRET_MANIFEST } = require(path.join(__dirname, '../dist/config/secrets.manifest'));
  await loadSecretsFromManager(SECRET_MANIFEST);

  const env = process.env;
  if (!env.DATABASE_URL) {
    const part = (value, fallback) => encodeURIComponent(value || fallback);
    env.DATABASE_URL =
      `postgresql://${part(env.IDEPLOY_DB_USERNAME, 'ideploy')}:${part(env.IDEPLOY_DB_PASSWORD, 'password')}` +
      `@${env.IDEPLOY_DB_HOST || 'localhost'}:${env.IDEPLOY_DB_PORT || '5432'}` +
      `/${part(env.IDEPLOY_DB_DATABASE, 'ideploy')}?schema=public`;
  }

  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', env });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => {
    process.exit(code !== null ? code : 128 + (os.constants.signals[signal] || 0));
  });
}

main().catch((err) => {
  console.error('[with-secrets] FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
