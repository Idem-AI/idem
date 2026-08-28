import { Factor, FactorSummary } from './factor.model';
import { ProjectUnderstanding } from './project.model';
import { ConfidenceLevel } from './evidence.model';
import { Scenario } from './scenario.model';

/** Where the project being simulated came from. */
export type SimulationOrigin = 'idem-project' | 'imported-document';

/**
 * What the user bought. `pack` bundles the run and the full report, which is
 * the offer the pricing screen leads with.
 */
export type SimulationTier = 'run' | 'report' | 'pack';

export type SimulationStatus =
  | 'draft'
  | 'awaiting-confirmation'
  | 'running'
  | 'completed'
  | 'failed';

/**
 * The verdict is a judgement about the model under the scenarios tested, not
 * a prediction. The UI always renders it next to that caveat.
 */
export type Verdict = 'go' | 'go-with-conditions' | 'no-go';

/** How well the model held up across the scenarios, independent of its score. */
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
  /** Short, already-translated line describing what the stage produced. */
  note?: string;
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

/**
 * What the run itself buys: enough to judge the model, not enough to fix it.
 * The reasoning behind these numbers is what the report adds.
 */
export interface SimulationResult {
  viabilityIndex: number;
  robustness: Robustness;
  confidence: ConfidenceLevel;
  verdict: Verdict;
  verdictRationale: string;
  factorSummary: FactorSummary;
  /** The handful of factors that move the outcome most. */
  criticalFactors: Factor[];
  scenarios: Scenario[];
  risks: Risk[];
  strengths: string[];
  weaknesses: string[];
  keyUncertainties: string[];
}

export interface Simulation {
  id: string;
  name: string;
  origin: SimulationOrigin;
  /** Set when the simulation was started from an IDEM project. */
  projectId?: string;
  projectName?: string;
  /** Set when the simulation was started from an uploaded business plan. */
  documentName?: string;
  tier: SimulationTier;
  status: SimulationStatus;
  createdAt: string;
  updatedAt: string;
  progress: SimulationProgress;
  understanding?: ProjectUnderstanding;
  result?: SimulationResult;
  /** Whether the full report has been generated for this run. */
  hasReport: boolean;
  /** Run this one was launched from, after the project was modified. */
  previousRunId?: string;
  /** 1 for a first run, incremented on every re-simulation. */
  revision: number;
}

/** A simulation stripped down to what the list screen renders. */
export type SimulationSummary = Pick<
  Simulation,
  | 'id'
  | 'name'
  | 'origin'
  | 'projectName'
  | 'documentName'
  | 'status'
  | 'tier'
  | 'createdAt'
  | 'updatedAt'
  | 'hasReport'
  | 'revision'
> & {
  viabilityIndex?: number;
  verdict?: Verdict;
};

export interface CreateSimulationInput {
  name: string;
  origin: SimulationOrigin;
  projectId?: string;
  documentName?: string;
  tier: SimulationTier;
  /** Answers the user gave for the gaps the engine flagged. */
  answers?: Record<string, string>;
  previousRunId?: string;
}
