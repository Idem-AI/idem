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
import { isAllowedOpenRouterModel } from './openrouter.config';
import logger from './logger';

/**
 * LES ÉCHELLES DE MODÈLES — la créativité EST la puissance du modèle : Low le plus léger, Ultra le plus
 * capable. Quatre crans. Toutes à poids ouverts (liste blanche).
 *
 *   design  concevoir : concept et storyboard vidéo, retouche écrite, direction d'un document
 *   code    écrire du code : scènes Motion Canvas, pages HTML/Tailwind (et les corriger)
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

/** Quelle échelle suit chaque rôle créatif. Un rôle absent garde le modèle de son profil à tous les crans. */
export const ROLE_LADDERS: Record<string, ModelLadder> = {
  'graphic.director': 'design',
  'graphic.author': 'code',
  'video.concept': 'design',
  'video.planner': 'design',
  'video.author': 'code',
  'video.reviser': 'design',
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
  const custom = process.env[`IDEM_LADDER_${ladder.toUpperCase()}_${level.toUpperCase()}`]?.trim();
  if (custom) {
    if (isAllowedOpenRouterModel(custom)) return custom;
    logger.warn('creative.ladder_model_refused', { event: 'creative.ladder_model_refused', ladder, level, model: custom });
  }
  return MODEL_LADDERS[ladder][level];
}
