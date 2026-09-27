/**
 * Secrets du serveur AppGen dans Google Secret Manager (`appgen--<VARIABLE>`).
 *
 * Seules les valeurs réellement secrètes figurent ici. URL, limites, hôtes
 * autorisés et réglages des modèles restent dans le `.env`.
 * Le script `scripts/secrets/idem-secrets.mjs` lit ce fichier : c'est la seule
 * liste qui fait foi.
 */
import type { SecretManifest } from './secret-loader.js';

export const SECRET_MANIFEST = {
  app: 'appgen',
  required: [],
  optional: [
    // Fournisseur GLM (Zhipu / Z.ai) : modèles de génération de code.
    'GLM_API_KEY',
    // Fournisseur par défaut des modèles sans `apiKeyEnv` propre.
    'THIRD_API_KEY',
    // Déploiement des applications générées sur le compte Netlify d'IDEM.
    'NETLIFY_TOKEN',
    // Marquage des sites Netlify par propriétaire (routes/deploy.ts).
    'DEPLOY_OWNER_SECRET',
    // Captures d'écran des aperçus.
    'SCREENSHOTONE_API_KEY',
  ],
} as const satisfies SecretManifest;
