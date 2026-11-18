/**
 * LE BUDGET D'AGENTS PAR CRAN — la seule table qui dit combien de tâches sont déléguées à l'IA.
 *
 * Principe : ce que le code sait faire, le code le fait (axe de départ tiré par la graine, nouveauté mesurée par
 * embeddings, page assemblée depuis le catalogue, mesures, tri des compositions). L'IA ne fait que deux choses : le
 * DIRECTEUR (langage de la marque, plan du document, crans hauts) et le CHOIX dans le catalogue (`CATALOG_EFFORT`).
 *
 *   explore        quatre pistes d'idée écrites par un agent, puis une retenue par le code (Ultra seulement)
 *   judge          le juge visuel à questions fermées (un appel de vision par composition mesurée)
 */
import type { CreativityLevel } from '../contracts/common';

export interface LevelEffort {
  explore: boolean;
  judge: boolean;
}

/**
 * LE CATALOGUE PAR CRAN (10/11/2026 ; le seul mode depuis le 11/11/2026) : aucun cran n'écrit plus une page en HTML ;
 * le cran règle la FINESSE de l'assemblage, la PROFONDEUR de la configuration, la LARGEUR de l'exploration du graphe
 * et l'EXIGENCE de nouveauté.
 *
 *   chooser    `code` : le code choisit seul (0 jeton) ; `model` : le modèle choisit dans une liste courte
 *   shortlist  le nombre de candidats montrés au modèle (ou classés par le code)
 *   picks      les configurations RENDUES et mesurées par le code (la meilleure gardée, les autres proposées)
 *   assembly   `gabarit` (tel quel), `vars` (+ réglages), `zones` (+ un composant choisi par unité),
 *              `mixed` (+ squelettes de tout le graphe et réglages continus)
 *   novelty    la portée de la mémoire qui interdit de refaire une combinaison : marque, compte, tous les clients
 *   docSkin    l'habillage du document choisi par le modèle (sinon par le code, d'après la direction artistique)
 */
export interface CatalogEffort {
  chooser: 'code' | 'model';
  shortlist: number;
  picks: number;
  assembly: 'gabarit' | 'vars' | 'zones' | 'mixed';
  novelty: 'brand' | 'user' | 'global';
  docSkin: 'code' | 'model';
}

/**
 * 18/11/2026 — LE CRAN CHOISIT LA GAMME DES GABARITS, C'EST TOUT (décision produit). Même modèle, même profondeur de
 * choix et même nombre de rendus à tous les crans : la différence entre Low et Ultra vient des gabarits servis (champ
 * `tier` du catalogue, cf. `catalog/tier.ts`), plus premium à chaque cran.
 */
const SAME_EFFORT: CatalogEffort = { chooser: 'model', shortlist: 6, picks: 1, assembly: 'vars', novelty: 'user', docSkin: 'code' };

export const CATALOG_EFFORT: Record<CreativityLevel, CatalogEffort> = {
  low: SAME_EFFORT,
  medium: SAME_EFFORT,
  high: SAME_EFFORT,
  ultra: SAME_EFFORT,
};

export const catalogEffortFor = (level: CreativityLevel): CatalogEffort => CATALOG_EFFORT[level] ?? CATALOG_EFFORT.medium;

/** Ni exploration de pistes ni juge visuel, à aucun cran (même raison : le cran ne règle que la gamme). */
export const EFFORT: Record<CreativityLevel, LevelEffort> = {
  low: { explore: false, judge: false },
  medium: { explore: false, judge: false },
  high: { explore: false, judge: false },
  ultra: { explore: false, judge: false },
};

export const effortFor = (level: CreativityLevel): LevelEffort => EFFORT[level] ?? EFFORT.medium;
