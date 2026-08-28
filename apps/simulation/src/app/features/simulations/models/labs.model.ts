/**
 * Analyses complémentaires, exécutées à la demande après une simulation.
 * Miroir de la section « laboratoires » du modèle serveur.
 */

import { BusinessBaseline } from './project.model';
import { Robustness } from './simulation.model';
import { Scenario, ScenarioKind, ScenarioOutcome, ScenarioShift } from './scenario.model';

// ---------------------------------------------------------------------
// Red Team — attaquer son propre business
// ---------------------------------------------------------------------

export type RedTeamRole =
  | 'competitor'
  | 'skeptical-customer'
  | 'investor'
  | 'regulator'
  | 'cfo'
  | 'operations';

export interface Vulnerability {
  id: string;
  title: string;
  role: RedTeamRole;
  severity: 'critical' | 'important' | 'secondary';
  /** L'attaque, formulée du point de vue de l'agent. */
  attack: string;
  /** Ce qui, dans le projet, rend l'attaque possible. */
  exposure: string;
  mitigation: string;
}

export interface RedTeamReport {
  generatedAt: string;
  vulnerabilities: Vulnerability[];
  summary: { total: number; critical: number; important: number; secondary: number };
  verdict: string;
}

// ---------------------------------------------------------------------
// Customer Simulator — un panel de clients synthétiques
// ---------------------------------------------------------------------

export interface CustomerSegment {
  id: string;
  name: string;
  /** Part du panel, en fraction. */
  share: number;
  budget: string;
  needs: string;
  /** 1 = très sensible au prix, 0 = indifférent. */
  priceSensitivity: number;
  willingnessToPay: number;
  purchaseFrequencyPerYear: number;
}

export interface PricePoint {
  price: number;
  conversionRate: number;
  buyers: number;
  estimatedRevenue: number;
}

export interface CustomerSimulation {
  generatedAt: string;
  panelSize: number;
  currency: string;
  segments: CustomerSegment[];
  pricePoints: PricePoint[];
  optimalPrice: number;
  caveat: string;
}

// ---------------------------------------------------------------------
// Investor Simulator
// ---------------------------------------------------------------------

export type InvestorProfile = 'growth' | 'impact' | 'technology' | 'regional';

export interface InvestorVerdict {
  profile: InvestorProfile;
  name: string;
  score: number;
  reaction: string;
  objections: string[];
  wouldMeetAgain: boolean;
}

export interface InvestorReadiness {
  generatedAt: string;
  readinessScore: number;
  verdicts: InvestorVerdict[];
  expectedObjections: string[];
}

// ---------------------------------------------------------------------
// Black Swan
// ---------------------------------------------------------------------

export interface BlackSwanEvent {
  id: string;
  title: string;
  description: string;
  likelihood: 'rare' | 'unlikely' | 'plausible';
  shifts: ScenarioShift[];
  outcome?: ScenarioOutcome;
  survivalNarrative: string;
}

export interface BlackSwanReport {
  generatedAt: string;
  events: BlackSwanEvent[];
  /** Part des chocs auxquels le modèle survit. */
  absorptionRate: number;
}

// ---------------------------------------------------------------------
// Univers parallèles
// ---------------------------------------------------------------------

export interface BusinessUniverse {
  id: string;
  name: string;
  businessModel: string;
  rationale: string;
  baselineOverrides: Partial<BusinessBaseline>;
  outcome?: ScenarioOutcome;
  robustness?: Robustness;
}

export interface UniverseComparison {
  generatedAt: string;
  universes: BusinessUniverse[];
  bestUniverseId: string | null;
  narrative: string;
}

// ---------------------------------------------------------------------
// Time Machine
// ---------------------------------------------------------------------

export interface TimelineYear {
  year: number;
  revenue: number;
  costs: number;
  cash: number;
  activeCustomers: number;
  event?: string;
}

export interface Timeline {
  id: string;
  name: string;
  kind: ScenarioKind;
  years: TimelineYear[];
  divergence: string;
  divergenceYear: number | null;
  endState: string;
}

export interface TimeMachineReport {
  generatedAt: string;
  horizonYears: number;
  timelines: Timeline[];
}

// ---------------------------------------------------------------------
// Experiment Engine
// ---------------------------------------------------------------------

export interface Experiment {
  id: string;
  hypothesis: string;
  method: string;
  /** Ce que le résultat permettrait de trancher. */
  signal: string;
  cost: 'low' | 'medium' | 'high';
  durationDays: number;
  /** Points d'incertitude retirés si l'expérience est concluante. */
  uncertaintyReduction: number;
  priority: number;
}

export interface ExperimentPlan {
  generatedAt: string;
  experiments: Experiment[];
  recommendedExperimentId: string | null;
  rationale: string;
}

// ---------------------------------------------------------------------

export interface SimulationLabs {
  redTeam?: RedTeamReport;
  customers?: CustomerSimulation;
  investors?: InvestorReadiness;
  blackSwan?: BlackSwanReport;
  universes?: UniverseComparison;
  timeMachine?: TimeMachineReport;
  experiments?: ExperimentPlan;
}

/** Identifiants acceptés par `POST …/labs/:lab`. */
export type LabName = keyof SimulationLabs;

export const LAB_NAMES: readonly LabName[] = [
  'redTeam',
  'customers',
  'investors',
  'blackSwan',
  'universes',
  'timeMachine',
  'experiments',
] as const;

/** Scénario reconstruit à partir d'un cygne noir, pour réutiliser l'affichage. */
export function blackSwanToScenario(event: BlackSwanEvent): Scenario {
  return {
    id: event.id,
    name: event.title,
    kind: 'extreme',
    question: event.description,
    shifts: event.shifts,
    outcome: event.outcome,
  };
}
