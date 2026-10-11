/**
 * Garde-fous OpenRouter, sans réseau : `npm run check:openrouter`.
 * Traduction par rôle, liste blanche, API fermées refusées, raisonnement, voix, vidéo.
 */
import assert from 'node:assert/strict';
import { LLMProvider, MODEL_ROLES, ROLE_MODELS } from '../config/ai.config';
import {
  canSuppressThinking,
  getProvider,
  modelForRole,
  resolveGlobalOverride,
  translateReasoning,
} from '../config/ai-providers.config';
import {
  KOKORO_VOICES,
  OPENROUTER_MODELS,
  isAllowedOpenRouterModel,
  resolveOpenRouterModel,
} from '../config/openrouter.config';
import { aspectRatioFor, generateSpeech, openRouterVideoModel } from '../services/media.service';

process.env.OPENROUTER_API_KEY = 'test';

// 1. Chaque rôle a un modèle, et il est dans la liste blanche.
for (const role of MODEL_ROLES) {
  assert.ok(ROLE_MODELS[role], `rôle ${role} sans modèle`);
  assert.ok(isAllowedOpenRouterModel(ROLE_MODELS[role]), `${ROLE_MODELS[role]} hors liste blanche`);
}
assert.equal(modelForRole(LLMProvider.OPENROUTER, 'image'), 'black-forest-labs/flux.2-klein-4b');

// 2. Une configuration portant son rôle suit le modèle choisi (variable d'env ici,
//    base en production) ; un modèle épinglé à la main n'est jamais touché.
const base = {
  provider: LLMProvider.OPENROUTER,
  modelName: ROLE_MODELS.reasoning,
  role: 'reasoning' as const,
};
assert.equal(resolveGlobalOverride(base).modelName, 'qwen/qwen3.5-397b-a17b');
process.env.IDEM_OPENROUTER_REASONING_MODEL = 'deepseek/deepseek-v4-pro';
assert.equal(resolveGlobalOverride(base).modelName, 'deepseek/deepseek-v4-pro', 'rôle retraduit');
assert.equal(
  resolveGlobalOverride({ ...base, modelName: 'qwen/qwen3.5-27b' }).modelName,
  'qwen/qwen3.5-27b',
  'modèle épinglé conservé'
);
delete process.env.IDEM_OPENROUTER_REASONING_MODEL;

// 3. Liste blanche : API fermée et inconnu refusés, ouvert accepté.
assert.ok(isAllowedOpenRouterModel('qwen/qwen3-coder-next'));
assert.ok(!isAllowedOpenRouterModel('black-forest-labs/flux.2-pro'), 'API fermée');
assert.ok(!isAllowedOpenRouterModel('qwen/qwen3.5-plus-20260420'), 'non listé');
process.env.IDEM_OPENROUTER_WRITING_MODEL = 'qwen/qwen3.7-max';
assert.equal(resolveOpenRouterModel('writing'), 'qwen/qwen3.5-122b-a10b', 'surcharge refusée');
process.env.IDEM_OPENROUTER_WRITING_MODEL = 'qwen/qwen3.5-27b';
assert.equal(getProvider(LLMProvider.OPENROUTER).models?.writing, 'qwen/qwen3.5-27b');
delete process.env.IDEM_OPENROUTER_WRITING_MODEL;

// 4. Raisonnement : `thinking` devient `reasoning`; les modèles « thinking » ne se coupent pas.
assert.deepEqual(translateReasoning({ model: 'm', thinking: { type: 'disabled' } }), {
  model: 'm',
  reasoning: { enabled: false },
});
assert.deepEqual(translateReasoning({ model: 'm' }), { model: 'm' });
assert.ok(canSuppressThinking('qwen/qwen3.5-122b-a10b'));
assert.ok(!canSuppressThinking('qwen/qwen3-235b-a22b-thinking-2507'));

// 5. Formats d'image → ratios supportés.
assert.equal(aspectRatioFor('1344x768'), '16:9');
assert.equal(aspectRatioFor('1024x1024'), '1:1');

// 6. Licence commerciale : un modèle ouvert NON commercial est refusé comme une API fermée.
assert.ok(!isAllowedOpenRouterModel('mistralai/voxtral-mini-tts-2603'), 'CC-BY-NC exclu');
assert.ok(isAllowedOpenRouterModel('hexgrad/kokoro-82m'));
assert.ok(!isAllowedOpenRouterModel('qwen/qwen-image-3'), 'Qwen Image fermé');

// 7. Chaque modèle ouvert de la liste a un dépôt Hugging Face et une licence.
for (const model of OPENROUTER_MODELS.filter((m) => m.openWeights)) {
  assert.ok(model.hfId && model.license, `${model.id} : poids ouverts sans preuve`);
}

(async () => {
  // 8. Voix : Kokoro parle français ; une langue sans voix lève, iVision crée alors la vidéo sans voix.
  process.env.IDEM_TTS_URL = '';
  assert.equal(KOKORO_VOICES.fr, 'ff_siwis');
  await assert.rejects(generateSpeech({ text: 'x', language: 'sw' }), /voice_language_unsupported/);

  // 9. Vidéo : Seedance 2.0 par dérogation ; Wan (fermé, sans dérogation) reste refusé.
  assert.equal(openRouterVideoModel(), 'bytedance/seedance-2.0');
  process.env.IDEM_OPENROUTER_VIDEO_MODEL = 'alibaba/wan-2.7';
  assert.equal(openRouterVideoModel(), undefined);
  process.env.OPENROUTER_OPEN_ONLY = 'off';
  assert.equal(openRouterVideoModel(), 'alibaba/wan-2.7');

  console.log('✓ OpenRouter : rôles, liste blanche, raisonnement, voix et vidéo');
  process.exit(0);
})();
