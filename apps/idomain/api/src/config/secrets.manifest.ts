/**
 * Secrets de l'API iDomain dans Infisical (projet `idomain-api`, environnement `prod`).
 * Même mécanique que les autres back-ends (cf. secret-loader.ts) : tout le projet est
 * chargé ; cette liste dit ce qui est indispensable et ce qu'il est utile de signaler.
 */
import type { SecretManifest } from './secret-loader';

export const SECRET_MANIFEST = {
  app: 'idomain-api',
  required: ['IDOMAIN_DB_PASSWORD', 'IDOMAIN_SERVICE_KEY', 'IDOMAIN_IDEPLOY_KEY'],
  optional: [
    // Console d'administration (idem-admin) : sans elle, `/admin/v1` reste fermé.
    'IDOMAIN_ADMIN_KEY',
    // Signature des événements envoyés à iDeploy et iCode.
    'IDOMAIN_WEBHOOK_SECRET',
    'REDIS_PASSWORD',
    // Domain Name API (compte revendeur) : sans eux, le fournisseur est désactivé.
    'DNA_RESELLER_ID',
    'DNA_API_KEY',
  ],
} as const satisfies SecretManifest;
