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
import { authorPrompt } from '../../../../packages/graphic-engine/src/agents/creative-planner';
import { planDocument } from '../../../../packages/graphic-engine/src/composition-engine/plan';
import { analyzeSection } from '../../../../packages/graphic-engine/src/composition-engine/analyze';
import { FORMATS } from '../../../../packages/graphic-engine/src/design-system/formats';

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
ok('les rôles du plan directeur sont inscrits', ['graphic.content', 'graphic.director', 'graphic.asset-planner', 'video.intent-classifier', 'video.concept', 'video.planner', 'video.author', 'visual.critic', 'generation.repair'].every((r) => CREATIVE_ROLES[r]));
ok('les noms historiques mènent au rôle logique', roleOf('author') === 'video.author' && roleOf('creative.graphic.composer') === 'graphic.director' && roleOf('video.author:s3') === 'video.author');
const plain = roleConfig('graphic.director', 'coder', 'high');
ok('sans configuration : le profil du rôle, plafonné au cran', plain.modelName === AI_CONFIG.creative.coder.modelName && plain.llmOptions?.maxOutputTokens === CREATIVE_ROLES['graphic.director'].maxOutputTokens.high && !hasRoleRouting('graphic.director'));
ok('le plafond croît avec le cran', roleConfig('graphic.director', 'coder', 'ultra').llmOptions!.maxOutputTokens! > roleConfig('graphic.director', 'coder', 'high').llmOptions!.maxOutputTokens!);

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
const self = roleConfig('video.author', 'coder', 'max');
ok('auto-hébergé configuré : le codeur part sur nos machines, avec son modèle', self.provider === LLMProvider.SELFHOSTED && self.modelName === 'qwen3-coder-30b' && getProvider(LLMProvider.SELFHOSTED).baseUrl === 'http://gpu-1.internal:8000/v1');
process.env.IDEM_ROLE_VISUAL_CRITIC_ENDPOINT = 'selfhosted';
ok('un rôle qui exige la vision ne part pas vers un point d’accès qui ne la déclare pas', roleConfig('visual.critic', 'critic').provider === LLMProvider.OPENROUTER);
reset();

// Aucun prompt de moteur ne nomme un fournisseur ni un modèle.
const section = { id: 's', title: 'Titre', blocks: [{ id: 'b1', kind: 'prose' as const, paragraphs: ['Un paragraphe.'] }] };
const prompt = authorPrompt(planDocument({ documentType: 'pitch-deck', format: 'slide-16x9', seed: 'x' }), 'Marque', FORMATS['slide-16x9'], section, analyzeSection(section), []);
ok('les prompts des moteurs ne nomment ni fournisseur ni modèle', !/gemini|openai|gpt-?\d|qwen|claude|llama|openrouter/i.test(prompt.system + prompt.user));

// L'échelle de modèles de la vidéo : le cran choisit le modèle.
for (const k of Object.keys(process.env)) if (/^IDEM_(ROLE_VIDEO|LADDER)_/.test(k)) delete process.env[k];
const levels = ['low', 'medium', 'high', 'max', 'ultra'] as const;
ok('échelles vidéo : chaque barreau est un modèle autorisé, et chaque cran en change', (Object.keys(MODEL_LADDERS) as (keyof typeof MODEL_LADDERS)[]).every((l) => levels.every((lv) => isAllowedOpenRouterModel(MODEL_LADDERS[l][lv])) && new Set(levels.map((lv) => MODEL_LADDERS[l][lv])).size === levels.length));
ok('le cran choisit le modèle de l’auteur (Low le plus léger, Ultra le plus capable), épinglé', levels.every((lv) => roleConfig('video.author', 'coder', lv).modelName === MODEL_LADDERS.code[lv] && roleConfig('video.author', 'coder', lv).pinModel === true) && roleConfig('video.planner', 'agents', 'low').modelName === MODEL_LADDERS.design.low);
process.env.IDEM_LADDER_CODE_HIGH = allowed;
process.env.IDEM_ROLE_VIDEO_AUTHOR_MODEL_MAX = allowed;
ok('un barreau ou un modèle par cran se règlent par l’environnement', roleConfig('video.author', 'coder', 'high').modelName === allowed && roleConfig('video.author', 'coder', 'max').modelName === allowed && roleConfig('video.author', 'coder', 'low').modelName === MODEL_LADDERS.code.low);
delete process.env.IDEM_LADDER_CODE_HIGH;
delete process.env.IDEM_ROLE_VIDEO_AUTHOR_MODEL_MAX;

console.log(`\n${failures ? '✗' : '✓'} Rôles créatifs : ${passed} vérification(s) réussie(s), ${failures} en échec.`);
process.exit(failures ? 1 : 0);
