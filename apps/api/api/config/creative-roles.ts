/**
 * LES RÔLES CRÉATIFS — une orchestration qui ne dépend d'aucun fournisseur.
 *
 * Les moteurs (graphique, vidéo) appellent des RÔLES logiques, jamais un modèle : le directeur d'un document,
 * l'auteur des pages, l'auteur des scènes… Chaque rôle déclare ce dont il a BESOIN (code, vision, sortie
 * structurée, long contexte) et ses plafonds de jetons par cran ; le modèle effectif se résout ICI, par la
 * configuration du service — jamais dans un prompt :
 *
 *   IDEM_ROLE_<RÔLE>_MODEL      un modèle précis pour ce rôle (OpenRouter : vérifié par la liste blanche) ;
 *   IDEM_ROLE_<RÔLE>_ENDPOINT   `selfhosted` : le rôle part sur nos machines (`IDEM_SELFHOSTED_BASE_URL`,
 *                               API compatible OpenAI), avec `IDEM_ROLE_<RÔLE>_MODEL` ou le modèle du rôle ;
 *   sans rien                   le profil par défaut du rôle (`AI_CONFIG.creative[profile]`).
 *
 * `<RÔLE>` : le nom en majuscules, `.` et `-` remplacés par `_` (`video.author` → `VIDEO_AUTHOR`).
 * Un rôle qui exige la vision n'est jamais aiguillé vers un point d'accès qui ne la déclare pas.
 */
import type { CreativityLevel } from '@idem/shared-models';
import { AI_CONFIG, FeatureAIConfig, LLMProvider } from './ai.config';
import { isProviderConfigured, providerSupports } from './ai-providers.config';
import { isAllowedOpenRouterModel } from './openrouter.config';
import { ladderFallbacks, ladderModel, MODEL_LADDERS, ModelLadder, ROLE_LADDERS, ROLE_MODEL_OVERRIDES } from './ai-models.config';
import logger from './logger';

export type RoleCapability = 'code' | 'vision' | 'json' | 'long-context';
export type CreativeProfile = 'agents' | 'critic' | 'coder';

export interface CreativeRole {
  /** Le profil de modèle par défaut (`AI_CONFIG.creative`). */
  profile: CreativeProfile;
  needs: RoleCapability[];
  /** Plafond de jetons de SORTIE d'un appel, par cran (0 : le rôle ne travaille pas à ce cran). */
  maxOutputTokens: Record<CreativityLevel, number>;
  /** Ce que fait le rôle (documentation, journaux). */
  mission: string;
  /**
   * Le cran du MODÈLE imposé, quel que soit le cran choisi (plan qualité créative : l'idée se décide au modèle le plus
   * fort, l'exécution reste au cran du client). Le plafond de sortie suit toujours le cran demandé.
   */
  pinLevel?: CreativityLevel;
  /** Raisonnement demandé (le plafond de sortie doit le permettre : `MIN_TOKENS_FOR_THINKING`). */
  thinking?: boolean;
  /** Température propre au rôle (écrêtée à 0,65 quand le raisonnement est actif, par `reconcileThinkingBudget`). */
  temperature?: number;
}

export { MODEL_LADDERS, ladderModel };
export type { ModelLadder };

const UP_TO = (high: number, ultra: number, medium = 0, low = 0): Record<CreativityLevel, number> => ({ low, medium, high, ultra });
const ALL = (n: number): Record<CreativityLevel, number> => ({ low: n, medium: n, high: n, ultra: n });

/** Le registre : les rôles logiques du plan directeur, et les noms historiques qui y mènent. */
export const CREATIVE_ROLES: Record<string, CreativeRole> = {
  'graphic.content': { profile: 'agents', needs: ['json'], maxOutputTokens: ALL(3500), mission: 'rédiger le contenu structuré des livrables' },
  // Les livrables graphiques (flyers, business plan, charte, carte de visite, pitch deck) : mêmes étapes à tous les
  // crans ; le cran choisit le MODÈLE. Le directeur écrit la bible du document, l'auteur écrit chaque page en Tailwind.
  // Plan qualité créative (04/11/2026) : le directeur décide au modèle le plus fort de son échelle, en raisonnant
  // (plafond porté à 9 000 : le raisonnement en est décompté, `MIN_TOKENS_FOR_THINKING` = 8 000).
  'graphic.director': { profile: 'agents', needs: ['long-context'], maxOutputTokens: ALL(9000), mission: 'concevoir la direction d’un document : la bible visuelle et l’idée de chaque page', pinLevel: 'ultra', thinking: true, temperature: 0.5 },
  // L'exploration : quatre pistes d'idée qui divergent sur des axes donnés, avant que le directeur n'en développe une.
  'graphic.explore': { profile: 'agents', needs: ['long-context'], maxOutputTokens: ALL(9000), mission: 'proposer quatre pistes d’idée distinctes pour un document', pinLevel: 'ultra', thinking: true, temperature: 0.65 },
  // Le juge visuel : cinq questions fermées sur la capture d'une page (départage des variantes, défauts dits à l'auteur).
  'graphic.judge': { profile: 'agents', needs: ['vision'], maxOutputTokens: ALL(120), mission: 'répondre par oui ou non à cinq questions sur la capture d’une page', temperature: 0 },
  // Le travail divisé : avant l'auteur, une petite tâche par page — le point focal, les zones, les groupes.
  'graphic.page-director': { profile: 'agents', needs: [], maxOutputTokens: ALL(600), mission: 'décider la hiérarchie d’une page (point focal, zones, groupes) avant que l’auteur ne l’écrive' },
  // Le travail divisé des pages de document : un plan de mise en page (grille et zones, JSON), puis une zone par agent.
  'graphic.layout': { profile: 'agents', needs: ['json'], maxOutputTokens: ALL(1200), mission: 'inventer la grille et les zones d’une page en suivant la direction artistique' },
  'graphic.zone': { profile: 'coder', needs: ['code'], maxOutputTokens: ALL(5000), mission: 'écrire le HTML Tailwind d’une seule zone de page' },
  // La couverture, signature du document : le modèle Ultra quel que soit le cran choisi, un grand budget d'écriture.
  'graphic.cover': { profile: 'coder', needs: ['code', 'long-context'], maxOutputTokens: ALL(24000), mission: 'composer librement la couverture d’un document, au meilleur modèle' },
  'graphic.author': { profile: 'coder', needs: ['code', 'long-context'], maxOutputTokens: ALL(12000), mission: 'écrire (et corriger) le HTML Tailwind de chaque page' },
  'graphic.pattern-designer': { profile: 'coder', needs: ['code'], maxOutputTokens: ALL(3000), mission: 'dessiner la tuile de motif propre à la marque (SVG)' },
  'graphic.asset-planner': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(800, 1000), mission: 'déterminer les ressources visuelles nécessaires' },
  'video.intent-classifier': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(300, 300, 300), mission: 'comprendre le besoin vidéo et les médias disponibles' },
  // Le film Motion Canvas : mêmes étapes à tous les crans ; le cran choisit le MODÈLE (échelles ci-dessus).
  // Plan qualité créative (04/11/2026) : le concept au modèle le plus fort de son échelle, en raisonnant.
  'video.concept': { profile: 'coder', needs: ['long-context'], maxOutputTokens: ALL(12000), mission: 'inventer le film : concept, bible visuelle, idée de chaque scène', pinLevel: 'ultra', thinking: true, temperature: 0.5 },
  'video.concept-explore': { profile: 'agents', needs: ['long-context'], maxOutputTokens: ALL(9000), mission: 'proposer quatre pistes de film distinctes avant le concept', pinLevel: 'ultra', thinking: true, temperature: 0.65 },
  // Le rendu HyperFrames : chaque scène écrite en HTML Tailwind animé (CSS, WAAPI, Anime.js — jamais GSAP).
  'video.html-author': { profile: 'coder', needs: ['code'], maxOutputTokens: ALL(12000), mission: 'écrire une scène de film en HTML Tailwind animé pour HyperFrames' },
  // GLM-5.3-Flash (High, Ultra) raisonne et son raisonnement est décompté du plafond : marge large.
  'video.planner': { profile: 'agents', needs: ['long-context'], maxOutputTokens: ALL(16000), mission: 'écrire le storyboard : durées, rôles, énergie, intentions, idées, textes, médias, voix' },
  'video.author': { profile: 'coder', needs: ['code', 'json', 'long-context'], maxOutputTokens: ALL(16000), mission: 'écrire (et réécrire) l’intention ou le programme d’une scène difficile — l’auteur de qualité' },
  'video.reviser': { profile: 'agents', needs: [], maxOutputTokens: ALL(6000), mission: 'lire une retouche écrite par le client' },
  'video.sampler': { profile: 'coder', needs: ['code', 'json'], maxOutputTokens: ALL(4000), mission: 'écrire beaucoup de variantes d’une scène (intention en sortie structurée) : l’échantillonnage' },
  'video.judge-vlm': { profile: 'agents', needs: ['vision', 'json'], maxOutputTokens: ALL(400), mission: 'départager deux finalistes sur image (questions fermées, ordre inversé) — optionnel' },
  'video.teacher': { profile: 'coder', needs: ['code', 'json', 'long-context'], maxOutputTokens: ALL(12000), mission: 'hors ligne : fabriquer des scènes de référence pour la bibliothèque' },
};

/** Les noms historiques des appelants (moteur graphique, cœur vidéo) → leur rôle logique. */
export const ROLE_ALIASES: Record<string, string> = {
  'graphic.composer': 'graphic.author',
  director: 'video.concept',
  author: 'video.author',
};

export const roleOf = (name: string): string => {
  const bare = name.replace(/^creative\./, '').replace(/:.*$/, '');
  return CREATIVE_ROLES[bare] ? bare : ROLE_ALIASES[bare] ?? bare;
};

const envKey = (role: string) => role.toUpperCase().replace(/[.-]/g, '_');

/**
 * La configuration d'appel d'un rôle : le profil par défaut, son modèle ou son point d'accès surchargés par
 * l'environnement, son plafond de sortie au cran donné. Un rôle inconnu garde le profil demandé.
 */
export function roleConfig(name: string, profile: CreativeProfile, requested?: CreativityLevel): FeatureAIConfig {
  // Un cran « max » gardé avec une ancienne génération vaut « high » (le cran Max n'existe plus).
  const level = requested === ('max' as CreativityLevel) ? 'high' : requested;
  const role = roleOf(name);
  const declared = CREATIVE_ROLES[role];
  // `IDEM_QUALITY_PIN=0` rend aux rôles leur réglage d'avant le plan qualité créative (modèle au cran du client, sans
  // raisonnement ni température propre) : la ligne de base se mesure ainsi sur l'ancien comportement.
  const def = declared && process.env.IDEM_QUALITY_PIN === '0' ? { ...declared, pinLevel: undefined, thinking: undefined, temperature: undefined } : declared;
  const base: FeatureAIConfig = AI_CONFIG.creative[def?.profile ?? profile];
  const key = envKey(role);
  // Priorité : modèle du rôle à CE cran › modèle du rôle (tous crans) › échelle du rôle au cran.
  const model = (level && process.env[`IDEM_ROLE_${key}_MODEL_${level.toUpperCase()}`]?.trim()) || process.env[`IDEM_ROLE_${key}_MODEL`]?.trim();
  const endpoint = process.env[`IDEM_ROLE_${key}_ENDPOINT`]?.trim().toLowerCase();
  const cap = def && level ? def.maxOutputTokens[level] : 0;
  // Le raisonnement et la température du rôle (plan qualité créative) : posés ici, dans les deux dialectes, pour que
  // `reconcileThinkingBudget` les voie (il coupe le raisonnement si le plafond est trop court, écrête la température).
  const llmOptions = {
    ...base.llmOptions,
    ...(cap ? { maxOutputTokens: cap } : {}),
    ...(def?.temperature !== undefined ? { temperature: def.temperature } : {}),
    ...(def?.thinking ? { thinkingBudget: undefined, extraBody: { ...base.llmOptions?.extraBody, thinking: { type: 'enabled' } } } : {}),
  };
  // Le cran du MODÈLE : imposé par le rôle (l'idée au modèle le plus fort), sinon celui du client.
  const modelLevel: CreativityLevel | undefined = def?.pinLevel ?? level;

  if (endpoint === 'selfhosted') {
    const visionOk = !def?.needs.includes('vision') || providerSupports(LLMProvider.SELFHOSTED, 'vision');
    if (isProviderConfigured(LLMProvider.SELFHOSTED) && visionOk) {
      return { ...base, provider: LLMProvider.SELFHOSTED, modelName: model || process.env.IDEM_SELFHOSTED_MODEL?.trim() || base.modelName, pinModel: true, fallbackModels: [], llmOptions };
    }
    logger.warn('creative.role_endpoint_unavailable', { event: 'creative.role_endpoint_unavailable', role, reason: visionOk ? 'selfhosted not configured' : 'vision required' });
  }
  if (model) {
    if (isAllowedOpenRouterModel(model)) return { ...base, modelName: model, pinModel: true, llmOptions };
    logger.warn('creative.role_model_refused', { event: 'creative.role_model_refused', role, model });
  }
  const ladder = ROLE_LADDERS[role];
  const fixed = modelLevel ? ROLE_MODEL_OVERRIDES[role]?.[modelLevel] : undefined;
  if (fixed && isAllowedOpenRouterModel(fixed)) return { ...base, modelName: fixed, pinModel: true, llmOptions };
  if (ladder && modelLevel) {
    const fallbacks = ladderFallbacks(ladder, modelLevel);
    return { ...base, modelName: ladderModel(ladder, modelLevel), pinModel: true, llmOptions, ...(fallbacks.length ? { fallbackModels: fallbacks } : {}) };
  }
  return { ...base, llmOptions };
}

/** Un modèle ou un point d'accès est-il configuré pour ce rôle ? (sinon l'appelant garde sa configuration) */
export function hasRoleRouting(name: string): boolean {
  const key = envKey(roleOf(name));
  return Boolean(process.env[`IDEM_ROLE_${key}_MODEL`]?.trim() || process.env[`IDEM_ROLE_${key}_ENDPOINT`]?.trim());
}
