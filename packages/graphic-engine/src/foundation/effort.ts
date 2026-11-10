/**
 * LE BUDGET D'AGENTS PAR CRAN — la seule table qui dit combien de tâches sont déléguées à l'IA.
 *
 * Principe (10/11/2026) : ce que le code sait faire, le code le fait (axe de départ tiré par la graine, nouveauté
 * mesurée par embeddings, mise en page assemblée, cadrage, mesures, tri des variantes). L'IA n'écrit que ce qui
 * demande de la création : le langage de la marque (une fois, gardé), le plan du document, la page. Plus le cran est
 * bas, moins il y a d'allers-retours : un seul appel d'auteur par page, aucune variante, aucune retouche payante.
 * La diversité des rendus ne dépend PAS de ces appels : elle vient de l'axe de départ, de la mémoire des idées
 * et de la mesure de nouveauté, actifs à tous les crans.
 *
 *   explore        quatre pistes d'idée écrites par un agent, puis une retenue par le code (Ultra seulement)
 *   pageDirector   un agent décide la hiérarchie d'une page avant l'auteur (le plan du document la porte déjà)
 *   zones          la page en petites tâches : plan de grille + un agent par zone (sinon un seul auteur)
 *   refine         une réécriture guidée par les défauts mesurés (une page entière en sortie : chère)
 *   judge          le juge visuel à questions fermées (un appel de vision par variante mesurée)
 *   variantsSingle variantes d'une toile seule (visuel, carte) ; variantsCover : de la couverture
 */
import type { CreativityLevel } from '../contracts/common';

export interface LevelEffort {
  explore: boolean;
  pageDirector: boolean;
  zones: boolean;
  refine: boolean;
  judge: boolean;
  variantsSingle: number;
  variantsCover: number;
}

export const EFFORT: Record<CreativityLevel, LevelEffort> = {
  low: { explore: false, pageDirector: false, zones: false, refine: false, judge: false, variantsSingle: 1, variantsCover: 1 },
  medium: { explore: false, pageDirector: false, zones: false, refine: false, judge: false, variantsSingle: 1, variantsCover: 1 },
  high: { explore: false, pageDirector: true, zones: true, refine: true, judge: true, variantsSingle: 2, variantsCover: 2 },
  ultra: { explore: true, pageDirector: true, zones: true, refine: true, judge: true, variantsSingle: 3, variantsCover: 2 },
};

export const effortFor = (level: CreativityLevel): LevelEffort => EFFORT[level] ?? EFFORT.medium;
