/**
 * Secrets de l'API IDEM dans Infisical (projet `api`, environnement `prod`).
 *
 * Toutes les variables du projet Infisical sont chargées, déclarées ici ou non :
 * pour en ajouter une, il suffit de la créer dans Infisical. Cette liste dit
 * seulement ce qui est requis (démarrage refusé sans) et ce qui est optionnel
 * (signalé au démarrage quand il manque) — la tenir à jour sert de documentation.
 */
import type { SecretManifest } from './secret-loader';

export const SECRET_MANIFEST = {
  app: 'api',
  required: [
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
    // Voix off des vidéos : GLM-TTS est servi par open.bigmodel.cn (clé distincte de Z.ai ;
    // à défaut, GLM_API_KEY est essayée). Les langues qu'il ne parle pas passent par Gemini TTS.
    'GLM_TTS_API_KEY',
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
    // Clé de la passerelle interne d'iVision (`/internal/ivision`), partagée avec ivision-api.
    'IVISION_SERVICE_KEY',
    'JWT_SECRET',
    'GITHUB_STATE_SECRET',
    'METRICS_TOKEN',
  ],
} as const satisfies SecretManifest;
