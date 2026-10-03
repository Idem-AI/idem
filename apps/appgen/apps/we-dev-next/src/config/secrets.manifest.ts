/**
 * Secrets du serveur AppGen dans Infisical (projet `appgen`, environnement `prod`).
 *
 * Toutes les variables du projet Infisical sont chargées, déclarées ici ou non :
 * pour en ajouter une, il suffit de la créer dans Infisical. Cette liste dit
 * seulement ce qui est requis (démarrage refusé sans) et ce qui est optionnel
 * (signalé au démarrage quand il manque) — la tenir à jour sert de documentation.
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
