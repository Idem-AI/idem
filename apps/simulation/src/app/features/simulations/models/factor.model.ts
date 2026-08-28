import { Evidence } from './evidence.model';

/**
 * How much a factor can move the outcome.
 *
 * `unknown` is a first-class tier on purpose: a factor the engine could not
 * pin down is information, not something to hide.
 */
export type FactorTier = 'critical' | 'important' | 'secondary' | 'unknown';

export interface Factor {
  id: string;
  name: string;
  /** Grouping used in the report, e.g. "Marché", "Coûts", "Réglementation". */
  category: string;
  tier: FactorTier;
  /** Relative influence on the simulated outcome, 0-100. */
  impact: number;
  description: string;
  evidence?: Evidence;
}

export interface FactorSummary {
  total: number;
  critical: number;
  important: number;
  secondary: number;
  unknown: number;
}

export function summariseFactors(factors: readonly Factor[]): FactorSummary {
  const summary: FactorSummary = {
    total: factors.length,
    critical: 0,
    important: 0,
    secondary: 0,
    unknown: 0,
  };
  for (const factor of factors) {
    summary[factor.tier] += 1;
  }
  return summary;
}
