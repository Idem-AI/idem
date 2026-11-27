/**
 * Démarrage en production : secrets (Infisical) → migrations → API. Les migrations déjà jouées
 * sont ignorées par node-pg-migrate ; une migration en échec empêche le démarrage.
 */
const { spawnSync } = require('child_process');
const { loadSecrets } = require('../dist/src/config/secrets');

async function main() {
  await loadSecrets();
  const env = process.env;
  const databaseUrl =
    env.DATABASE_URL ||
    `postgres://${encodeURIComponent(env.IDOMAIN_DB_USERNAME || 'idomain')}:${encodeURIComponent(env.IDOMAIN_DB_PASSWORD || '')}` +
      `@${env.IDOMAIN_DB_HOST || 'localhost'}:${env.IDOMAIN_DB_PORT || '5432'}/${env.IDOMAIN_DB_DATABASE || 'idomain'}`;
  const migrate = spawnSync('npm', ['run', 'migrate:up'], { stdio: 'inherit', env: { ...env, DATABASE_URL: databaseUrl } });
  if (migrate.status !== 0) process.exit(migrate.status || 1);
  require('../dist/src/index.js');
}

main().catch((error) => {
  console.error('iDomain API failed to start', error);
  process.exit(1);
});
