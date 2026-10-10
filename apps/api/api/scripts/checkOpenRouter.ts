/**
 * Garde-fous OpenRouter, sans réseau : `npm run check:openrouter`.
 * Bascule par rôle, liste blanche, API fermées refusées, dialecte de raisonnement.
 */
import assert from 'node:assert/strict';
import { LLMProvider } from '../config/ai.config';
import { mediaProvider } from '../services/glm-media.service';
import {
  getProvider,
  resolveGlobalOverride,
  translateReasoning,
  modelForRole,
} from '../config/ai-providers.config';
import { isAllowedOpenRouterModel, resolveOpenRouterModel } from '../config/openrouter.config';
import { aspectRatioFor } from '../services/openrouter-media.service';

process.env.OPENROUTER_API_KEY = 'test';
process.env.AI_DEFAULT_PROVIDER = 'OPENROUTER';

// 1. Bascule globale traduite par rôle, jamais un nom GLM envoyé à OpenRouter.
const base = { provider: LLMProvider.GLM, modelName: 'glm-5.2', role: 'reasoning' as const };
const switched = resolveGlobalOverride(base);
assert.equal(switched.provider, LLMProvider.OPENROUTER);
assert.equal(switched.modelName, 'qwen/qwen3.5-397b-a17b');
assert.equal(modelForRole(LLMProvider.OPENROUTER, 'image'), 'black-forest-labs/flux.2-klein-4b');

// 2. Sans clé, la bascule est refusée (pas de cascade de 401).
delete process.env.OPENROUTER_API_KEY;
assert.equal(resolveGlobalOverride(base).provider, LLMProvider.GLM);
process.env.OPENROUTER_API_KEY = 'test';

// 3. Liste blanche : API fermée et inconnu refusés, ouvert accepté.
assert.ok(isAllowedOpenRouterModel('qwen/qwen3-coder-next'));
assert.ok(!isAllowedOpenRouterModel('black-forest-labs/flux.2-pro'), 'API fermée');
assert.ok(!isAllowedOpenRouterModel('qwen/qwen3.5-plus-20260420'), 'non listé');
process.env.IDEM_OPENROUTER_WRITING_MODEL = 'qwen/qwen3.7-max';
assert.equal(resolveOpenRouterModel('writing'), 'qwen/qwen3.5-122b-a10b', 'surcharge refusée');
process.env.IDEM_OPENROUTER_WRITING_MODEL = 'qwen/qwen3.5-27b';
assert.equal(getProvider(LLMProvider.OPENROUTER).models?.writing, 'qwen/qwen3.5-27b');
delete process.env.IDEM_OPENROUTER_WRITING_MODEL;

// 4. Dialecte de raisonnement.
assert.deepEqual(
  translateReasoning('openrouter', { model: 'm', thinking: { type: 'disabled' } }),
  { model: 'm', reasoning: { enabled: false } }
);
assert.deepEqual(translateReasoning(undefined, { thinking: { type: 'disabled' } }), {
  thinking: { type: 'disabled' },
});

// 5. Média : suit le fournisseur texte ; formats d'image → ratios supportés.
assert.equal(mediaProvider(), 'openrouter');
assert.equal(aspectRatioFor('1344x768'), '16:9');
assert.equal(aspectRatioFor('1024x1024'), '1:1');

console.log('✓ OpenRouter : bascule, liste blanche, dialecte et média');
process.exit(0);
