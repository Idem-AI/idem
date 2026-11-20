/**
 * LES MODÈLES PAR FONCTIONNALITÉ ET PAR CRAN DE CRÉATIVITÉ — le fichier à ouvrir pour savoir (et changer)
 * QUEL MODÈLE travaille pour QUELLE fonctionnalité à QUEL cran.
 *
 * Trois tables, de la plus large à la plus précise :
 *
 *   1. `MODEL_LADDERS`        les échelles : un modèle par cran (Low → Ultra), partagées par plusieurs rôles ;
 *   2. `ROLE_LADDERS`         quelle échelle suit chaque rôle créatif (vidéo, livrables graphiques) ;
 *   3. `ROLE_MODEL_OVERRIDES` un modèle imposé pour UN rôle à UN cran (prime sur l'échelle).
 *
 * Tous les modèles doivent être dans la liste blanche (`openrouter.config.ts`) ; un modèle refusé est
 * ignoré et journalisé. Les fonctionnalités qui ne dépendent pas du cran (onboarding, finance, simulation…)
 * sont déclarées dans `ai.config.ts`. Pour VOIR le résultat complet, fonctionnalité par fonctionnalité :
 *
 *   npm run ai:matrix        → écrit `docs/AI_MODELS.md` (tous les rôles × 4 crans + toutes les features)
 *
 * Surcharges d'exploitation sans toucher au code : `IDEM_LADDER_<ÉCHELLE>_<CRAN>`,
 * `IDEM_ROLE_<RÔLE>_MODEL[_<CRAN>]` (cf. `creative-roles.ts`).
 */
import type { CreativityLevel } from '@idem/shared-models';
import { isAllowedOpenRouterModel, TEXT_MODEL } from './openrouter.config';
import logger from './logger';

/**
 * LES ÉCHELLES DE MODÈLES — la créativité EST la puissance du modèle : Low le plus léger, Ultra le plus
 * capable. Quatre crans. Toutes à poids ouverts (liste blanche) : la dérogation « meilleurs modèles du marché,
 * fermés compris » du 10/11/2026 a été RETIRÉE le même jour à la demande de l'utilisateur (retour aux échelles du 05/11).
 *
 *   design  concevoir : concept et storyboard vidéo, retouche écrite, direction d'un document
 *   code    écrire du code : pages HTML/Tailwind (sites, scènes vidéo) (et les corriger)
 */
export type ModelLadder = 'design' | 'code' | 'catalog' | 'video-design' | 'video-code' | 'video-sample' | 'video-vision' | 'video-teacher';

/**
 * 18/11/2026 — UN SEUL MODÈLE, À TOUS LES CRANS (décision produit). La logique ne dépend plus d'un modèle puissant :
 * les catalogues de gabarits font la mise en page, le code mesure et assemble. Le CRAN choisit désormais la GAMME
 * des gabarits (idem-templates, champ `tier` : low → ultra, de plus en plus premium), jamais le modèle.
 *
 * Toutes les échelles pointent donc vers `TEXT_MODEL` (DeepSeek V4.1 Flash 1017, cf. `openrouter.config.ts`). La
 * structure est gardée pour une surcharge d'exploitation ponctuelle (`IDEM_LADDER_<ÉCHELLE>_<CRAN>`).
 */
const SAME = (): Record<CreativityLevel, string> => ({ low: TEXT_MODEL, medium: TEXT_MODEL, high: TEXT_MODEL, ultra: TEXT_MODEL });

export const MODEL_LADDERS: Record<ModelLadder, Record<CreativityLevel, string>> = {
  design: SAME(),
  code: SAME(),
  catalog: SAME(),
  'video-design': SAME(),
  'video-code': SAME(),
  'video-sample': SAME(),
  'video-vision': SAME(),
  'video-teacher': SAME(),
};

/** Aucun repli de modèle : la bascule se fait entre hébergeurs du même modèle (OpenRouter). */
export const LADDER_FALLBACKS: Partial<Record<ModelLadder, Partial<Record<CreativityLevel, string[]>>>> = {};

/** Les replis autorisés (liste blanche) d'une échelle à un cran. */
export function ladderFallbacks(ladder: ModelLadder, level: CreativityLevel): string[] {
  return (LADDER_FALLBACKS[ladder]?.[level] || []).filter((m) => isAllowedOpenRouterModel(m));
}

/** Quelle échelle suit chaque rôle créatif. Un rôle absent garde le modèle de son profil à tous les crans. */
export const ROLE_LADDERS: Record<string, ModelLadder> = {
  'graphic.director': 'design',
  // Plan qualité créative (04/11/2026) : l'exploration d'idées (4 pistes) suit l'échelle « design » au cran le plus
  // haut, quel que soit le cran choisi (`boost` dans `creative-roles.ts`).
  'graphic.explore': 'design',
  'video.concept-explore': 'design',
  // Le juge visuel à questions fermées des pages : le modèle de vision du moteur vidéo.
  'graphic.judge': 'video-vision',
  // Le catalogue de gabarits : le choix d'un gabarit et de ses réglages (et de l'habillage du document).
  'graphic.template': 'catalog',
  // Le catalogue vidéo : la même échelle de petits modèles (un choix JSON pour tout le film).
  'video.template': 'catalog',
  'video.concept': 'video-design',
  'video.planner': 'video-design',
  'video.author': 'video-code',
  'video.reviser': 'video-design',
  'video.sampler': 'video-sample',
  'video.judge-vlm': 'video-vision',
  'video.teacher': 'video-teacher',
};

/**
 * Un modèle imposé pour un rôle à un cran précis (prime sur l'échelle). Exemple :
 *   'video.author': { ultra: 'deepseek/deepseek-v4-pro' },
 */
/**
 * Surcharges de modèle par rôle créatif et par cran. Vide : tous les rôles suivent l'échelle
 * déclarée dans `ROLE_LADDERS` (design ou code), toutes open-weight.
 */
export const ROLE_MODEL_OVERRIDES: Record<string, Partial<Record<CreativityLevel, string>>> = {};

/** Le modèle d'une échelle à un cran (variable d'environnement autorisée, sinon le barreau par défaut). */
export function ladderModel(ladder: ModelLadder, requested: CreativityLevel): string {
  const level: CreativityLevel = MODEL_LADDERS[ladder][requested] ? requested : 'high';
  const custom = process.env[`IDEM_LADDER_${ladder.toUpperCase().replace(/-/g, '_')}_${level.toUpperCase()}`]?.trim();
  if (custom) {
    if (isAllowedOpenRouterModel(custom)) return custom;
    logger.warn('creative.ladder_model_refused', { event: 'creative.ladder_model_refused', ladder, level, model: custom });
  }
  return MODEL_LADDERS[ladder][level];
}
