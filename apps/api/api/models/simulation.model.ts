/**
 * Modèle IDEM Simulation — mettre un projet à l'épreuve avant de le lancer.
 *
 * Le principe directeur du module: on ne vend jamais une prédiction. Chaque
 * valeur transporte sa provenance et son niveau de confiance, chaque score est
 * accompagné de son incertitude, et le verdict explique toujours son motif.
 *
 * Pipeline:
 *   PROJET → COMPRÉHENSION → DÉCOUVERTE DES FACTEURS → RECHERCHE
 *          → MODÈLE → SIMULATION → ANALYSE → RAPPORT → RE-SIMULATION
 *
 * Les données sont stockées dans `project.analysisResultModel.simulations`
 * afin de réutiliser l'infrastructure existante (auth, ownership, schemas).
 */

// =====================================================================
// CONSTANTES
// =====================================================================

/** Horizon de projection mensuel par défaut d'une simulation. */
export const SIMULATION_HORIZON_MONTHS = 36;

/** Horizon long utilisé par la Time Machine. */
export const SIMULATION_TIMELINE_YEARS = 5;

/** Nombre de profils clients synthétiques générés par défaut. */
export const CUSTOMER_PANEL_SIZE = 10_000;

// =====================================================================
// PROVENANCE ET CONFIANCE
// =====================================================================

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Nature d'une valeur utilisée par le moteur.
 *  - `data`       : chiffre observé et sourcé.
 *  - `estimate`   : dérivé de données comparables.
 *  - `assumption` : choix assumé du moteur, faute de mieux.
 */
export type EvidenceKind = 'data' | 'estimate' | 'assumption';

export interface Evidence {
  id: string;
  label: string;
  /** Valeur déjà formatée pour l'affichage, unité comprise. */
  value: string;
  /** Valeur numérique quand elle existe, pour alimenter le moteur. */
  numericValue?: number;
  unit?: string;
  kind: EvidenceKind;
  confidence: ConfidenceLevel;
  source?: string;
  sourceUrl?: string;
  /** Date de la donnée sous-jacente, pas de la simulation. */
  asOf?: string;
  note?: string;
}

// =====================================================================
// 1. COMPRÉHENSION DU PROJET
// =====================================================================

/** Ce que le moteur sait, doit chercher, ignore, ou n'a pas. */
export type KnowledgeState = 'known' | 'researchable' | 'uncertain' | 'missing';

export interface KnowledgeItem {
  id: string;
  label: string;
  state: KnowledgeState;
  value?: string;
  /** Pourquoi c'est incertain, ou ce qui permettrait de trancher. */
  detail?: string;
  /** Vrai si l'utilisateur peut combler le trou lui-même avant de lancer. */
  answerable?: boolean;
  /** Réponse fournie par l'utilisateur à l'étape de préparation. */
  answer?: string;
}

export interface ProjectProfile {
  name: string;
  sector: string;
  businessModel: string;
  product: string;
  targetCustomer: string;
  market: string;
  location: string;
  country: string;
  currency: string;
  pricePoint?: string;
  plannedFunding?: string;
  teamSize?: string;
}

/**
 * Paramètres numériques extraits du projet. C'est le seul endroit d'où le
 * moteur déterministe tire ses chiffres: tout le reste est du texte.
 */
export interface BusinessBaseline {
  /** Prix moyen encaissé par transaction. */
  unitPrice: number;
  /** Coût variable par transaction. */
  unitVariableCost: number;
  /** Charges fixes mensuelles. */
  monthlyFixedCosts: number;
  /** Coût d'acquisition d'un client. */
  acquisitionCost: number;
  /** Nouveaux clients acquis le premier mois. */
  initialMonthlyCustomers: number;
  /** Croissance mensuelle des acquisitions, en fraction (0.1 = +10 %). */
  monthlyGrowthRate: number;
  /** Part des clients encore actifs d'un mois sur l'autre (0..1). */
  monthlyRetentionRate: number;
  /** Transactions par client actif et par mois. */
  purchasesPerCustomerPerMonth: number;
  /** Capital disponible au démarrage. */
  startingCapital: number;
  currency: string;
}

/** Types de projet reconnus par IDEM, repris tels quels par la création. */
export const IDEM_PROJECT_TYPES = [
  'web',
  'mobile',
  'iot',
  'desktop',
  'enterprise',
  'ecommerce',
  'api',
  'ai',
  'blockchain',
  'landing',
  'other',
] as const;

export type IdemProjectType = (typeof IDEM_PROJECT_TYPES)[number];

/**
 * De quoi créer le projet IDEM que décrit un business plan importé.
 *
 * Le profil sert à simuler ; cette graine sert à peupler la fiche projet, qui
 * n'a pas les mêmes champs. Elle est produite par la même lecture du document,
 * donc sans appel supplémentaire au modèle.
 */
export interface ImportedProjectSeed {
  type: IdemProjectType;
  /** Description courte, telle qu'elle apparaîtra sur la fiche projet. */
  description: string;
  /** Périmètre : ce que le projet couvre, et ce qu'il ne couvre pas. */
  scope?: string;
  /** À qui le projet s'adresse. */
  targets?: string;
  /** Contraintes explicites du document : réglementaires, techniques, de délai. */
  constraints: string[];
  /** Budget annoncé, sous la forme trouvée dans le document. */
  budgetIntervals?: string;
  teamSize?: string;
  city?: string;
  country?: string;
}

export interface ProjectUnderstanding {
  profile: ProjectProfile;
  baseline: BusinessBaseline;
  items: KnowledgeItem[];
  /** Résumé en langage naturel de la lecture faite du projet. */
  narrative?: string;
  /**
   * Renseignée pour un business plan importé : le projet IDEM n'existe pas
   * encore, il sera créé à partir de là.
   */
  projectSeed?: ImportedProjectSeed;
}

// =====================================================================
// 2. MOTEUR DE DÉCOUVERTE DES FACTEURS
// =====================================================================

/**
 * Classement d'un facteur. `unknown` est un niveau à part entière: un facteur
 * que le moteur n'a pas su cerner est une information, pas quelque chose à
 * masquer.
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
  /** Regroupement utilisé dans le rapport: Marché, Coûts, Réglementation… */
  category: string;
  tier: FactorTier;
  /** Influence relative sur le résultat simulé, 0-100. */
  impact: number;
  description: string;
  /** Levier actionné, qui rend le facteur simulable et pas seulement narratif. */
  lever: FactorLever;
  /**
   * Sensibilité du levier à ce facteur. Une variation de 100 % du facteur
   * déplace le levier de `leverElasticity` × sa valeur de référence.
   */
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

// =====================================================================
// 3. SCÉNARIOS ET STRESS TESTS
// =====================================================================

/**
 * Les scénarios ne se limitent pas à optimiste/réaliste/pessimiste: le moteur
 * combine des décalages de facteurs, ce qui produit aussi bien une baisse
 * ordinaire qu'un stress test délibéré ou un choc composé rare.
 */
export type ScenarioKind = 'baseline' | 'favourable' | 'adverse' | 'stress' | 'extreme';

/** Un décalage appliqué à un levier du modèle. */
export interface ScenarioShift {
  factorId: string;
  label: string;
  lever: FactorLever;
  /** Variation relative appliquée au levier (-0.3 = -30 %). */
  magnitude: number;
  /** Formulation lisible, ex. « -30 % ». */
  delta: string;
}

export interface Scenario {
  id: string;
  name: string;
  kind: ScenarioKind;
  question: string;
  shifts: ScenarioShift[];
  /** Rempli par le moteur. */
  outcome?: ScenarioOutcome;
}

export interface ScenarioOutcome {
  /** Viabilité simulée dans ce scénario, 0-100. */
  viability: number;
  /** Mois du point mort, ou null s'il n'est jamais atteint. */
  breakEvenMonth: number | null;
  /** Mois avant épuisement de la trésorerie, ou null si jamais. */
  runwayMonths: number | null;
  /** Vrai si le modèle tient encore debout dans ce scénario. */
  survives: boolean;
  /** Trésorerie au plus bas sur l'horizon. */
  lowestCash: number;
  revenueYear1: number;
  revenueYear3: number;
  narrative: string;
}

// =====================================================================
// 4. RÉSULTATS FINANCIERS SIMULÉS
// =====================================================================

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

// =====================================================================
// 5. SENSIBILITÉ ET CONDITIONS DE VIABILITÉ
// =====================================================================

/**
 * Répond à « qu'est-ce qui change réellement le destin de l'entreprise ».
 * Chaque entrée isole un levier, tout le reste étant maintenu constant.
 */
export interface SensitivityEntry {
  factorId: string;
  factorName: string;
  lever: FactorLever;
  /** Le mouvement testé, ex. « +10 % de rétention ». */
  change: string;
  /** Points de viabilité gagnés ou perdus. */
  viabilityDelta: number;
}

/** Un seuil que le modèle doit franchir pour que les scénarios tiennent. */
export interface ViabilityCondition {
  id: string;
  label: string;
  /** Seuil formaté, comparateur et unité compris. */
  threshold: string;
  currentValue?: string;
  met: boolean | null;
}

// =====================================================================
// 6. VERDICT
// =====================================================================

/**
 * Le verdict porte sur le modèle dans les scénarios testés, pas sur l'avenir
 * de l'entreprise. L'interface l'affiche toujours à côté de cette réserve.
 */
export type Verdict = 'go' | 'go-with-conditions' | 'no-go';

/** Tenue du modèle à travers les scénarios, indépendamment de son score. */
export type Robustness = 'low' | 'medium' | 'high';

export interface Risk {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'moderate';
  description: string;
}

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  expectedImpact: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: ConfidenceLevel;
}

// =====================================================================
// 7. LABORATOIRES — analyses complémentaires
// =====================================================================

/** Red Team: une équipe d'agents dont le seul but est de faire échouer le projet. */
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
  generatedAt: Date;
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    important: number;
    secondary: number;
  };
  verdict: string;
}

/** Customer Simulator: des milliers de profils clients synthétiques. */
export interface CustomerSegment {
  id: string;
  name: string;
  /** Part du panel, en fraction. */
  share: number;
  budget: string;
  needs: string;
  /** Élasticité au prix: 1 = très sensible, 0 = indifférent. */
  priceSensitivity: number;
  /** Prix au-delà duquel le segment décroche, en monnaie du projet. */
  willingnessToPay: number;
  purchaseFrequencyPerYear: number;
}

export interface PricePoint {
  price: number;
  /** Part du panel qui achèterait à ce prix. */
  conversionRate: number;
  buyers: number;
  estimatedRevenue: number;
}

export interface CustomerSimulation {
  generatedAt: Date;
  panelSize: number;
  currency: string;
  segments: CustomerSegment[];
  pricePoints: PricePoint[];
  /** Prix qui maximise le revenu simulé sur le panel. */
  optimalPrice: number;
  caveat: string;
}

/** Investor Simulator: le projet passé devant plusieurs profils d'investisseurs. */
export type InvestorProfile = 'growth' | 'impact' | 'technology' | 'regional';

export interface InvestorVerdict {
  profile: InvestorProfile;
  name: string;
  /** 0-100, lisibilité du projet pour ce profil. */
  score: number;
  reaction: string;
  objections: string[];
  wouldMeetAgain: boolean;
}

export interface InvestorReadiness {
  generatedAt: Date;
  /** Moyenne pondérée des profils, 0-100. */
  readinessScore: number;
  verdicts: InvestorVerdict[];
  /** Les objections les plus probables, tous profils confondus. */
  expectedObjections: string[];
}

/** Black Swan: des événements rares mais plausibles, propres au secteur. */
export interface BlackSwanEvent {
  id: string;
  title: string;
  description: string;
  /** Estimation grossière, assumée comme telle. */
  likelihood: 'rare' | 'unlikely' | 'plausible';
  shifts: ScenarioShift[];
  outcome?: ScenarioOutcome;
  survivalNarrative: string;
}

export interface BlackSwanReport {
  generatedAt: Date;
  events: BlackSwanEvent[];
  /** Part des chocs auxquels le modèle survit. */
  absorptionRate: number;
}

/** Univers parallèles: le même projet, sous d'autres modèles économiques. */
export interface BusinessUniverse {
  id: string;
  name: string;
  /** Le modèle testé: B2B, marketplace, abonnement, API… */
  businessModel: string;
  rationale: string;
  /** Les paramètres qui changent par rapport au projet d'origine. */
  baselineOverrides: Partial<BusinessBaseline>;
  outcome?: ScenarioOutcome;
  /** Robustesse à travers les mêmes scénarios que l'univers d'origine. */
  robustness?: Robustness;
}

export interface UniverseComparison {
  generatedAt: Date;
  universes: BusinessUniverse[];
  /** Identifiant de l'univers le plus robuste dans les scénarios testés. */
  bestUniverseId: string | null;
  narrative: string;
}

/** Time Machine: le projet mois après mois, sur plusieurs années. */
export interface TimelineYear {
  year: number;
  revenue: number;
  costs: number;
  cash: number;
  activeCustomers: number;
  /** Événement marquant de l'année, s'il y en a un. */
  event?: string;
}

export interface Timeline {
  id: string;
  name: string;
  kind: ScenarioKind;
  years: TimelineYear[];
  /** Ce qui distingue cette trajectoire des autres. */
  divergence: string;
  /** Année à partir de laquelle cette trajectoire s'écarte de la référence. */
  divergenceYear: number | null;
  endState: string;
}

export interface TimeMachineReport {
  generatedAt: Date;
  horizonYears: number;
  timelines: Timeline[];
}

/** Experiment Engine: quelle expérience réelle réduit le plus l'incertitude. */
export interface Experiment {
  id: string;
  hypothesis: string;
  /** Sondage, landing page, précommande, prototype, campagne… */
  method: string;
  /** Ce que l'expérience permet de trancher. */
  signal: string;
  cost: 'low' | 'medium' | 'high';
  durationDays: number;
  /** Points d'incertitude retirés si l'expérience est concluante. */
  uncertaintyReduction: number;
  priority: number;
}

export interface ExperimentPlan {
  generatedAt: Date;
  experiments: Experiment[];
  /** L'expérience à mener en premier, et pourquoi. */
  recommendedExperimentId: string | null;
  rationale: string;
}

// =====================================================================
// 8. RÉSULTAT ET RAPPORT
// =====================================================================

/**
 * Ce que l'exécution achète: de quoi juger le modèle, pas de quoi le réparer.
 * Le raisonnement derrière ces chiffres, c'est le rapport qui l'apporte.
 */
export interface SimulationResult {
  viabilityIndex: number;
  robustness: Robustness;
  confidence: ConfidenceLevel;
  verdict: Verdict;
  verdictRationale: string;
  factorSummary: FactorSummary;
  /** Les quelques facteurs qui déplacent le plus le résultat. */
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

export interface SimulationReport {
  simulationId: string;
  generatedAt: Date;
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
  /** Hypothèses et valeurs sourcées sur lesquelles repose tout le rapport. */
  evidence: Evidence[];
  /** Ce qu'il reste à confronter au marché réel. */
  validationNeeded: string[];
}

// =====================================================================
// 9. L'ENTITÉ SIMULATION
// =====================================================================

export type SimulationOrigin = 'idem-project' | 'imported-document';

/** `pack` regroupe l'exécution et le rapport, c'est l'offre mise en avant. */
export type SimulationTier = 'run' | 'report' | 'pack';

export type SimulationStatus =
  | 'draft'
  | 'awaiting-confirmation'
  | 'running'
  | 'completed'
  | 'failed';

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
  /** Ligne courte décrivant ce que l'étape a produit. */
  note?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SimulationProgress {
  percent: number;
  stages: PipelineStage[];
}

/** Analyses complémentaires, exécutées à la demande après la simulation. */
export interface SimulationLabs {
  redTeam?: RedTeamReport;
  customers?: CustomerSimulation;
  investors?: InvestorReadiness;
  blackSwan?: BlackSwanReport;
  universes?: UniverseComparison;
  timeMachine?: TimeMachineReport;
  experiments?: ExperimentPlan;
}

export interface SimulationModel {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  origin: SimulationOrigin;
  projectName?: string;
  /** Renseigné quand la simulation part d'un business plan importé. */
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
  /** Vrai une fois le rapport complet acheté. */
  hasReport: boolean;
  /** Exécution dont celle-ci est issue, après modification du projet. */
  previousRunId?: string;
  /** 1 pour une première exécution, incrémenté à chaque re-simulation. */
  revision: number;
  /** Message d'erreur quand `status` vaut `failed`. */
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/** Vue allégée d'une simulation, pour les listes. */
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
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================================
// 10. TARIFICATION
// =====================================================================

/**
 * La simulation est facturée à part du reste d'IDEM: elle mobilise des
 * recherches externes, plusieurs agents et des calculs. Le prix est affiché
 * et confirmé avant tout lancement.
 */
export interface SimulationPlan {
  tier: SimulationTier;
  price: number;
  /** Prix non remisé, présent seulement lorsqu'une remise s'applique. */
  listPrice?: number;
  currency: string;
  /** Clés de traduction de la liste, résolues côté client. */
  includes: string[];
  recommended: boolean;
}

export interface SimulationPricing {
  /** Vrai quand la simulation part d'un projet IDEM, moins coûteux à analyser. */
  idemProjectDiscount: boolean;
  plans: SimulationPlan[];
}

// =====================================================================
// FABRIQUES
// =====================================================================

export const DEFAULT_BASELINE: BusinessBaseline = {
  unitPrice: 0,
  unitVariableCost: 0,
  monthlyFixedCosts: 0,
  acquisitionCost: 0,
  initialMonthlyCustomers: 0,
  monthlyGrowthRate: 0.08,
  monthlyRetentionRate: 0.75,
  purchasesPerCustomerPerMonth: 1,
  startingCapital: 0,
  currency: 'XAF',
};

export function createPipeline(): SimulationProgress {
  const stages: PipelineStageId[] = [
    'understand',
    'discover-factors',
    'research',
    'model',
    'simulate',
    'analyse',
  ];
  return {
    percent: 0,
    stages: stages.map((id) => ({ id, state: 'pending' as StageState })),
  };
}

export function createSimulation(params: {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  origin: SimulationOrigin;
  tier: SimulationTier;
  projectName?: string;
  documentName?: string;
  previousRunId?: string;
  revision?: number;
}): SimulationModel {
  const now = new Date();
  return {
    id: params.id,
    projectId: params.projectId,
    userId: params.userId,
    name: params.name,
    origin: params.origin,
    projectName: params.projectName,
    documentName: params.documentName,
    tier: params.tier,
    status: 'running',
    progress: createPipeline(),
    factors: [],
    evidence: [],
    labs: {},
    hasReport: params.tier !== 'run',
    previousRunId: params.previousRunId,
    revision: params.revision ?? 1,
    createdAt: now,
    updatedAt: now,
  };
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

export function toSimulationSummary(simulation: SimulationModel): SimulationSummary {
  return {
    id: simulation.id,
    projectId: simulation.projectId,
    name: simulation.name,
    origin: simulation.origin,
    projectName: simulation.projectName,
    documentName: simulation.documentName,
    status: simulation.status,
    tier: simulation.tier,
    hasReport: simulation.hasReport,
    revision: simulation.revision,
    viabilityIndex: simulation.result?.viabilityIndex,
    verdict: simulation.result?.verdict,
    createdAt: simulation.createdAt,
    updatedAt: simulation.updatedAt,
  };
}
