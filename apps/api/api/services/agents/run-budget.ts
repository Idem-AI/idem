/**
 * Budget de consommation d'un run (une génération de business plan, un deck…).
 *
 * Module volontairement PUR — pas de client modèle, pas de base, pas de cache —
 * pour deux raisons: il est partagé par tous les agents d'un run, et il doit
 * rester vérifiable sans démarrer l'infrastructure.
 *
 * Le budget rend le coût d'un livrable PRÉVISIBLE, ce qui est la condition pour
 * l'adosser au module de crédits: un run ne peut plus dériver silencieusement
 * parce qu'une boucle d'outils s'est emballée ou qu'une réparation en a
 * déclenché une autre.
 *
 * La mesure est une ESTIMATION (≈ 4 caractères/token): elle sert de
 * coupe-circuit, jamais de base de facturation — celle-ci reste
 * `aiUsageService`, alimenté par les compteurs réels du fournisseur.
 */

import logger from '../../config/logger';
import { logAIEvent } from '../../utils/ai-trace.util';

/** Estimation grossière et volontairement stable: 4 caractères ≈ 1 token. */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

export class RunBudget {
  private consumed = 0;
  private stopped = false;

  constructor(
    readonly label: string,
    readonly maxTokens: number
  ) {}

  get used(): number {
    return this.consumed;
  }

  get remaining(): number {
    return Math.max(0, this.maxTokens - this.consumed);
  }

  get exhausted(): boolean {
    return this.stopped || this.consumed >= this.maxTokens;
  }

  consume(tokens: number): void {
    this.consumed += tokens;
    if (this.consumed >= this.maxTokens && !this.stopped) {
      this.stopped = true;
      logger.warn(
        `RunBudget "${this.label}" épuisé: ${this.consumed}/${this.maxTokens} tokens estimés`
      );
      logAIEvent('agent.budget_exhausted', {
        label: this.label,
        consumed: this.consumed,
        maxTokens: this.maxTokens,
      });
    }
  }
}

export function createRunBudget(label: string, maxTokens: number): RunBudget {
  return new RunBudget(label, maxTokens);
}

export class BudgetExhaustedError extends Error {
  constructor(label: string) {
    super(`Budget du run "${label}" épuisé — génération interrompue.`);
    this.name = 'BudgetExhaustedError';
  }
}
