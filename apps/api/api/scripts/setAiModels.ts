/**
 * Change le modèle OpenRouter d'un rôle À CHAUD, sans redéploiement.
 *
 *   npm run ai:models                                          → réglage en vigueur
 *   npm run ai:models -- --model writing=qwen/qwen3.5-27b      → change le modèle d'un rôle
 *   npm run ai:models -- --model reasoning=deepseek/deepseek-v4-pro --model image=black-forest-labs/flux.2-klein-4b
 *   npm run ai:models -- --reset                               → retour aux défauts (env, puis code)
 *
 * Rôles : mechanical, writing, reasoning, vision, ocr, image. Seuls les modèles de
 * la liste blanche (`openrouter.config.ts`) sont acceptés. Écrit
 * `platform_settings/ai` : les instances de l'API le prennent en compte sous
 * quinze secondes (cf. `ai-runtime.config.ts`).
 */

import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { MODEL_ROLES, ModelRole } from '../config/ai.config';
import { getAiRuntime, refreshAiRuntime, setAiRuntime } from '../config/ai-runtime.config';
import { isAllowedOpenRouterModel } from '../config/openrouter.config';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const pairs = args.flatMap((arg, i) => (args[i - 1] === '--model' ? [arg] : []));

  const patch: Partial<Record<ModelRole, string>> = {};
  for (const pair of pairs) {
    const [role, id] = pair.split('=');
    if (!(MODEL_ROLES as readonly string[]).includes(role) || !id) {
      fail(`--model attend rôle=identifiant, rôles : ${MODEL_ROLES.join(', ')}.`);
    }
    if (!isAllowedOpenRouterModel(id)) {
      fail(`« ${id} » n'est pas dans la liste blanche OpenRouter (ou c'est une API fermée sans dérogation). Voir openrouter.config.ts.`);
    }
    patch[role as ModelRole] = id;
  }

  await loadSecrets();
  await mongoDBConnection.connect();
  try {
    if (reset) {
      await setAiRuntime({ models: Object.fromEntries(MODEL_ROLES.map((r) => [r, null])) });
    } else if (pairs.length) {
      await setAiRuntime({ models: patch });
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
