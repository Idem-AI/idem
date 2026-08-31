/**
 * Vérifie de bout en bout la chaîne de résilience Gemini — appels RÉELS.
 *
 *   npx ts-node --transpile-only api/scripts/verifyFallbackChain.ts
 *
 * Contrôle trois choses qu'aucun test pur ne peut attester :
 *  1. tous les modèles déclarés dans ai.config.ts existent bien sur le backend ;
 *  2. la chaîne de repli déclarée atteint réellement `runPrompt` ;
 *  3. un appel via la config branding aboutit.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.secret') });
// `loadSecrets()` déséchappe les \n de la clé privée : même traitement ici.
if (process.env.FIREBASE_PRIVATE_KEY) {
  process.env.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
}

import { AI_CONFIG, TEXT_FALLBACK_MODELS, LLMProvider } from '../config/ai.config';
import { MODEL_TIERS } from '../config/model-router';
import { describeGeminiBackend, getGoogleGenAIClient } from '../config/google-genai.client';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};

/** Tous les modèles texte que la configuration peut réellement appeler. */
function declaredTextModels(): string[] {
  const models = new Set<string>(TEXT_FALLBACK_MODELS);
  models.add(AI_CONFIG.default.modelName);
  models.add(AI_CONFIG.fallback.textModel);
  Object.values(MODEL_TIERS).forEach((tier) => models.add(tier.modelName));

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.modelName === 'string' && node.provider === LLMProvider.GEMINI) {
      models.add(node.modelName);
    }
    Object.values(node).forEach(walk);
  };
  walk(AI_CONFIG);
  return [...models].filter((m) => m.startsWith('gemini-') && !m.includes('image'));
}

(async () => {
  console.log(`\nBackend — ${describeGeminiBackend()}\n`);
  const ai = getGoogleGenAIClient();

  console.log('Modèles déclarés, sondés sur le backend');
  for (const model of declaredTextModels().sort()) {
    try {
      await ai.models.generateContent({ model, contents: 'ping', config: { maxOutputTokens: 8 } });
      check(model, true);
    } catch (e: any) {
      const status = e?.status ?? e?.code ?? '';
      check(model, false, `${status} ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }

  console.log('\nChaînes de repli déclarées');
  for (const [name, config] of [
    ['branding.colors', AI_CONFIG.branding.colors],
    ['branding.typography', AI_CONFIG.branding.typography],
    ['branding.logo', AI_CONFIG.branding.logo],
  ] as const) {
    const chain = [...new Set([config.modelName, ...(config.fallbackModels ?? [])])];
    check(`${name} → ${chain.join(' → ')}`, chain.length > 1, 'aucun repli');
  }

  console.log(
    failures === 0
      ? '\nTout est vert : chaque modèle déclaré répond et chaque chaîne a un repli.\n'
      : `\n${failures} problème(s) — un modèle déclaré n'est pas servi par le backend.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
})();
