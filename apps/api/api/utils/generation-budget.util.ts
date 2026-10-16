import logger from '../config/logger';
import { generationOverBudgetTotal } from '../config/metrics';
import type { GenerationBudget } from '../config/generation-budgets';
import { getAiUsageContext, setAiUsageContext } from './ai-usage-context.util';

/**
 * Budget de coût IA d'UNE génération, suivi pendant qu'elle s'exécute.
 *
 * Le quota compte les générations ; il ne voit pas celle qui, à l'intérieur, boucle sur des
 * réparations ou des recherches et coûte dix fois son prix. Ce budget la voit : chaque appel de
 * modèle ajoute son coût (`ai-usage.service`), et chaque nouvel appel vérifie d'abord qu'on n'a
 * pas dépassé le plafond dur (`prompt.service`).
 *
 * L'état vit dans le contexte de consommation IA de la requête (AsyncLocalStorage) : les
 * sous-contextes ouverts par `withAiUsage` le partagent par référence, donc une génération en
 * plusieurs étapes parallèles additionne bien tout ce qu'elle dépense.
 *
 * Volontairement sans import de la configuration des enveloppes à l'exécution : ce module est
 * chargé par le journal de consommation, lui-même chargé très tôt.
 */

export interface GenerationBudgetState extends GenerationBudget {
  spentUsd: number;
  /** Mode `enforce` : la génération est arrêtée au plafond dur. Sinon, signalée seulement. */
  enforce: boolean;
  softReported?: boolean;
  hardReported?: boolean;
}

export class GenerationBudgetExceededError extends Error {
  readonly code = 'generation_budget_exceeded';

  constructor(readonly budget: GenerationBudgetState) {
    super(
      'Cette génération a dépassé le coût prévu et a été arrêtée. Vos crédits ont été restitués ; réessayez avec une demande plus courte.'
    );
    this.name = 'GenerationBudgetExceededError';
  }
}

/** Ouvre le budget de la génération en cours (appelé par la facturation, une fois le prix connu). */
export function startGenerationBudget(budget: GenerationBudget | null, enforce: boolean): void {
  if (!budget) return;
  setAiUsageContext({ budget: { ...budget, spentUsd: 0, enforce } });
}

/** Ajoute le coût d'un appel au budget de la génération en cours. N'échoue jamais. */
export function addGenerationSpend(usd: number): void {
  const budget = getAiUsageContext()?.budget;
  if (!budget || !(usd > 0)) return;

  budget.spentUsd += usd;

  if (!budget.softReported && budget.spentUsd > budget.softUsd) {
    budget.softReported = true;
    report(budget, 'soft');
  }
  if (!budget.hardReported && budget.spentUsd > budget.hardUsd) {
    budget.hardReported = true;
    report(budget, 'hard');
  }
}

/**
 * Refuse un nouvel appel de modèle quand la génération a dépassé son plafond dur.
 *
 * À appeler avant chaque appel facturable. Hors génération facturée (aide gratuite sans budget,
 * tâche planifiée), ne fait rien.
 */
export function assertGenerationBudget(): void {
  const budget = getAiUsageContext()?.budget;
  if (!budget?.enforce) return;
  if (budget.spentUsd > budget.hardUsd) throw new GenerationBudgetExceededError(budget);
}

/** Coût engagé jusqu'ici par la génération en cours (rapports, tests). */
export function generationSpend(): number {
  return getAiUsageContext()?.budget?.spentUsd ?? 0;
}

function report(budget: GenerationBudgetState, threshold: 'soft' | 'hard'): void {
  try {
    generationOverBudgetTotal.inc({ action: budget.key, level: budget.level, threshold });
  } catch {
    // Les métriques ne doivent jamais faire échouer une génération.
  }
  logger.warn(`generation.over_budget: ${budget.key} (${threshold})`, {
    event: 'generation.over_budget',
    alert: threshold === 'hard' ? 'critical' : undefined,
    action: budget.key,
    level: budget.level,
    threshold,
    spentUsd: Math.round(budget.spentUsd * 10_000) / 10_000,
    softUsd: Math.round(budget.softUsd * 10_000) / 10_000,
    hardUsd: Math.round(budget.hardUsd * 10_000) / 10_000,
    enforced: budget.enforce,
  });
}
