import { ConfidenceLevel, Evidence } from './evidence.model';
import { Factor } from './factor.model';
import { ProjectProfile } from './project.model';
import { Scenario } from './scenario.model';
import { Robustness, Verdict } from './simulation.model';

/** One row of the simulated financial trajectory. */
export interface FinancialPoint {
  /** Month index from launch, 1-based. */
  month: number;
  revenue: number;
  costs: number;
  cashflow: number;
  /** Cumulative cash, which is what runway is read from. */
  cash: number;
}

export interface FinancialSummary {
  currency: string;
  monthlyBurnRate: number;
  breakEvenMonth: number | null;
  capitalRequired: number;
  runwayMonths: number | null;
  grossMargin: number;
  points: FinancialPoint[];
}

/**
 * Answers "what actually changes the outcome": the delta in viability for a
 * given move on a single factor, holding everything else steady.
 */
export interface SensitivityEntry {
  factorId: string;
  factorName: string;
  /** The move being tested, e.g. "+10 % de rétention". */
  change: string;
  /** Points of viability index gained or lost. */
  viabilityDelta: number;
}

/** A threshold the model has to clear for the scenarios to hold. */
export interface ViabilityCondition {
  id: string;
  label: string;
  /** Formatted threshold including comparator and unit, e.g. "< 4 500 FCFA". */
  threshold: string;
  currentValue?: string;
  met: boolean | null;
}

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  expectedImpact: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: ConfidenceLevel;
}

export interface SimulationReport {
  simulationId: string;
  generatedAt: string;
  executiveSummary: {
    viabilityIndex: number;
    robustness: Robustness;
    confidence: ConfidenceLevel;
    verdict: Verdict;
    statement: string;
  };
  profile: ProjectProfile;
  factors: Factor[];
  scenarios: Scenario[];
  financials: FinancialSummary;
  sensitivity: SensitivityEntry[];
  conditions: ViabilityCondition[];
  recommendations: Recommendation[];
  /** Assumptions and sourced values the whole report rests on. */
  evidence: Evidence[];
  /** What still has to be checked against the real market. */
  validationNeeded: string[];
}
