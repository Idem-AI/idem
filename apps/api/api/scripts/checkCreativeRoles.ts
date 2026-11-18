/**
 * Contrôle des RÔLES CRÉATIFS — `npm run check:roles`.
 *
 * Les moteurs appellent des rôles logiques ; le modèle se résout par configuration (OpenRouter, ou nos
 * machines compatibles OpenAI), jamais dans un prompt. Aucun appel réseau.
 */
import { ROLE_MODEL_OVERRIDES } from '../config/ai-models.config';
import { isAllowedOpenRouterModel, TEXT_MODEL } from '../config/openrouter.config';
import { CREATIVE_ROLES, hasRoleRouting, MODEL_LADDERS, roleConfig, roleOf } from '../config/creative-roles';
import { AI_CONFIG, LLMProvider } from '../config/ai.config';
import { getProvider } from '../config/ai-providers.config';
import { OPENROUTER_DEFAULT_ROLES } from '../config/openrouter.config';
import { languagePrompt, planPrompt } from '../../../../packages/graphic-engine/src/author/prompts';
import { chooseSystem } from '../../../../packages/graphic-engine/src/catalog/choose';
import { FORMATS } from '../../../../packages/graphic-engine/src/design-system/formats';
import { buildTokens } from '../../../../packages/graphic-engine/src/design-system/tokens';

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
ok('les rôles sont inscrits', ['graphic.content', 'graphic.director', 'graphic.template', 'graphic.asset-planner', 'video.intent-classifier', 'video.concept', 'video.planner', 'video.author'].every((r) => CREATIVE_ROLES[r]));
ok('aucun rôle de critique ni de réparation esthétique', !CREATIVE_ROLES['visual.critic'] && !CREATIVE_ROLES['generation.repair'] && !CREATIVE_ROLES['graphic.artDirector']);
ok('les noms historiques mènent au rôle logique', roleOf('author') === 'video.author' && roleOf('video.author:s3') === 'video.author');
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
const tokens = buildTokens({ brand: { name: 'Marque' }, format: 'slide-16x9' });
const ctx = { documentType: 'pitch-deck' as const, locale: 'fr', tokens, format: FORMATS['slide-16x9'], allowDark: false, bindings: 'values' as const };
const plan = planPrompt(ctx, [{ id: 's' }, { id: 't' }], undefined, []);
const language = languagePrompt(ctx);
const prompt = chooseSystem('a slide of an investor pitch deck') + plan.system + plan.user + language.system + language.user;
ok('les prompts des moteurs ne nomment ni fournisseur ni modèle', !/gemini|openai|gpt-?\d|qwen|claude|llama|openrouter/i.test(prompt));

// Les échelles de modèles (vidéo et livrables graphiques) : le cran choisit le modèle.
for (const k of Object.keys(process.env)) if (/^IDEM_(ROLE_VIDEO|ROLE_GRAPHIC|LADDER)_/.test(k)) delete process.env[k];
const levels = ['low', 'medium', 'high', 'ultra'] as const;
ok('quatre crans seulement (Low, Medium, High, Ultra)', (Object.keys(MODEL_LADDERS) as (keyof typeof MODEL_LADDERS)[]).every((l) => Object.keys(MODEL_LADDERS[l]).join(',') === levels.join(',')));
const ladders = Object.keys(MODEL_LADDERS) as (keyof typeof MODEL_LADDERS)[];
ok('échelles : chaque barreau est un modèle autorisé', ladders.every((l) => levels.every((lv) => isAllowedOpenRouterModel(MODEL_LADDERS[l][lv]))));
// Les livrables graphiques changent de modèle à chaque cran ; la vidéo change surtout de BUDGET d'essais (plan qualité).
// 18/11/2026 : UN SEUL MODÈLE à tous les crans (le cran choisit la gamme des gabarits, cf. idem-templates `tier`).
ok('un seul modèle : toutes les échelles, tous les crans, tous les rôles par défaut', new Set(ladders.flatMap((l) => levels.map((lv) => MODEL_LADDERS[l][lv]))).size === 1 && new Set(Object.values(OPENROUTER_DEFAULT_ROLES).filter((m) => !/flux|image/.test(m))).size === 1 && MODEL_LADDERS.design.low === TEXT_MODEL);
ok('le cran ne change ni le modèle ni le plafond d’un rôle', Object.keys(CREATIVE_ROLES).every((r) => new Set(levels.map((lv) => roleConfig(r, 'agents', lv).modelName)).size === 1 && new Set(levels.map((lv) => CREATIVE_ROLES[r].maxOutputTokens[lv])).size === 1));
ok('aucun modèle fermé dans les échelles (retour aux poids ouverts, 10/11/2026)', Object.values(MODEL_LADDERS).every((l) => Object.values(l).every((m) => !/muse-ember|gpt-6|claude-opus/.test(m))));
ok('aucun repli de MODÈLE (la bascule se fait entre hébergeurs)', levels.every((lv) => ['video.sampler', 'video.author', 'video.planner', 'video.judge-vlm', 'graphic.template'].every((r) => { const c = roleConfig(r, 'coder', lv); return c.pinModel === true && !(c.fallbackModels || []).length; })));
ok('catalogues : le choix (images et vidéos) suit l’échelle « catalog » au cran choisi, le directeur l’échelle « design » au cran le plus haut', levels.every((lv) => roleConfig('graphic.template', 'agents', lv).modelName === MODEL_LADDERS.catalog[lv] && roleConfig('video.template', 'agents', lv).modelName === MODEL_LADDERS.catalog[lv] && roleConfig('graphic.director', 'agents', lv).modelName === MODEL_LADDERS.design[({ low: 'medium', medium: 'high', high: 'high', ultra: 'ultra' } as const)[lv]]));
// Plan qualité créative (04/11/2026) : l'idée au modèle le plus fort, en raisonnant ; l'exécution au cran du client.
ok('économie : aucun rôle n’est poussé à un cran supérieur', Object.values(CREATIVE_ROLES).every((r) => !r.boost));
ok('économie : aucun rôle créatif ne raisonne, à aucun cran (sorties courtes et structurées)', Object.keys(CREATIVE_ROLES).every((r) => levels.every((lv) => (roleConfig(r, 'agents', lv).llmOptions?.extraBody as any)?.thinking?.type !== 'enabled')));
ok('économie : l’exploration de pistes est courte (G2 : ≤ 1 000 jetons)', CREATIVE_ROLES['graphic.explore'].maxOutputTokens.ultra <= 1000 && CREATIVE_ROLES['video.concept-explore'].maxOutputTokens.ultra <= 1000);
ok('qualité créative : le juge des pages suit le modèle de vision, à température nulle', roleConfig('graphic.judge', 'agents', 'medium').modelName === MODEL_LADDERS['video-vision'].medium && roleConfig('graphic.judge', 'agents', 'medium').llmOptions?.temperature === 0);
ok('aucun modèle n’écrit plus de HTML de page ni de scène (auteurs libres retirés le 11/11/2026)', !['graphic.author', 'graphic.cover', 'video.html-author'].some((r) => r in CREATIVE_ROLES));
process.env.IDEM_LADDER_CATALOG_HIGH = allowed;
process.env.IDEM_LADDER_VIDEO_SAMPLE_LOW = allowed;
process.env.IDEM_ROLE_VIDEO_AUTHOR_MODEL_ULTRA = allowed;
ok('un barreau ou un modèle par cran se règlent par l’environnement (échelles vidéo comprises)', roleConfig('video.template', 'agents', 'high').modelName === allowed && roleConfig('video.sampler', 'coder', 'low').modelName === allowed && roleConfig('video.author', 'coder', 'ultra').modelName === allowed && roleConfig('video.author', 'coder', 'medium').modelName === MODEL_LADDERS['video-code'].medium);
delete process.env.IDEM_LADDER_CATALOG_HIGH;
delete process.env.IDEM_LADDER_VIDEO_SAMPLE_LOW;
delete process.env.IDEM_ROLE_VIDEO_AUTHOR_MODEL_ULTRA;

console.log(`\n${failures ? '✗' : '✓'} Rôles créatifs : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
process.exit(failures ? 1 : 0);
