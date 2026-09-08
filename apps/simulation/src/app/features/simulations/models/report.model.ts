import { ConfidenceLevel, Evidence } from './evidence.model';
import { Factor, FactorLever } from './factor.model';
import { ProjectProfile } from './project.model';
import { Scenario } from './scenario.model';
import { Robustness, Verdict } from './simulation.model';

export interface FinancialPoint {
  /** Mois depuis le lancement, à partir de 1. */
  month: number;
  activeCustomers: number;
  revenue: number;
  costs: number;
  cashflow: number;
  /** Trésorerie cumulée, d'où se lit l'autonomie. */
  cash: number;
}

export interface FinancialSummary {
  currency: string;
  monthlyBurnRate: number;
  breakEvenMonth: number | null;
  capitalRequired: number;
  runwayMonths: number | null;
  grossMargin: number;
  revenueYear1: number;
  revenueYear3: number;
  points: FinancialPoint[];
}

/**
 * Ce qu'un mouvement change réellement sur l'indice, tous les autres leviers
 * restant constants.
 */
export interface SensitivityEntry {
  factorId: string;
  factorName: string;
  lever: FactorLever;
  change: string;
  /** Points de viabilité gagnés ou perdus. */
  viabilityDelta: number;
}

/** Un seuil que le modèle doit franchir pour que les scénarios tiennent. */
export interface ViabilityCondition {
  id: string;
  label: string;
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
  /** Le problème auquel cette action répond. Absent : action générale. */
  addressesRiskId?: string;
}

/**
 * Un problème relevé par l'analyse.
 *
 * Défini ICI et non dans `simulation.model` : le rapport le porte désormais
 * lui aussi, et `simulation.model` importe déjà ce fichier — l'inverse
 * créerait un cycle.
 */
export interface Risk {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'moderate';
  description: string;
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
  /** Les problèmes, rendus avec leur réponse dans un chapitre unique. */
  risks: Risk[];
  recommendations: Recommendation[];
  evidence: Evidence[];
  /** Ce qu'il reste à confronter au marché réel. */
  validationNeeded: string[];
}
