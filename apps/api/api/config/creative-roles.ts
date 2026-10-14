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
import logger from './logger';

export type RoleCapability = 'code' | 'vision' | 'json' | 'long-context';
export type CreativeProfile = 'agents' | 'critic' | 'coder';

export interface CreativeRole {
  /** Le profil de modèle par défaut (`AI_CONFIG.creative`). */
  profile: CreativeProfile;
  /**
   * L'échelle de modèles du rôle : le CRAN de créativité choisit le modèle (plus le cran monte, plus le
   * modèle est puissant). Sans échelle, le modèle du profil sert à tous les crans.
   */
  ladder?: ModelLadder;
  needs: RoleCapability[];
  /** Plafond de jetons de SORTIE d'un appel, par cran (0 : le rôle ne travaille pas à ce cran). */
  maxOutputTokens: Record<CreativityLevel, number>;
  /** Ce que fait le rôle (documentation, journaux). */
  mission: string;
}

/**
 * LES ÉCHELLES DE MODÈLES — la créativité EST la puissance du modèle (décision du 2026-10-14, vidéo puis
 * livrables graphiques) : Low le plus léger, Ultra le plus capable. Quatre crans (Max retiré). Toutes à poids
 * ouverts (liste blanche).
 *
 *   design  concevoir : concept et storyboard vidéo, retouche écrite, direction d'un document
 *   code    écrire du code : scènes Motion Canvas, pages HTML/Tailwind (et les corriger)
 *
 * `IDEM_LADDER_<ÉCHELLE>_<CRAN>` (ex. `IDEM_LADDER_CODE_HIGH`) remplace un barreau, s'il est autorisé.
 */
export type ModelLadder = 'design' | 'code';

export const MODEL_LADDERS: Record<ModelLadder, Record<CreativityLevel, string>> = {
  design: {
    low: 'qwen/qwen3.5-9b',
    medium: 'qwen/qwen3.5-27b',
    high: 'qwen/qwen3.5-397b-a17b',
    ultra: 'deepseek/deepseek-v4-pro',
  },
  code: {
    low: 'qwen/qwen3-coder-30b-a3b-instruct',
    medium: 'qwen/qwen3-coder-next',
    high: 'qwen/qwen3-coder',
    ultra: 'deepseek/deepseek-v4-pro',
  },
};

/** Le modèle d'une échelle à un cran (variable d'environnement autorisée, sinon le barreau par défaut). */
export function ladderModel(ladder: ModelLadder, requested: CreativityLevel): string {
  const level: CreativityLevel = MODEL_LADDERS[ladder][requested] ? requested : 'high';
  const custom = process.env[`IDEM_LADDER_${ladder.toUpperCase()}_${level.toUpperCase()}`]?.trim();
  if (custom) {
    if (isAllowedOpenRouterModel(custom)) return custom;
    logger.warn('creative.ladder_model_refused', { event: 'creative.ladder_model_refused', ladder, level, model: custom });
  }
  return MODEL_LADDERS[ladder][level];
}

const UP_TO = (high: number, ultra: number, medium = 0, low = 0): Record<CreativityLevel, number> => ({ low, medium, high, ultra });
const ALL = (n: number): Record<CreativityLevel, number> => ({ low: n, medium: n, high: n, ultra: n });

/** Le registre : les rôles logiques du plan directeur, et les noms historiques qui y mènent. */
export const CREATIVE_ROLES: Record<string, CreativeRole> = {
  'graphic.content': { profile: 'agents', needs: ['json'], maxOutputTokens: ALL(3500), mission: 'rédiger le contenu structuré des livrables' },
  // Les livrables graphiques (flyers, business plan, charte, carte de visite, pitch deck) : mêmes étapes à tous les
  // crans ; le cran choisit le MODÈLE. Le directeur écrit la bible du document, l'auteur écrit chaque page en Tailwind.
  'graphic.director': { profile: 'agents', ladder: 'design', needs: ['long-context'], maxOutputTokens: ALL(2500), mission: 'concevoir la direction d’un document : la bible visuelle et l’idée de chaque page' },
  'graphic.author': { profile: 'coder', ladder: 'code', needs: ['code', 'long-context'], maxOutputTokens: ALL(12000), mission: 'écrire (et corriger) le HTML Tailwind de chaque page' },
  'graphic.pattern-designer': { profile: 'coder', needs: ['code'], maxOutputTokens: ALL(3000), mission: 'dessiner la tuile de motif propre à la marque (SVG)' },
  'graphic.asset-planner': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(800, 1000), mission: 'déterminer les ressources visuelles nécessaires' },
  'video.intent-classifier': { profile: 'agents', needs: ['json'], maxOutputTokens: UP_TO(300, 300, 300), mission: 'comprendre le besoin vidéo et les médias disponibles' },
  // Le film Motion Canvas : mêmes étapes à tous les crans ; le cran choisit le MODÈLE (échelles ci-dessus).
  'video.concept': { profile: 'coder', ladder: 'design', needs: ['long-context'], maxOutputTokens: ALL(2500), mission: 'inventer le film : concept, bible visuelle, idée de chaque scène' },
  'video.planner': { profile: 'agents', ladder: 'design', needs: ['long-context'], maxOutputTokens: ALL(5000), mission: 'écrire le storyboard : durées, intentions, idées, textes, médias, voix' },
  'video.author': { profile: 'coder', ladder: 'code', needs: ['code', 'long-context'], maxOutputTokens: ALL(8000), mission: 'écrire (et corriger) le code Motion Canvas de chaque scène' },
  'video.reviser': { profile: 'agents', ladder: 'design', needs: [], maxOutputTokens: ALL(800), mission: 'lire une retouche écrite par le client' },
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
  const def = CREATIVE_ROLES[role];
  const base: FeatureAIConfig = AI_CONFIG.creative[def?.profile ?? profile];
  const key = envKey(role);
  // Priorité : modèle du rôle à CE cran › modèle du rôle (tous crans) › échelle du rôle au cran.
  const model = (level && process.env[`IDEM_ROLE_${key}_MODEL_${level.toUpperCase()}`]?.trim()) || process.env[`IDEM_ROLE_${key}_MODEL`]?.trim();
  const endpoint = process.env[`IDEM_ROLE_${key}_ENDPOINT`]?.trim().toLowerCase();
  const cap = def && level ? def.maxOutputTokens[level] : 0;
  const llmOptions = { ...base.llmOptions, ...(cap ? { maxOutputTokens: cap } : {}) };

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
  if (def?.ladder && level) return { ...base, modelName: ladderModel(def.ladder, level), pinModel: true, llmOptions };
  return { ...base, llmOptions };
}

/** Un modèle ou un point d'accès est-il configuré pour ce rôle ? (sinon l'appelant garde sa configuration) */
export function hasRoleRouting(name: string): boolean {
  const key = envKey(roleOf(name));
  return Boolean(process.env[`IDEM_ROLE_${key}_MODEL`]?.trim() || process.env[`IDEM_ROLE_${key}_ENDPOINT`]?.trim());
}
