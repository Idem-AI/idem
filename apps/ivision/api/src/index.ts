/**
 * Démarrage d'iVision : configuration et secrets (.env, .env.secret, Infisical) → journal →
 * base → moteur partagé → écoute.
 *
 * L'ORDRE COMPTE : la base, le stockage et le moteur lisent `process.env` à leur premier
 * import ; tout ce qui les touche est donc importé APRÈS le chargement des secrets.
 */
// Rien d'autre ici qui lise l'environnement : tout le reste est importé APRÈS les secrets.
import { loadSecrets } from './config/secrets';

async function bootstrap(): Promise<void> {
  // `.env` + `.env.secret` en local, Infisical (projet `ivision-api`) en production.
  await loadSecrets();

  const { default: logger, captureConsole, installProcessHandlers } = await import('./config/logger');
  captureConsole();
  installProcessHandlers();
  const { env } = await import('./config/env');
  if (!env.serviceKey) logger.warn('ivision.service_key_missing', { event: 'ivision.service_key_missing', message: 'IVISION_SERVICE_KEY absent : la passerelle IDEM refusera les appels.' });
  const { connectDatabase } = await import('./config/db');
  await connectDatabase();
  const { configureCoreForIvision, syncPricesFromIdem } = await import('./core-host');
  configureCoreForIvision();
  const { syncBasePrices } = await import('./services/billing');
  // Les prix d'IDEM, maintenant puis toutes les 10 minutes (un tarif ajusté vaut partout).
  const sync = () => Promise.all([syncPricesFromIdem(), syncBasePrices()]);
  await sync();
  setInterval(() => void sync(), 10 * 60 * 1000).unref();

  // Les montages qu'un arrêt a laissés en route : en échec (et remboursés) ou rétablis.
  const { recoverMontages } = await import('./services/montages.service');
  await recoverMontages();

  const { createApp } = await import('./app');
  createApp().listen(env.port, () => {
    logger.info('ivision.started', { event: 'ivision.started', port: env.port, idemApi: env.idemApiUrl, publicUrl: env.publicUrl });
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('iVision API failed to start', error);
  process.exit(1);
});
