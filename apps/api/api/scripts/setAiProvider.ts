/**
 * Bascule le fournisseur IA À CHAUD, sans redéploiement.
 *
 *   npm run ai:provider                         → affiche le réglage en vigueur
 *   npm run ai:provider -- openrouter           → texte/vision/OCR + image par OpenRouter
 *   npm run ai:provider -- glm | gemini         → retour à Z.ai / Gemini
 *   npm run ai:provider -- openrouter --media glm   → texte OpenRouter, image restée sur GLM
 *   npm run ai:provider -- --model writing=qwen/qwen3.5-27b   → change le modèle d'un rôle (OpenRouter)
 *   npm run ai:provider -- --reset              → efface le réglage (retour aux variables d'env)
 *
 * Écrit `platform_settings/ai` : les instances de l'API le prennent en compte
 * sous quinze secondes (cf. `ai-runtime.config.ts`).
 */

import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { LLMProvider, MODEL_ROLES, ModelRole } from '../config/ai.config';
import {
  MEDIA_PROVIDERS,
  MediaProviderName,
  getAiRuntime,
  refreshAiRuntime,
  setAiRuntime,
} from '../config/ai-runtime.config';
import { isAllowedOpenRouterModel } from '../config/openrouter.config';
import { isProviderConfigured } from '../config/ai-providers.config';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const mediaIndex = args.indexOf('--media');
  const media = mediaIndex >= 0 ? args[mediaIndex + 1]?.toLowerCase() : undefined;
  const models = args.flatMap((arg, i) => (args[i - 1] === '--model' ? [arg] : []));
  const providerArg = args.find(
    (arg, i) => !arg.startsWith('--') && args[i - 1] !== '--media' && args[i - 1] !== '--model'
  );
  const provider = providerArg?.toUpperCase();

  if (provider && !(Object.values(LLMProvider) as string[]).includes(provider)) {
    fail(`Fournisseur inconnu « ${providerArg} ». Valeurs : ${Object.values(LLMProvider).join(', ').toLowerCase()}.`);
  }
  if (media && !(MEDIA_PROVIDERS as readonly string[]).includes(media)) {
    fail(`Média inconnu « ${media} ». Valeurs : ${MEDIA_PROVIDERS.join(', ')}.`);
  }

  const modelPatch: Partial<Record<ModelRole, string>> = {};
  for (const pair of models) {
    const [role, id] = pair.split('=');
    if (!(MODEL_ROLES as readonly string[]).includes(role) || !id) {
      fail(`--model attend rôle=identifiant, rôles : ${MODEL_ROLES.join(', ')}.`);
    }
    if (!isAllowedOpenRouterModel(id)) {
      fail(`« ${id} » n'est pas dans la liste blanche OpenRouter (ou c'est une API fermée). Voir openrouter.config.ts.`);
    }
    modelPatch[role as ModelRole] = id;
  }

  await loadSecrets();
  await mongoDBConnection.connect();
  try {
    if (provider && !isProviderConfigured(provider as LLMProvider)) {
      fail(`${provider} n'a pas de clé configurée sur cette machine : bascule refusée.`);
    }
    if (reset) {
      await setAiRuntime({ provider: null, media: null, models: Object.fromEntries(MODEL_ROLES.map((r) => [r, null])) });
    } else if (provider || media || models.length) {
      await setAiRuntime({
        ...(provider ? { provider: provider as LLMProvider } : {}),
        ...(media ? { media: media as MediaProviderName } : {}),
        ...(models.length ? { models: modelPatch } : {}),
      });
    }
    await refreshAiRuntime();
    console.log('Réglage en vigueur (platform_settings/ai) :', JSON.stringify(getAiRuntime(), null, 2));
  } finally {
    await mongoDBConnection.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
