/**
 * LES TROIS ENTRÉES D'UNE SIMULATION — et de la stratégie de communication.
 *
 * Une simulation ne vaut que ce que valent ses entrées. Trois livrables les
 * portent, et chacun répond à une question que les deux autres ne posent pas :
 *
 *   BUSINESS PLAN                PRÉVISIONS FINANCIÈRES      COMMUNICATION
 *   ce qu'on vend, à qui,        les prix, les charges,       par quels canaux
 *   sur quel marché              les investissements         on va chercher
 *          │                            │                    les clients
 *          │                            │                            │
 *          └── offre, marché, modèle ───┴── chiffres du moteur ───────┘
 *                                                       │
 *                                                       ▼
 *                              coût d'acquisition, rythme de croissance
 *
 * Sans le troisième, le moteur devait INVENTER le coût d'acquisition et le
 * rythme de croissance : les deux paramètres qui décident à eux seuls de la
 * date d'équilibre. Un projet qui a écrit sa stratégie de communication a
 * pourtant déjà répondu — canaux, cadence, budget — et cette réponse ne
 * voyageait pas jusqu'au moteur.
 *
 * Dans l'autre sens, la stratégie de communication EXIGE les deux premiers :
 * une façon de communiquer qui ne connaît ni l'offre réelle ni les moyens
 * disponibles n'est pas une stratégie, c'est un exercice de style. D'où les
 * deux usages de ce module, par le même comptage :
 *   · Simulation  → prévient (les trois, aucune bloquante)
 *   · Stratégie   → refuse   (business plan et finance, bloquantes)
 *
 * MODULE PUR, sans accès base : il ne lit que `analysisResultModel`, ce qui le
 * rend utilisable par les services comme par les scripts de contrôle.
 */

import type { AnalysisResultModel } from '../../models/analysisResult.model';
import type { CommunicationModel } from '../../models/communication.model';
import type { FinanceModel } from '../../models/finance.model';
import type { ProjectModel } from '../../models/project.model';
import { hasSectionContent, listDocuments } from './deliverable-documents';

/** Les trois entrées, dans l'ordre où un projet les produit. */
export const PROJECT_INPUT_KEYS = ['businessPlan', 'finance', 'communication'] as const;

export type ProjectInputKey = (typeof PROJECT_INPUT_KEYS)[number];

/** Ce que la stratégie de communication exige avant d'être écrite. */
export const STRATEGY_REQUIRED_INPUTS: readonly ProjectInputKey[] = ['businessPlan', 'finance'];

/** Vrai par entrée présente. Renseigné pour les trois, toujours. */
export type ProjectInputsState = Record<ProjectInputKey, boolean>;

export interface ProjectInputsAssessment {
  inputs: ProjectInputsState;
  /** Les entrées absentes, dans l'ordre de `PROJECT_INPUT_KEYS`. */
  missing: ProjectInputKey[];
}

/**
 * Refus opposé à une génération qui manque d'une entrée exigée.
 *
 * Porte la liste : l'interface doit pouvoir nommer ce qui manque et y conduire,
 * ce qu'un message d'erreur seul ne permet pas.
 */
export class MissingProjectInputsError extends Error {
  readonly missing: readonly ProjectInputKey[];

  constructor(missing: readonly ProjectInputKey[], message: string) {
    super(message);
    this.name = 'MissingProjectInputsError';
    this.missing = missing;
  }
}

type AnalysisLike = Partial<AnalysisResultModel> | null | undefined;

/**
 * Vrai quand au moins une section du business plan porte du contenu.
 *
 * La seule présence d'un document ne suffit pas : choisir son sommaire crée un
 * document vide, qui n'apprend rien à personne. C'est le contenu qui compte.
 */
function hasBusinessPlan(analysis: AnalysisLike): boolean {
  return listDocuments(analysis, 'businessPlan').some((document) =>
    (document.sections ?? []).some((section) => hasSectionContent(section)),
  );
}

/**
 * Vrai quand les prévisions financières portent une offre chiffrée.
 *
 * `analysisResultModel.finance` ne peut pas se juger par sa simple présence :
 * ouvrir le module en écrit un, garni de ses valeurs d'usine (barèmes d'impôt,
 * durées d'amortissement, paramètres de ratios). Ce qui distingue un modèle
 * renseigné, c'est qu'il porte des produits ET des objectifs de vente : sans
 * les deux, aucun chiffre d'affaires n'est projeté.
 */
function hasFinance(analysis: AnalysisLike): boolean {
  const finance = analysis?.finance as FinanceModel | undefined;
  if (!finance) return false;
  const products = Array.isArray(finance.products) ? finance.products : [];
  const objectives = Array.isArray(finance.salesObjectives) ? finance.salesObjectives : [];
  return products.length > 0 && objectives.length > 0;
}

/**
 * Vrai quand la stratégie de communication dit quelque chose.
 *
 * On ne retient QUE la stratégie — pas les visuels ni les périodes. Un projet
 * peut avoir produit dix visuels depuis l'atelier sans avoir jamais défini sa
 * façon de communiquer : ce sont ces canaux, ce ton et cette cadence qui
 * informent le coût d'acquisition, pas les images.
 */
function hasCommunicationStrategy(analysis: AnalysisLike): boolean {
  const strategy = (analysis?.communication as CommunicationModel | undefined)?.strategy;
  if (!strategy) return false;
  const summary = (strategy.summary ?? '').trim();
  const blocks = (strategy.blocks ?? []).filter((block) => (block?.body ?? '').trim().length > 0);
  return summary.length > 0 || blocks.length > 0;
}

/** État des trois entrées d'un projet. Aucun appel réseau, aucun modèle. */
export function assessProjectInputs(
  project: Pick<ProjectModel, 'analysisResultModel'> | null | undefined,
): ProjectInputsAssessment {
  const analysis = (project?.analysisResultModel ?? null) as AnalysisLike;
  const inputs: ProjectInputsState = {
    businessPlan: hasBusinessPlan(analysis),
    finance: hasFinance(analysis),
    communication: hasCommunicationStrategy(analysis),
  };
  return { inputs, missing: PROJECT_INPUT_KEYS.filter((key) => !inputs[key]) };
}

/** Celles des entrées exigées qui manquent, dans l'ordre déclaré. */
export function missingAmong(
  inputs: ProjectInputsState,
  required: readonly ProjectInputKey[],
): ProjectInputKey[] {
  return PROJECT_INPUT_KEYS.filter((key) => required.includes(key) && !inputs[key]);
}
