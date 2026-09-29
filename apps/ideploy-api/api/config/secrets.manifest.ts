/**
 * Secrets d'ideploy-api dans Infisical (projet `ideploy-api`, environnement `production`).
 *
 * Seules les valeurs réellement secrètes figurent ici. Hôtes, ports, URL,
 * identifiants OAuth publics, réglages SSH/Traefik… restent dans le `.env`.
 * Le script `scripts/secrets/idem-secrets.mjs` lit ce fichier pour planifier,
 * pousser et nettoyer les secrets : c'est la seule liste qui fait foi.
 */
import type { SecretManifest } from './secret-loader';

export const SECRET_MANIFEST = {
  app: 'ideploy-api',
  required: [
    // Mot de passe PostgreSQL (schéma partagé avec l'ancien iDeploy Laravel).
    'IDEPLOY_DB_PASSWORD',
    // Clé Laravel : chiffre les colonnes sensibles (clés SSH, identifiants DB).
    'APP_KEY',
  ],
  optional: [
    'REDIS_PASSWORD',
    'PUSHER_APP_SECRET',
    'GITHUB_CLIENT_SECRET',
    'GITLAB_CLIENT_SECRET',
    'STRIPE_SECRET_KEY',
  ],
} as const satisfies SecretManifest;
