/**
 * Secrets d'ideploy-api dans Infisical (projet `ideploy-api`, environnement `prod`).
 *
 * Toutes les variables du projet Infisical sont chargées, déclarées ici ou non :
 * pour en ajouter une, il suffit de la créer dans Infisical. Cette liste dit
 * seulement ce qui est requis (démarrage refusé sans) et ce qui est optionnel
 * (signalé au démarrage quand il manque) — la tenir à jour sert de documentation.
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
    // Connexion GitHub/GitLab : sans l'ID ou le secret, le provider est « non configuré ».
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GITLAB_CLIENT_ID',
    'GITLAB_CLIENT_SECRET',
    'STRIPE_SECRET_KEY',
    // Adresses monapp.idem.africa ; absent = adresse automatique (sslip.io).
    'NAMECHEAP_API_KEY',
  ],
} as const satisfies SecretManifest;
