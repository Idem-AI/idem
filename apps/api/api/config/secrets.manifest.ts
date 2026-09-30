/**
 * Secrets de l'API IDEM dans Infisical (projet `api`, environnement `production`).
 *
 * Seules les valeurs réellement secrètes figurent ici. Identifiants publics
 * (projet Google Cloud, client IDs OAuth), URL, ports, limites et
 * `ADMIN_EMAILS` sont de la configuration : ils restent dans `.env.production`.
 * Le script `scripts/secrets/idem-secrets.mjs` lit ce fichier : c'est la seule
 * liste qui fait foi.
 */
import type { SecretManifest } from './secret-loader';

export const SECRET_MANIFEST = {
  app: 'api',
  required: [
    // Compte de service Google Cloud (Vertex AI).
    'GCP_SA_PRIVATE_KEY',
    'GCP_SA_CLIENT_EMAIL',
    'MONGODB_PASSWORD',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'INTERNAL_API_KEY',
    'SENSITIVE_VARS_ENCRYPTION_KEY',
    // Authentification : secret partagé avec le serveur Supabase, et signature du cookie `session`.
    'SUPABASE_JWT_SECRET',
    'SESSION_SECRET',
  ],
  optional: [
    'REDIS_PASSWORD',
    // Base PostgreSQL d'iDeploy (lecture des ressources, synchronisation des plans payés).
    'IDEPLOY_DB_PASSWORD',
    // Fournisseurs de modèles.
    'GEMINI_API_KEY',
    'GLM_API_KEY',
    'DEEPSEEK_API_KEY',
    'OPENAI_API_KEY',
    // Intégrations.
    'GITHUB_CLIENT_SECRET',
    'PEXELS_API_KEY',
    'GOOGLE_FONTS_API_KEY',
    'SMTP_PASS',
    // Encaissement Mobile Money (services/payments/pawapay.client.ts).
    'PAWAPAY_API_TOKEN',
    // Secrets de signature et d'échange entre services.
    'IDEPLOY_SHARED_SECRET',
    'JWT_SECRET',
    'GITHUB_STATE_SECRET',
    'METRICS_TOKEN',
  ],
} as const satisfies SecretManifest;
