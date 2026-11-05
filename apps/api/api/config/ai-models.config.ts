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
export type ModelLadder = 'design' | 'code' | 'video-design' | 'video-code' | 'video-sample' | 'video-vision' | 'video-teacher';

/**
 * Mise à jour 05/11/2026 (demande de l'utilisateur : « les modèles sont très anciens, pas très
 * performants, trop peu de paramètres, les rendus ne sont pas très originaux »). Chaque remplacement est
 * vérifié aux trois preuves de `openrouter.config.ts` (poids publiés, licence lue sur Hugging Face,
 * identifiant OpenRouter exact) avant d'entrer ici — jamais sur la seule ressemblance du nom.
 *
 *   design.low     qwen3.5-9b (dense 9B)       → qwen3.6-35b-a3b (MoE plus récente, même coût d'inférence)
 *   design.medium  qwen3.5-27b (dense, 3.5)    → qwen3.8-27b (dense, 3.8, 1 M ctx — déjà l'auteur qualité vidéo)
 *   design.high    qwen3.5-397b-a17b (3.5)     → z-ai/glm-5.3-flash (320 B/18 B actifs, 3.5× moins cher,
 *                                                 déjà le storyboard vidéo aux crans High/Ultra en production)
 *   design.ultra, code.ultra   deepseek-v4-pro → deepseek-v4.1-flash : comparatif OFFICIEL DeepSeek, devant
 *                                                 V4 Pro sur la plupart des bancs de code/agents, 4× moins cher
 *
 * `high` est le plafond RÉEL de la plupart des générations (Ultra n'est forcé qu'en version Signature,
 * cf. [[idem-creativity-gauge]]) : c'est le cran qui change le plus visiblement le rendu perçu.
 */
export const MODEL_LADDERS: Record<ModelLadder, Record<CreativityLevel, string>> = {
  design: {
    low: 'qwen/qwen3.6-35b-a3b',
    medium: 'qwen/qwen3.8-27b',
    high: 'z-ai/glm-5.3-flash',
    ultra: 'deepseek/deepseek-v4.1-flash',
  },
  code: {
    low: 'qwen/qwen3-coder-30b-a3b-instruct',
    medium: 'qwen/qwen3-coder-next',
    high: 'qwen/qwen3-coder',
    ultra: 'deepseek/deepseek-v4.1-flash',
  },
  /**
   * LE MOTEUR VIDÉO (plan qualité avec petits modèles, 29/10/2026) : des modèles de 27 à 35 milliards de paramètres,
   * auto-hébergeables sur un GPU ; la qualité vient de l'outillage (système de design, solveurs, échantillonnage, juge).
   * Le cran choisit le BUDGET d'essais autant que le modèle (`apps/ivision/core/src/video/author/sampler.ts`).
   *
   *   video-design   concept, storyboard, retouche écrite (GLM-5.3-Flash au cran High et Ultra) ;
   *   video-code     l'auteur de QUALITÉ : réécriture d'une scène difficile (Low n'en a pas : il échantillonne) ;
   *   video-sample   l'échantillonneur : 6 à 10 variantes par scène, rapide et peu cher ;
   *   video-vision   le départage visuel optionnel (Ultra) ;
   *   video-teacher  le professeur HORS LIGNE (bibliothèque de scènes de référence), jamais en production.
   */
  'video-design': { low: 'qwen/qwen3.8-27b', medium: 'qwen/qwen3.8-27b', high: 'z-ai/glm-5.3-flash', ultra: 'z-ai/glm-5.3-flash' },
  'video-code': { low: 'qwen/qwen3.6-35b-a3b', medium: 'qwen/qwen3.8-27b', high: 'qwen/qwen3.8-27b', ultra: 'qwen/qwen3.8-27b' },
  'video-sample': { low: 'qwen/qwen3.6-35b-a3b', medium: 'qwen/qwen3.6-35b-a3b', high: 'qwen/qwen3.6-35b-a3b', ultra: 'qwen/qwen3.6-35b-a3b' },
  'video-vision': { low: 'qwen/qwen3.8-27b', medium: 'qwen/qwen3.8-27b', high: 'qwen/qwen3.8-27b', ultra: 'qwen/qwen3.8-27b' },
  'video-teacher': { low: 'qwen/qwen3.8-2.4t-a95b', medium: 'qwen/qwen3.8-2.4t-a95b', high: 'qwen/qwen3.8-2.4t-a95b', ultra: 'qwen/qwen3.8-2.4t-a95b' },
};

/** Les replis d'une échelle (même cran) : le modèle qui prend le relais si le premier est indisponible. */
export const LADDER_FALLBACKS: Partial<Record<ModelLadder, Partial<Record<CreativityLevel, string[]>>>> = {
  'video-design': { low: ['z-ai/glm-5.3-flash'], medium: ['z-ai/glm-5.3-flash'], high: ['qwen/qwen3.8-27b'], ultra: ['qwen/qwen3.8-27b'] },
  'video-code': { low: ['qwen/qwen3-coder-next'], medium: ['qwen/qwen3.6-27b'], high: ['qwen/qwen3.6-27b'], ultra: ['qwen/qwen3.6-27b'] },
  'video-sample': { low: ['qwen/qwen3-coder-next'], medium: ['qwen/qwen3-coder-next'], high: ['qwen/qwen3-coder-next'], ultra: ['qwen/qwen3-coder-next'] },
  'video-vision': { low: ['qwen/qwen3-vl-8b-instruct'], medium: ['qwen/qwen3-vl-8b-instruct'], high: ['qwen/qwen3-vl-8b-instruct'], ultra: ['qwen/qwen3-vl-8b-instruct'] },
  'video-teacher': { low: ['deepseek/deepseek-v4.1-flash', 'z-ai/glm-5.3'], medium: ['deepseek/deepseek-v4.1-flash', 'z-ai/glm-5.3'], high: ['deepseek/deepseek-v4.1-flash', 'z-ai/glm-5.3'], ultra: ['deepseek/deepseek-v4.1-flash', 'z-ai/glm-5.3'] },
};

/** Les replis autorisés (liste blanche) d'une échelle à un cran. */
export function ladderFallbacks(ladder: ModelLadder, level: CreativityLevel): string[] {
  return (LADDER_FALLBACKS[ladder]?.[level] || []).filter((m) => isAllowedOpenRouterModel(m));
}

/** Quelle échelle suit chaque rôle créatif. Un rôle absent garde le modèle de son profil à tous les crans. */
export const ROLE_LADDERS: Record<string, ModelLadder> = {
  'graphic.director': 'design',
  // Plan qualité créative (04/11/2026) : l'exploration d'idées (4 pistes) suit l'échelle « design » au cran le plus
  // haut, quel que soit le cran choisi (`pinLevel` dans `creative-roles.ts`).
  'graphic.explore': 'design',
  'video.concept-explore': 'design',
  // Le juge visuel à questions fermées des pages : le modèle de vision du moteur vidéo.
  'graphic.judge': 'video-vision',
  // L'auteur des scènes HTML (HyperFrames) : les modèles de code du moteur graphique, qui écrivent déjà du HTML Tailwind.
  'video.html-author': 'code',
  'graphic.page-director': 'design',
  // Le travail divisé : le plan de mise en page (petite sortie JSON), puis une zone par agent.
  'graphic.layout': 'design',
  'graphic.zone': 'code',
  // La couverture : toujours appelée au cran Ultra par le moteur (le meilleur modèle de code).
  'graphic.cover': 'code',
  'graphic.author': 'code',
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
