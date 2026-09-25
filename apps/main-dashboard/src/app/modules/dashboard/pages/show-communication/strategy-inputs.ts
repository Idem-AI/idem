/**
 * CE QUE LA STRATÉGIE DE COMMUNICATION EXIGE — business plan et prévisions.
 *
 * Miroir de `services/common/project-inputs.ts` côté API, et comme tout miroir
 * il ne fait pas autorité : l'API refuse la génération de toute façon. Ce qu'il
 * apporte est le MOMENT — nommer les livrables manquants avant le clic, plutôt
 * qu'après un aller-retour et un message d'erreur.
 *
 * Les deux mêmes règles de présence sont reposées ici, pour la même raison
 * qu'elles ne sont pas de simples tests de vérité :
 *   · un business plan existe dès qu'on choisit son sommaire, et un sommaire
 *     vide n'apprend rien à personne — c'est le CONTENU qui compte ;
 *   · `finance` s'écrit à la première ouverture du module, garni de ses valeurs
 *     d'usine (barèmes d'impôt, durées d'amortissement) ; ce qui distingue un
 *     modèle renseigné, c'est qu'il porte des produits ET des objectifs de
 *     vente, sans quoi aucun chiffre d'affaires n'est projeté.
 *
 * Aucune dépendance Angular : fonctions pures sur le projet déjà chargé.
 */
import { ProjectModel } from '@idem/shared-models';

import { STRATEGY_INPUT_KEYS, StrategyInputKey } from '../../models/communication.model';

/** Où l'on produit chaque livrable, dans le tableau de bord. */
export const STRATEGY_INPUT_ROUTES: Record<StrategyInputKey, string> = {
  businessPlan: '/project/business-plan',
  finance: '/project/finance',
};

interface StoredSection {
  summary?: string;
  data?: unknown;
}

interface StoredPlan {
  sections?: StoredSection[];
}

const hasContent = (section: StoredSection | undefined): boolean =>
  !!section &&
  (typeof section.data === 'string' ? section.data.trim().length > 0 : section.data != null);

/**
 * Business plans du projet, ancien emplacement unique compris.
 *
 * Les projets créés avant que les livrables ne passent en collections gardent
 * leur document sous `businessPlan` ; les ignorer ferait réclamer un plan à qui
 * en a déjà un.
 */
function businessPlans(analysis: Record<string, unknown>): StoredPlan[] {
  const collection = analysis['businessPlans'];
  if (Array.isArray(collection)) return collection as StoredPlan[];
  const legacy = analysis['businessPlan'] as StoredPlan | undefined;
  return legacy ? [legacy] : [];
}

function hasBusinessPlan(analysis: Record<string, unknown>): boolean {
  return businessPlans(analysis).some((plan) => (plan.sections ?? []).some(hasContent));
}

function hasFinance(analysis: Record<string, unknown>): boolean {
  const finance = analysis['finance'] as
    | { products?: unknown[]; salesObjectives?: unknown[] }
    | undefined;
  if (!finance) return false;
  return (
    (finance.products?.length ?? 0) > 0 && (finance.salesObjectives?.length ?? 0) > 0
  );
}

/**
 * Les livrables exigés que ce projet ne porte pas encore, dans l'ordre de
 * production : le business plan nourrit les prévisions. Tableau vide = tout est
 * là, la stratégie peut s'écrire.
 */
export function missingStrategyInputs(
  project: ProjectModel | null | undefined,
): StrategyInputKey[] {
  const analysis = (project?.analysisResultModel ?? {}) as Record<string, unknown>;
  const present: Record<StrategyInputKey, boolean> = {
    businessPlan: hasBusinessPlan(analysis),
    finance: hasFinance(analysis),
  };
  return STRATEGY_INPUT_KEYS.filter((key) => !present[key]);
}
