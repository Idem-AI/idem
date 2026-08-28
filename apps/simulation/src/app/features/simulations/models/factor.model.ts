import { Evidence } from './evidence.model';

/**
 * `unknown` est un niveau à part entière : un facteur que le moteur n'a pas su
 * cerner est une information, pas quelque chose à masquer.
 */
export type FactorTier = 'critical' | 'important' | 'secondary' | 'unknown';

/** Le levier du modèle sur lequel un facteur agit. */
export type FactorLever =
  | 'price'
  | 'variableCost'
  | 'fixedCost'
  | 'acquisitionCost'
  | 'growth'
  | 'retention'
  | 'frequency'
  | 'capital'
  | 'none';

export interface Factor {
  id: string;
  name: string;
  category: string;
  tier: FactorTier;
  /** Influence relative sur le résultat simulé, 0-100. */
  impact: number;
  description: string;
  lever: FactorLever;
  leverElasticity?: number;
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
