/**
 * Secrets de l'API iVision dans Infisical (projet `ivision-api`, environnement `prod`).
 * Même mécanique que les autres back-ends (cf. secret-loader.ts) : tout le projet est
 * chargé ; cette liste dit ce qui est indispensable et ce qu'il est utile de signaler.
 */
import type { SecretManifest } from './secret-loader';

export const SECRET_MANIFEST = {
  app: 'ivision-api',
  required: ['MONGODB_PASSWORD', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'IVISION_SERVICE_KEY'],
  optional: [
    // Banques d'images et de musiques (le moteur s'en passe : génération, catalogue local).
    'PEXELS_API_KEY',
    'JAMENDO_CLIENT_ID',
    'FREESOUND_API_KEY',
    'OPENVERSE_TOKEN',
  ],
} as const satisfies SecretManifest;
