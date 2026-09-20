import { FactorLever } from './factor.model';

export type ScenarioKind = 'baseline' | 'favourable' | 'adverse' | 'stress' | 'extreme';

export interface ScenarioShift {
  factorId: string;
  label: string;
  lever: FactorLever;
  /** Variation relative appliquée au levier : -0.3 = -30 %. */
  magnitude: number;
  delta: string;
}

export interface ScenarioOutcome {
  viability: number;
  breakEvenMonth: number | null;
  runwayMonths: number | null;
  survives: boolean;
  lowestCash: number;
  revenueYear1: number;
  revenueYear3: number;
  narrative: string;
}

export interface Scenario {
  id: string;
  name: string;
  kind: ScenarioKind;
  question: string;
  shifts: ScenarioShift[];
  outcome?: ScenarioOutcome;
}
