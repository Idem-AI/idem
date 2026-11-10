/**
 * Contrôle des RÔLES CRÉATIFS — `npm run check:roles`.
 *
 * Les moteurs appellent des rôles logiques ; le modèle se résout par configuration (OpenRouter, ou nos
 * machines compatibles OpenAI), jamais dans un prompt. Aucun appel réseau.
 */
import { ROLE_MODEL_OVERRIDES } from '../config/ai-models.config';
import { isAllowedOpenRouterModel } from '../config/openrouter.config';
import { CREATIVE_ROLES, hasRoleRouting, MODEL_LADDERS, roleConfig, roleOf } from '../config/creative-roles';
import { AI_CONFIG, LLMProvider } from '../config/ai.config';
import { getProvider } from '../config/ai-providers.config';
import { OPENROUTER_DEFAULT_ROLES } from '../config/openrouter.config';
import { authorSystem, authorUser, languagePrompt, planPrompt, toolLines } from '../../../../packages/graphic-engine/src/author/prompts';
import { FORMATS } from '../../../../packages/graphic-engine/src/design-system/formats';
import { buildTokens } from '../../../../packages/graphic-engine/src/design-system/tokens';
import { buildContentMap } from '../../../../packages/graphic-engine/src/runtime/content-map';

let failures = 0;
let passed = 0;
const ok = (label: string, cond: boolean, detail = ''): void => {
  if (cond) passed += 1;
  else failures += 1;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const reset = () => {
  for (const k of Object.keys(process.env)) if (k.startsWith('IDEM_ROLE_') || k.startsWith('IDEM_SELFHOSTED_')) delete process.env[k];
};

console.log('\nRôles créatifs\n');
reset();
ok('les rôles sont inscrits', ['graphic.content', 'graphic.director', 'graphic.author', 'graphic.asset-planner', 'video.intent-classifier', 'video.concept', 'video.planner', 'video.author'].every((r) => CREATIVE_ROLES[r]));
ok('aucun rôle de critique ni de réparation esthétique', !CREATIVE_ROLES['visual.critic'] && !CREATIVE_ROLES['generation.repair'] && !CREATIVE_ROLES['graphic.artDirector']);
ok('les noms historiques mènent au rôle logique', roleOf('author') === 'video.author' && roleOf('creative.graphic.composer') === 'graphic.author' && roleOf('video.author:s3') === 'video.author');
const plain = roleConfig('graphic.content', 'agents', 'high');
ok('sans configuration ni échelle : le profil du rôle, plafonné', plain.modelName === AI_CONFIG.creative.agents.modelName && plain.llmOptions?.maxOutputTokens === CREATIVE_ROLES['graphic.content'].maxOutputTokens.high && !hasRoleRouting('graphic.content'));
ok('un ancien cran « max » vaut « high »', roleConfig('video.author', 'coder', 'max' as never).modelName === roleConfig('video.author', 'coder', 'high').modelName);

const allowed = OPENROUTER_DEFAULT_ROLES.reasoning;
process.env.IDEM_ROLE_VIDEO_CONCEPT_MODEL = allowed;
ok('un modèle de la liste blanche, configuré pour un rôle, est épinglé', roleConfig('director', 'coder').modelName === allowed && roleConfig('director', 'coder').pinModel === true && hasRoleRouting('video.concept'));
process.env.IDEM_ROLE_VIDEO_CONCEPT_MODEL = 'acme/closed-model-9000';
ok('un modèle hors liste blanche est refusé (repli sur l’échelle du rôle)', roleConfig('video.concept', 'coder').modelName !== 'acme/closed-model-9000' && roleConfig('video.concept', 'coder').modelName === MODEL_LADDERS['video-design'].high);
ok('un rôle sans échelle garde le profil quand son modèle est refusé', (process.env.IDEM_ROLE_VIDEO_REVISER_MODEL = 'acme/closed-model-9000') && roleConfig('unknown.role', 'coder').modelName === AI_CONFIG.creative.coder.modelName);
delete process.env.IDEM_ROLE_VIDEO_REVISER_MODEL;
reset();

process.env.IDEM_ROLE_VIDEO_AUTHOR_ENDPOINT = 'selfhosted';
ok('auto-hébergé non configuré : on reste chez le fournisseur par défaut', roleConfig('video.author', 'coder').provider === LLMProvider.OPENROUTER);
process.env.IDEM_SELFHOSTED_BASE_URL = 'http://gpu-1.internal:8000/v1/';
process.env.IDEM_SELFHOSTED_API_KEY = 'x';
process.env.IDEM_SELFHOSTED_MODEL = 'qwen3-coder-30b';
const self = roleConfig('video.author', 'coder', 'high');
ok('auto-hébergé configuré : le codeur part sur nos machines, avec son modèle', self.provider === LLMProvider.SELFHOSTED && self.modelName === 'qwen3-coder-30b' && getProvider(LLMProvider.SELFHOSTED).baseUrl === 'http://gpu-1.internal:8000/v1');
reset();

// Aucun prompt de moteur ne nomme un fournisseur ni un modèle.
const section = { id: 's', title: 'Titre', blocks: [{ id: 'b1', kind: 'prose' as const, paragraphs: ['Un paragraphe.'] }] };
const tokens = buildTokens({ brand: { name: 'Marque' }, format: 'slide-16x9' });
const ctx = { documentType: 'pitch-deck' as const, locale: 'fr', tokens, format: FORMATS['slide-16x9'], allowDark: false, bindings: 'values' as const };
const plan = planPrompt(ctx, [{ id: 's' }, { id: 't' }], undefined, []);
const language = languagePrompt(ctx);
const prompt = authorSystem(ctx) + authorUser(ctx, { section, listing: buildContentMap(section).listing, tools: toolLines(ctx, { charts: [], tables: [], icons: false }) }) + plan.system + plan.user + language.system + language.user;
ok('les prompts des moteurs ne nomment ni fournisseur ni modèle', !/gemini|openai|gpt-?\d|qwen|claude|llama|openrouter/i.test(prompt));

// Les échelles de modèles (vidéo et livrables graphiques) : le cran choisit le modèle.
for (const k of Object.keys(process.env)) if (/^IDEM_(ROLE_VIDEO|ROLE_GRAPHIC|LADDER)_/.test(k)) delete process.env[k];
const levels = ['low', 'medium', 'high', 'ultra'] as const;
ok('quatre crans seulement (Low, Medium, High, Ultra)', (Object.keys(MODEL_LADDERS) as (keyof typeof MODEL_LADDERS)[]).every((l) => Object.keys(MODEL_LADDERS[l]).join(',') === levels.join(',')));
const ladders = Object.keys(MODEL_LADDERS) as (keyof typeof MODEL_LADDERS)[];
ok('échelles : chaque barreau est un modèle autorisé', ladders.every((l) => levels.every((lv) => isAllowedOpenRouterModel(MODEL_LADDERS[l][lv]))));
// Les livrables graphiques changent de modèle à chaque cran ; la vidéo change surtout de BUDGET d'essais (plan qualité).
ok('livrables graphiques : chaque cran change de modèle', (['design', 'code'] as const).every((l) => new Set(levels.map((lv) => MODEL_LADDERS[l][lv])).size === levels.length));
ok('vidéo : petits modèles (≤ 35 Md de paramètres) en production, GLM-5.3-Flash au storyboard High/Ultra, le professeur à part', levels.every((lv) => roleConfig('video.sampler', 'coder', lv).modelName === 'qwen/qwen3.6-35b-a3b') && roleConfig('video.author', 'coder', 'medium').modelName === 'qwen/qwen3.8-27b' && roleConfig('video.author', 'coder', 'low').modelName === 'qwen/qwen3.6-35b-a3b' && roleConfig('video.planner', 'agents', 'high').modelName === 'z-ai/glm-5.3-flash' && roleConfig('video.planner', 'agents', 'medium').modelName === 'qwen/qwen3.8-27b' && roleConfig('video.judge-vlm', 'agents', 'ultra').modelName === 'qwen/qwen3.8-27b' && roleConfig('video.teacher', 'coder', 'high').modelName === 'qwen/qwen3.8-2.4t-a95b');
ok('aucun modèle fermé dans les échelles (retour aux poids ouverts, 10/11/2026)', Object.values(MODEL_LADDERS).every((l) => Object.values(l).every((m) => !/muse-ember|gpt-6|claude-opus|v4\.1-flash-1017/.test(m))));
ok('vidéo : chaque rôle a son repli autorisé (même cran)', levels.every((lv) => ['video.sampler', 'video.author', 'video.planner', 'video.judge-vlm', 'video.teacher'].every((r) => { const c = roleConfig(r, 'coder', lv); return c.pinModel === true && (c.fallbackModels || []).length > 0 && (c.fallbackModels || []).every((m) => isAllowedOpenRouterModel(m)); })));
ok('livrables graphiques : l’auteur des pages suit l’échelle « code » au cran choisi, le directeur l’échelle « design » au cran le plus haut', levels.every((lv) => roleConfig('graphic.author', 'coder', lv).modelName === MODEL_LADDERS.code[lv] && roleConfig('graphic.director', 'agents', lv).modelName === MODEL_LADDERS.design[({ low: 'medium', medium: 'high', high: 'high', ultra: 'ultra' } as const)[lv]]));
// Plan qualité créative (04/11/2026) : l'idée au modèle le plus fort, en raisonnant ; l'exécution au cran du client.
ok('économie : les rôles d’idée montent d’UN cran (Low→Medium, Medium→High, High→High, Ultra→Ultra), jamais Ultra à tous les crans', roleConfig('graphic.director', 'agents', 'low').modelName === MODEL_LADDERS.design.medium && roleConfig('graphic.director', 'agents', 'medium').modelName === MODEL_LADDERS.design.high && roleConfig('graphic.director', 'agents', 'high').modelName === MODEL_LADDERS.design.high && roleConfig('graphic.explore', 'agents', 'ultra').modelName === MODEL_LADDERS.design.ultra && roleConfig('video.concept', 'coder', 'low').modelName === MODEL_LADDERS['video-design'].medium);
ok('économie : le raisonnement n’est demandé qu’à High et Ultra, avec un effort borné et un plafond qui le permet', ['graphic.explore', 'graphic.director', 'video.concept', 'video.concept-explore'].every((r) => (['low', 'medium'] as const).every((lv) => (roleConfig(r, 'agents', lv).llmOptions?.extraBody as any)?.thinking?.type !== 'enabled') && (['high', 'ultra'] as const).every((lv) => { const o = roleConfig(r, 'agents', lv).llmOptions || {}; return (o.extraBody as any)?.thinking?.type === 'enabled' && ['low', 'medium'].includes((o.extraBody as any)?.reasoning_effort) && (o.maxOutputTokens ?? 0) >= 8000; })));
ok('qualité créative : le juge des pages suit le modèle de vision, à température nulle', roleConfig('graphic.judge', 'agents', 'medium').modelName === MODEL_LADDERS['video-vision'].medium && roleConfig('graphic.judge', 'agents', 'medium').llmOptions?.temperature === 0);
ok('qualité créative : l’auteur HTML des scènes suit l’échelle « code » au cran choisi', levels.every((lv) => roleConfig('video.html-author', 'coder', lv).modelName === MODEL_LADDERS.code[lv]));
process.env.IDEM_LADDER_CODE_HIGH = allowed;
process.env.IDEM_LADDER_VIDEO_SAMPLE_LOW = allowed;
process.env.IDEM_ROLE_VIDEO_AUTHOR_MODEL_ULTRA = allowed;
ok('un barreau ou un modèle par cran se règlent par l’environnement (échelles vidéo comprises)', roleConfig('graphic.author', 'coder', 'high').modelName === allowed && roleConfig('video.sampler', 'coder', 'low').modelName === allowed && roleConfig('video.author', 'coder', 'ultra').modelName === allowed && roleConfig('video.author', 'coder', 'medium').modelName === MODEL_LADDERS['video-code'].medium);
delete process.env.IDEM_LADDER_CODE_HIGH;
delete process.env.IDEM_LADDER_VIDEO_SAMPLE_LOW;
delete process.env.IDEM_ROLE_VIDEO_AUTHOR_MODEL_ULTRA;

console.log(`\n${failures ? '✗' : '✓'} Rôles créatifs : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
process.exit(failures ? 1 : 0);
