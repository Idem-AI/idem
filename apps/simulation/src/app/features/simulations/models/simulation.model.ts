import { ConfidenceLevel, Evidence } from './evidence.model';
import { Factor, FactorSummary } from './factor.model';
import { SimulationLabs } from './labs.model';
import { ProjectUnderstanding } from './project.model';
import { FinancialSummary, SensitivityEntry, SimulationReport, ViabilityCondition } from './report.model';
import { Scenario } from './scenario.model';

export type SimulationOrigin = 'idem-project' | 'imported-document';

/** `pack` regroupe l'exécution et le rapport : c'est l'offre mise en avant. */
export type SimulationTier = 'run' | 'report' | 'pack';

export type SimulationStatus =
  | 'draft'
  | 'awaiting-confirmation'
  | 'running'
  | 'completed'
  | 'failed';

/**
 * Le verdict porte sur le modèle dans les scénarios testés, jamais sur l'avenir
 * de l'entreprise. L'interface l'affiche toujours à côté de cette réserve.
 */
export type Verdict = 'go' | 'go-with-conditions' | 'no-go';

/** Tenue du modèle à travers les scénarios, indépendamment de son score. */
export type Robustness = 'low' | 'medium' | 'high';

export type PipelineStageId =
  | 'understand'
  | 'discover-factors'
  | 'research'
  | 'model'
  | 'simulate'
  | 'analyse';

export type StageState = 'pending' | 'active' | 'done' | 'failed';

export interface PipelineStage {
  id: PipelineStageId;
  state: StageState;
  note?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SimulationProgress {
  percent: number;
  stages: PipelineStage[];
}

export interface Risk {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'moderate';
  description: string;
}

export interface SimulationResult {
  viabilityIndex: number;
  robustness: Robustness;
  confidence: ConfidenceLevel;
  verdict: Verdict;
  verdictRationale: string;
  factorSummary: FactorSummary;
  criticalFactors: Factor[];
  scenarios: Scenario[];
  risks: Risk[];
  strengths: string[];
  weaknesses: string[];
  keyUncertainties: string[];
  financials: FinancialSummary;
  sensitivity: SensitivityEntry[];
  conditions: ViabilityCondition[];
}

export interface Simulation {
  id: string;
  projectId: string;
  userId?: string;
  name: string;
  origin: SimulationOrigin;
  projectName?: string;
  documentName?: string;
  tier: SimulationTier;
  status: SimulationStatus;
  progress: SimulationProgress;
  understanding?: ProjectUnderstanding;
  factors: Factor[];
  evidence: Evidence[];
  result?: SimulationResult;
  report?: SimulationReport;
  labs: SimulationLabs;
  hasReport: boolean;
  /** Exécution dont celle-ci est issue, après modification du projet. */
  previousRunId?: string;
  revision: number;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/** Vue allégée, pour les listes. */
export interface SimulationSummary {
  id: string;
  projectId: string;
  name: string;
  origin: SimulationOrigin;
  projectName?: string;
  documentName?: string;
  status: SimulationStatus;
  tier: SimulationTier;
  hasReport: boolean;
  revision: number;
  viabilityIndex?: number;
  verdict?: Verdict;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSimulationInput {
  name: string;
  origin: SimulationOrigin;
  projectId: string;
  documentName?: string;
  tier: SimulationTier;
  /** Réponses données aux trous signalés par l'analyse préalable. */
  answers?: Record<string, string>;
  previousRunId?: string;
}
