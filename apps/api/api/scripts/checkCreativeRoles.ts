/**
 * Contrôle des RÔLES CRÉATIFS — `npm run check:roles`.
 *
 * Les moteurs appellent des rôles logiques ; le modèle se résout par configuration (OpenRouter, ou nos
 * machines compatibles OpenAI), jamais dans un prompt. Aucun appel réseau.
 */
import { isAllowedOpenRouterModel } from '../config/openrouter.config';
import { CREATIVE_ROLES, hasRoleRouting, MODEL_LADDERS, roleConfig, roleOf } from '../config/creative-roles';
import { AI_CONFIG, LLMProvider } from '../config/ai.config';
import { getProvider } from '../config/ai-providers.config';
import { OPENROUTER_DEFAULT_ROLES } from '../config/openrouter.config';
import { authorSystem, authorUser, directorPrompt } from '../../../../packages/graphic-engine/src/author/prompts';
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
ok('un modèle hors liste blanche est refusé (repli sur le profil)', roleConfig('video.concept', 'coder').modelName === AI_CONFIG.creative.coder.modelName);
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
const director = directorPrompt(ctx, [{ id: 's' }, { id: 't' }], []);
const prompt = authorSystem(ctx) + authorUser(ctx, { section, listing: buildContentMap(section).listing }) + director.system + director.user;
ok('les prompts des moteurs ne nomment ni fournisseur ni modèle', !/gemini|openai|gpt-?\d|qwen|claude|llama|openrouter/i.test(prompt));

// Les échelles de modèles (vidéo et livrables graphiques) : le cran choisit le modèle.
for (const k of Object.keys(process.env)) if (/^IDEM_(ROLE_VIDEO|ROLE_GRAPHIC|LADDER)_/.test(k)) delete process.env[k];
const levels = ['low', 'medium', 'high', 'ultra'] as const;
ok('quatre crans seulement (Low, Medium, High, Ultra)', (Object.keys(MODEL_LADDERS) as (keyof typeof MODEL_LADDERS)[]).every((l) => Object.keys(MODEL_LADDERS[l]).join(',') === levels.join(',')));
ok('échelles : chaque barreau est un modèle autorisé, et chaque cran en change', (Object.keys(MODEL_LADDERS) as (keyof typeof MODEL_LADDERS)[]).every((l) => levels.every((lv) => isAllowedOpenRouterModel(MODEL_LADDERS[l][lv])) && new Set(levels.map((lv) => MODEL_LADDERS[l][lv])).size === levels.length));
ok('le cran choisit le modèle de l’auteur (Low le plus léger, Ultra le plus capable), épinglé', levels.every((lv) => roleConfig('video.author', 'coder', lv).modelName === MODEL_LADDERS.code[lv] && roleConfig('video.author', 'coder', lv).pinModel === true) && roleConfig('video.planner', 'agents', 'low').modelName === MODEL_LADDERS.design.low);
ok('livrables graphiques : l’auteur des pages suit l’échelle « code », le directeur l’échelle « design »', levels.every((lv) => roleConfig('graphic.author', 'coder', lv).modelName === MODEL_LADDERS.code[lv] && roleConfig('graphic.director', 'agents', lv).modelName === MODEL_LADDERS.design[lv]));
process.env.IDEM_LADDER_CODE_HIGH = allowed;
process.env.IDEM_ROLE_VIDEO_AUTHOR_MODEL_ULTRA = allowed;
ok('un barreau ou un modèle par cran se règlent par l’environnement', roleConfig('video.author', 'coder', 'high').modelName === allowed && roleConfig('video.author', 'coder', 'ultra').modelName === allowed && roleConfig('video.author', 'coder', 'low').modelName === MODEL_LADDERS.code.low);
delete process.env.IDEM_LADDER_CODE_HIGH;
delete process.env.IDEM_ROLE_VIDEO_AUTHOR_MODEL_ULTRA;

console.log(`\n${failures ? '✗' : '✓'} Rôles créatifs : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
process.exit(failures ? 1 : 0);
