/**
 * Démarrage de l'API iDomain : configuration et secrets (.env, .env.secret, Infisical) → journal
 * → base → écoute. Les tâches longues tournent dans un AUTRE processus (`src/worker.ts`).
 *
 * L'ORDRE COMPTE : la base et Redis lisent `process.env` à leur premier import ; tout ce qui les
 * touche est donc importé APRÈS le chargement des secrets.
 */
import { loadSecrets } from './config/secrets';

async function bootstrap(): Promise<void> {
  await loadSecrets();

  const { default: logger, captureConsole, installProcessHandlers } = await import('./config/logger');
  captureConsole();
  installProcessHandlers();
  const { env } = await import('./config/env');
  if (!env.ideployKey) logger.warn('idomain.ideploy_key_missing', { event: 'idomain.ideploy_key_missing', message: 'IDOMAIN_IDEPLOY_KEY absente : la connexion aux applications iDeploy est impossible.' });
  if (env.simulatedRegistrar) logger.warn('idomain.simulated_registrar', { event: 'idomain.simulated_registrar', message: 'Fournisseur simulé actif (développement).' });

  const { connectDatabase } = await import('./config/db');
  await connectDatabase();
  await syncSimulatedProvider(env.simulatedRegistrar);

  const { createApp } = await import('./app');
  createApp().listen(env.port, () => {
    logger.info('idomain.started', { event: 'idomain.started', port: env.port, idemApi: env.idemApiUrl, ideployApi: env.ideployApiUrl });
  });
}

/** Le fournisseur simulé n'est actif en base que si le processus l'autorise (jamais en production). */
async function syncSimulatedProvider(enabled: boolean): Promise<void> {
  const { query } = await import('./config/db');
  await query(`UPDATE registrar_providers SET enabled = $1, health_status = CASE WHEN $1 THEN 'up' ELSE health_status END WHERE code = 'simulated'`, [enabled]);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('iDomain API failed to start', error);
  process.exit(1);
});
