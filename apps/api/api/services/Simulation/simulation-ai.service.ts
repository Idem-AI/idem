/**
 * Couche IA du module Simulation.
 *
 * Elle décide *quoi* simuler : quels facteurs comptent pour ce projet-là, de
 * combien ils peuvent bouger, ce que les chiffres veulent dire. Le calcul
 * lui-même vit dans `simulation-engine.service.ts` et n'appelle jamais de LLM.
 *
 * Tous les retours sont normalisés avant de sortir d'ici : un modèle qui
 * renvoie une rétention à 1.4 ou un tier inconnu ne doit pas pouvoir
 * corrompre le moteur en aval.
 */

import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { AI_CONFIG } from '../../config/ai.config';
import logger from '../../config/logger';
import { cacheService } from '../cache.service';
import { UnusableDocumentError, prepareDocument } from './document-intake';
import { ProjectModel } from '../../models/project.model';
import {
  BlackSwanEvent,
  BusinessBaseline,
  ConfidenceLevel,
  CustomerSegment,
  DEFAULT_BASELINE,
  DocumentFact,
  Evidence,
  EvidenceKind,
  Experiment,
  Factor,
  FactorLever,
  IDEM_PROJECT_TYPES,
  ImportedProjectSeed,
  FactorTier,
  InvestorProfile,
  InvestorVerdict,
  KNOWLEDGE_SOURCES,
  KnowledgeItem,
  KnowledgeSource,
  KnowledgeState,
  ProjectProfile,
  ProjectUnderstanding,
  Recommendation,
  RedTeamRole,
  Risk,
  Scenario,
  ScenarioKind,
  ScenarioShift,
  BusinessUniverse,
  Vulnerability,
} from '../../models/simulation.model';
import { AIChatMessage, PromptConfig, PromptService } from '../prompt.service';
import {
  ANALYSIS_PROMPT,
  BLACK_SWAN_PROMPT,
  CUSTOMER_SIMULATION_PROMPT,
  DOCUMENT_EXTRACTION_PROMPT,
  EXPERIMENTS_PROMPT,
  FACTOR_DISCOVERY_PROMPT,
  INVESTOR_SIMULATION_PROMPT,
  PROJECT_UNDERSTANDING_PROMPT,
  RECOMMENDATIONS_PROMPT,
  RED_TEAM_PROMPT,
  SCENARIO_DESIGN_PROMPT,
  UNIVERSES_PROMPT,
  SIMULATION_SYSTEM_PROMPT,
} from './prompts/simulation.prompt';

// =====================================================================
// TYPES DE SORTIE
// =====================================================================

export interface AnalysisNarrative {
  verdictRationale: string;
  strengths: string[];
  weaknesses: string[];
  keyUncertainties: string[];
  risks: Risk[];
}

export interface RecommendationOutput {
  recommendations: Recommendation[];
  validationNeeded: string[];
  executiveStatement: string;
}

export interface CustomerPanelOutput {
  segments: CustomerSegment[];
  testPrices: number[];
  caveat: string;
}

export interface InvestorOutput {
  verdicts: InvestorVerdict[];
  expectedObjections: string[];
}

export interface UniverseOutput {
  universes: BusinessUniverse[];
  narrative: string;
}

export interface ExperimentOutput {
  experiments: Experiment[];
  recommendedExperimentId: string | null;
  rationale: string;
}

// =====================================================================
// VALEURS AUTORISÉES
// =====================================================================

const FACTOR_TIERS: FactorTier[] = ['critical', 'important', 'secondary', 'unknown'];
const FACTOR_LEVERS: FactorLever[] = [
  'price',
  'variableCost',
  'fixedCost',
  'acquisitionCost',
  'growth',
  'retention',
  'frequency',
  'capital',
  'none',
];
const SCENARIO_KINDS: ScenarioKind[] = ['baseline', 'favourable', 'adverse', 'stress', 'extreme'];
const KNOWLEDGE_STATES: KnowledgeState[] = ['known', 'researchable', 'uncertain', 'missing'];
const EVIDENCE_KINDS: EvidenceKind[] = ['data', 'estimate', 'assumption'];
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['low', 'medium', 'high'];
const RED_TEAM_ROLES: RedTeamRole[] = [
  'competitor',
  'skeptical-customer',
  'investor',
  'regulator',
  'cfo',
  'operations',
];
const INVESTOR_PROFILES: InvestorProfile[] = ['growth', 'impact', 'technology', 'regional'];

// =====================================================================
// MISE EN CACHE DES LECTURES
// =====================================================================

/**
 * Version du schéma de compréhension.
 *
 * Les lectures sont mises en cache sur l'empreinte de la source, pas sur celle
 * du prompt : sans ce numéro, un document analysé avant l'ajout d'un champ
 * continuerait à ressortir du cache amputé de ce champ, pendant sept jours,
 * sans qu'aucune trace n'explique pourquoi. Toute évolution de la forme
 * attendue incrémente ce nombre.
 */
const UNDERSTANDING_SCHEMA_VERSION = 3;

/** Ce que la lecture peut recevoir sans dépasser ce que le contexte supporte. */
const MAX_EXTRAS = 8;
const MAX_EXTRA_LABEL_CHARS = 60;
const MAX_EXTRA_VALUE_CHARS = 180;

/** Une lecture reste valable une semaine : au-delà, le projet a vécu. */
const PROJECT_UNDERSTANDING_TTL_SECONDS = 86_400 * 7;

export class SimulationAIService {
  constructor(private readonly promptService: PromptService) {
    logger.info('SimulationAIService initialized.');
  }

  // ===================================================================
  // 1. COMPRÉHENSION DU PROJET
  // ===================================================================

  /**
   * Lit un projet IDEM.
   *
   * Le résultat est mis en cache sur l'empreinte de ce qui part réellement au
   * modèle : revenir sur l'écran d'analyse, ou relancer une simulation sur un
   * projet inchangé, ne redépense rien. La clé bouge dès que le projet bouge,
   * puisqu'elle est calculée sur le texte envoyé et non sur l'identifiant.
   */
  async understandProject(project: ProjectModel, userId: string): Promise<ProjectUnderstanding> {
    const context = this.describeProject(project);
    const cacheKey = `simulation:project:v${UNDERSTANDING_SCHEMA_VERSION}:${digestOf(context)}`;
    const cached = await cacheService.get<ProjectUnderstanding>(cacheKey, {
      prefix: 'ai',
      ttl: PROJECT_UNDERSTANDING_TTL_SECONDS,
    });
    if (cached) {
      logger.info(`Project understanding served from cache for "${project.name}"`);
      return cached;
    }

    const raw = await this.run('understanding', PROJECT_UNDERSTANDING_PROMPT, context, userId);
    const understanding = this.normalizeUnderstanding(this.parseJSON(raw), project.name, 'project');
    await cacheService.set(cacheKey, understanding, {
      prefix: 'ai',
      ttl: PROJECT_UNDERSTANDING_TTL_SECONDS,
    });
    return understanding;
  }

  /** Même sortie, à partir d'un business plan importé au lieu d'un projet IDEM. */
  /**
   * Lit un business plan importé.
   *
   * Le document ne part jamais entier au modèle : `prepareDocument` le refuse
   * s'il n'a rien d'un business plan — sans dépenser un seul jeton — puis n'en
   * garde que les passages porteurs d'information. Le résultat est mis en
   * cache sur l'empreinte du document : réimporter le même fichier ne coûte
   * plus rien.
   */
  async understandDocument(
    documentText: string,
    documentName: string,
    userId: string
  ): Promise<ProjectUnderstanding> {
    const brief = prepareDocument(documentText, documentName);
    logger.info(
      `Document intake for "${documentName}": ${brief.originalChars} → ${brief.briefChars} chars ` +
        `(${Math.round((1 - brief.briefChars / brief.originalChars) * 100)}% économisés), ` +
        `familles: ${brief.families.join(', ')}`
    );

    const cacheKey = `simulation:document:v${UNDERSTANDING_SCHEMA_VERSION}:${brief.digest}`;
    const cached = await cacheService.get<ProjectUnderstanding>(cacheKey, {
      prefix: 'ai',
      ttl: PROJECT_UNDERSTANDING_TTL_SECONDS,
    });
    if (cached) {
      logger.info(`Document understanding served from cache for "${documentName}"`);
      return cached;
    }

    const raw = await this.run(
      'understanding',
      DOCUMENT_EXTRACTION_PROMPT,
      `NOM DU DOCUMENT: ${documentName}\n\n--- EXTRAIT DU DOCUMENT ---\n${brief.text}`,
      userId
    );

    const parsed = this.parseJSON(raw);
    const assessment = parsed.documentAssessment as
      | { isBusinessPlan?: boolean; documentKind?: string; reason?: string }
      | undefined;

    // Les comptages laissent passer un document bien écrit mais hors sujet :
    // simuler dessus produirait un rapport crédible et faux.
    if (assessment && assessment.isBusinessPlan === false) {
      const kind = assessment.documentKind ? ` (${assessment.documentKind})` : '';
      throw new UnusableDocumentError(
        `« ${documentName} » ne ressemble pas à un business plan${kind}. ${
          assessment.reason ?? "Il n'y décrit ni activité, ni offre, ni clientèle."
        }`
      );
    }

    const understanding = this.normalizeUnderstanding(parsed, documentName, 'document');
    logger.info(
      `Document "${documentName}" read: ${understanding.items.length} éléments ` +
        `(${understanding.items.filter((item) => item.state === 'known').length} lus dans le document), ` +
        `${understanding.extras?.length ?? 0} informations hors fiche IDEM`
    );
    await cacheService.set(cacheKey, understanding, {
      prefix: 'ai',
      ttl: PROJECT_UNDERSTANDING_TTL_SECONDS,
    });
    return understanding;
  }

  /**
   * Remet en forme une compréhension qui revient du client.
   *
   * L'écran d'analyse renvoie au lancement la lecture que l'utilisateur a
   * validée, ce qui évite de la refaire. Mais elle a fait l'aller-retour par
   * le navigateur : elle repasse donc par les mêmes bornes que la sortie du
   * modèle, faute de quoi une valeur arbitraire arriverait directement dans le
   * moteur, qui divise et met en puissance ce qu'on lui donne.
   */
  sanitizeUnderstanding(
    raw: ProjectUnderstanding,
    fallbackName: string,
    origin: Extract<KnowledgeSource, 'document' | 'project'>
  ): ProjectUnderstanding {
    return this.normalizeUnderstanding(raw, fallbackName, origin);
  }

  // ===================================================================
  // 2. DÉCOUVERTE DES FACTEURS
  // ===================================================================

  async discoverFactors(
    understanding: ProjectUnderstanding,
    userId: string
  ): Promise<Factor[]> {
    const raw = await this.run(
      'factors',
      FACTOR_DISCOVERY_PROMPT,
      this.describeUnderstanding(understanding),
      userId
    );
    const parsed = this.parseJSON(raw);
    const factors: Factor[] = toArray(parsed.factors).map((entry, index) =>
      this.normalizeFactor(entry, index)
    );

    if (factors.length === 0) {
      throw new Error('Factor discovery returned no usable factor.');
    }
    return factors;
  }

  // ===================================================================
  // 3. CONCEPTION DES SCÉNARIOS
  // ===================================================================

  async designScenarios(
    understanding: ProjectUnderstanding,
    factors: readonly Factor[],
    userId: string
  ): Promise<Scenario[]> {
    const raw = await this.run(
      'scenarios',
      SCENARIO_DESIGN_PROMPT,
      `${this.describeUnderstanding(understanding)}\n\n${this.describeFactors(factors)}`,
      userId
    );
    const parsed = this.parseJSON(raw);
    const scenarios = toArray(parsed.scenarios).map((entry, index) =>
      this.normalizeScenario(entry, index)
    );

    // Un scénario de référence est indispensable : tout le reste s'y compare.
    if (!scenarios.some((scenario) => scenario.kind === 'baseline')) {
      scenarios.unshift({
        id: 's-baseline',
        name: 'Scénario de référence',
        kind: 'baseline',
        question: 'Les hypothèses centrales du projet se vérifient.',
        shifts: [],
      });
    }
    return scenarios;
  }

  // ===================================================================
  // 4. ANALYSE ET RECOMMANDATIONS
  // ===================================================================

  async analyse(
    understanding: ProjectUnderstanding,
    factors: readonly Factor[],
    scenarios: readonly Scenario[],
    userId: string
  ): Promise<AnalysisNarrative> {
    const raw = await this.run(
      'analysis',
      ANALYSIS_PROMPT,
      `${this.describeUnderstanding(understanding)}\n\n${this.describeFactors(factors)}\n\n${this.describeScenarioResults(scenarios)}`,
      userId
    );
    const parsed = this.parseJSON(raw);

    return {
      verdictRationale: str(parsed.verdictRationale),
      strengths: toStringArray(parsed.strengths),
      weaknesses: toStringArray(parsed.weaknesses),
      keyUncertainties: toStringArray(parsed.keyUncertainties),
      risks: toArray(parsed.risks).map((entry, index) => ({
        id: str(entry.id) || `risk-${index + 1}`,
        title: str(entry.title),
        severity: pick(entry.severity, ['critical', 'high', 'moderate'] as const, 'moderate'),
        description: str(entry.description),
      })),
    };
  }

  async recommend(
    understanding: ProjectUnderstanding,
    factors: readonly Factor[],
    scenarios: readonly Scenario[],
    sensitivitySummary: string,
    userId: string
  ): Promise<RecommendationOutput> {
    const raw = await this.run(
      'recommendations',
      RECOMMENDATIONS_PROMPT,
      `${this.describeUnderstanding(understanding)}\n\n${this.describeFactors(factors)}\n\n${this.describeScenarioResults(scenarios)}\n\nANALYSE DE SENSIBILITÉ:\n${sensitivitySummary}`,
      userId
    );
    const parsed = this.parseJSON(raw);

    return {
      recommendations: toArray(parsed.recommendations).map((entry, index) => ({
        id: str(entry.id) || `rec-${index + 1}`,
        title: str(entry.title),
        body: str(entry.body),
        expectedImpact: pick(entry.expectedImpact, ['low', 'medium', 'high'] as const, 'medium'),
        priority: pick(entry.priority, ['low', 'medium', 'high', 'critical'] as const, 'medium'),
        confidence: pick(entry.confidence, CONFIDENCE_LEVELS, 'medium'),
      })),
      validationNeeded: toStringArray(parsed.validationNeeded),
      executiveStatement: str(parsed.executiveStatement),
    };
  }

  // ===================================================================
  // 5. LABORATOIRES
  // ===================================================================

  async runRedTeam(
    understanding: ProjectUnderstanding,
    factors: readonly Factor[],
    userId: string
  ): Promise<{ vulnerabilities: Vulnerability[]; verdict: string }> {
    const raw = await this.run(
      'redTeam',
      RED_TEAM_PROMPT,
      `${this.describeUnderstanding(understanding)}\n\n${this.describeFactors(factors)}`,
      userId
    );
    const parsed = this.parseJSON(raw);

    return {
      vulnerabilities: toArray(parsed.vulnerabilities).map((entry, index) => ({
        id: str(entry.id) || `vuln-${index + 1}`,
        title: str(entry.title),
        role: pick(entry.role, RED_TEAM_ROLES, 'competitor'),
        severity: pick(entry.severity, ['critical', 'important', 'secondary'] as const, 'secondary'),
        attack: str(entry.attack),
        exposure: str(entry.exposure),
        mitigation: str(entry.mitigation),
      })),
      verdict: str(parsed.verdict),
    };
  }

  async simulateCustomers(
    understanding: ProjectUnderstanding,
    userId: string
  ): Promise<CustomerPanelOutput> {
    const raw = await this.run(
      'customers',
      CUSTOMER_SIMULATION_PROMPT,
      this.describeUnderstanding(understanding),
      userId
    );
    const parsed = this.parseJSON(raw);

    const segments: CustomerSegment[] = toArray(parsed.segments).map((entry, index) => ({
      id: str(entry.id) || `seg-${index + 1}`,
      name: str(entry.name),
      share: clamp(num(entry.share, 0), 0, 1),
      budget: str(entry.budget),
      needs: str(entry.needs),
      priceSensitivity: clamp(num(entry.priceSensitivity, 0.5), 0, 1),
      willingnessToPay: Math.max(0, num(entry.willingnessToPay, 0)),
      purchaseFrequencyPerYear: Math.max(0, num(entry.purchaseFrequencyPerYear, 1)),
    }));

    return {
      segments: normalizeShares(segments),
      testPrices: toArray(parsed.testPrices)
        .map((value) => num(value, 0))
        .filter((value) => value > 0)
        .sort((a, b) => a - b),
      caveat: str(parsed.caveat),
    };
  }

  async simulateInvestors(
    understanding: ProjectUnderstanding,
    scenarios: readonly Scenario[],
    userId: string
  ): Promise<InvestorOutput> {
    const raw = await this.run(
      'investors',
      INVESTOR_SIMULATION_PROMPT,
      `${this.describeUnderstanding(understanding)}\n\n${this.describeScenarioResults(scenarios)}`,
      userId
    );
    const parsed = this.parseJSON(raw);

    return {
      verdicts: toArray(parsed.verdicts).map((entry) => ({
        profile: pick(entry.profile, INVESTOR_PROFILES, 'growth'),
        name: str(entry.name),
        score: Math.round(clamp(num(entry.score, 50), 0, 100)),
        reaction: str(entry.reaction),
        objections: toStringArray(entry.objections),
        wouldMeetAgain: Boolean(entry.wouldMeetAgain),
      })),
      expectedObjections: toStringArray(parsed.expectedObjections),
    };
  }

  async generateBlackSwans(
    understanding: ProjectUnderstanding,
    factors: readonly Factor[],
    userId: string
  ): Promise<BlackSwanEvent[]> {
    const raw = await this.run(
      'blackSwan',
      BLACK_SWAN_PROMPT,
      `${this.describeUnderstanding(understanding)}\n\n${this.describeFactors(factors)}`,
      userId
    );
    const parsed = this.parseJSON(raw);

    return toArray(parsed.events).map((entry, index) => ({
      id: str(entry.id) || `bs-${index + 1}`,
      title: str(entry.title),
      description: str(entry.description),
      likelihood: pick(entry.likelihood, ['rare', 'unlikely', 'plausible'] as const, 'unlikely'),
      shifts: toArray(entry.shifts).map((shift) => this.normalizeShift(shift)),
      survivalNarrative: str(entry.survivalNarrative),
    }));
  }

  async generateUniverses(
    understanding: ProjectUnderstanding,
    userId: string
  ): Promise<UniverseOutput> {
    const raw = await this.run(
      'universes',
      UNIVERSES_PROMPT,
      this.describeUnderstanding(understanding),
      userId
    );
    const parsed = this.parseJSON(raw);

    return {
      universes: toArray(parsed.universes).map((entry, index) => ({
        id: str(entry.id) || `u-${index + 1}`,
        name: str(entry.name),
        businessModel: str(entry.businessModel),
        rationale: str(entry.rationale),
        baselineOverrides: this.normalizeOverrides(entry.baselineOverrides),
      })),
      narrative: str(parsed.narrative),
    };
  }

  async planExperiments(
    understanding: ProjectUnderstanding,
    uncertainties: readonly string[],
    factors: readonly Factor[],
    userId: string
  ): Promise<ExperimentOutput> {
    const raw = await this.run(
      'experiments',
      EXPERIMENTS_PROMPT,
      `${this.describeUnderstanding(understanding)}\n\nINCERTITUDES:\n${uncertainties.map((u) => `- ${u}`).join('\n')}\n\n${this.describeFactors(factors.filter((f) => f.tier === 'critical'))}`,
      userId
    );
    const parsed = this.parseJSON(raw);

    const experiments: Experiment[] = toArray(parsed.experiments).map((entry, index) => ({
      id: str(entry.id) || `x-${index + 1}`,
      hypothesis: str(entry.hypothesis),
      method: str(entry.method),
      signal: str(entry.signal),
      cost: pick(entry.cost, ['low', 'medium', 'high'] as const, 'medium'),
      durationDays: Math.max(1, Math.round(num(entry.durationDays, 14))),
      uncertaintyReduction: Math.round(clamp(num(entry.uncertaintyReduction, 0), 0, 100)),
      priority: Math.max(1, Math.round(num(entry.priority, index + 1))),
    }));

    const recommended = str(parsed.recommendedExperimentId);
    return {
      experiments: experiments.sort((a, b) => a.priority - b.priority),
      recommendedExperimentId:
        experiments.find((x) => x.id === recommended)?.id ?? experiments[0]?.id ?? null,
      rationale: str(parsed.rationale),
    };
  }

  // ===================================================================
  // APPEL LLM
  // ===================================================================

  private async run(
    step: keyof typeof AI_CONFIG.simulation,
    instruction: string,
    context: string,
    userId: string
  ): Promise<string> {
    const config = AI_CONFIG.simulation[step] ?? AI_CONFIG.simulation.default;
    const promptConfig: PromptConfig = {
      provider: config.provider,
      modelName: config.modelName,
      promptType: config.promptType,
      llmOptions: config.llmOptions,
      userId,
    };

    const messages: AIChatMessage[] = [
      { role: 'system', content: SIMULATION_SYSTEM_PROMPT },
      { role: 'user', content: `${context}\n\n--- INSTRUCTION ---\n${instruction}` },
    ];

    logger.info(`SimulationAI.${String(step)} — calling ${config.modelName}`);
    return this.promptService.runPrompt(promptConfig, messages);
  }

  // ===================================================================
  // CONTEXTE ENVOYÉ AU MODÈLE
  // ===================================================================

  private describeProject(project: ProjectModel): string {
    const analysis = (project as any).analysisResultModel ?? {};
    // On n'envoie que les livrables utiles à une simulation, et tronqués :
    // un projet IDEM complet dépasse largement la fenêtre de contexte.
    //
    // De l'identité de marque, seul le nom sert ici. Retomber sur l'objet
    // entier revenait à envoyer un SVG de logo — quatre mille caractères de
    // chemins vectoriels qui ne disent rien d'une viabilité.
    const deliverables = {
      businessPlan: truncate(analysis.businessPlan),
      finance: truncate(analysis.finance),
      branding: truncate(analysis.branding?.brandName, 120),
      marketAnalysis: truncate(analysis.marketAnalysis),
    };

    return `PROJET IDEM
Nom: ${project.name}
Description: ${project.longDescription || project.description}
Type: ${project.type}
Périmètre: ${project.scope}
Cibles: ${project.targets}
Contraintes: ${(project.constraints || []).join(', ')}
Taille d'équipe: ${project.teamSize}
Budget: ${project.budgetIntervals ?? 'non précisé'}
Pays: ${project.additionalInfos?.country ?? 'non précisé'}
Ville: ${project.additionalInfos?.city ?? 'non précisée'}

LIVRABLES DISPONIBLES:
${JSON.stringify(deliverables, null, 2)}`;
  }

  /**
   * Le contexte commun à toutes les étapes qui suivent la lecture.
   *
   * Il part dans chaque appel du pipeline et de chaque laboratoire : ce qu'on
   * y écrit est donc payé une dizaine de fois par exécution. D'où les paires
   * `clé: valeur` plutôt qu'un JSON indenté — mêmes informations, accolades et
   * indentation en moins — et les champs vides écartés au lieu d'être envoyés
   * comme chaînes vides.
   */
  private describeUnderstanding(understanding: ProjectUnderstanding): string {
    const blocks = [
      `PROFIL DU PROJET:\n${compactEntries(understanding.profile)}`,
      `PARAMÈTRES DU MODÈLE:\n${compactEntries(understanding.baseline)}`,
      `ÉTAT DES CONNAISSANCES:\n${understanding.items
        .map(
          (item) =>
            `- [${item.state}] ${item.label}${item.value ? `: ${item.value}` : ''}${
              item.answer ? ` (réponse fournie: ${item.answer})` : ''
            }`
        )
        .join('\n')}`,
    ];

    // Ce que le document dit et qu'aucun champ ci-dessus ne porte. Sans ce
    // bloc, un contrat déjà signé ou une saisonnalité disparaissaient entre la
    // lecture et la simulation.
    if (understanding.extras?.length) {
      blocks.push(
        `PARTICULARITÉS DE CE PROJET (à prendre en compte, elles ne rentrent dans aucun champ standard):\n${understanding.extras
          .map((fact) => `- ${fact.label}: ${fact.value}`)
          .join('\n')}`
      );
    }

    return blocks.join('\n\n');
  }

  private describeFactors(factors: readonly Factor[]): string {
    return `FACTEURS IDENTIFIÉS (${factors.length}):
${factors
  .map(
    (factor) =>
      `- [${factor.tier}, impact ${factor.impact}, levier ${factor.lever}] ${factor.id} — ${factor.name} (${factor.category})`
  )
  .join('\n')}`;
  }

  private describeScenarioResults(scenarios: readonly Scenario[]): string {
    return `RÉSULTATS DES SCÉNARIOS:
${scenarios
  .map((scenario) => {
    const outcome = scenario.outcome;
    if (!outcome) return `- ${scenario.name} (${scenario.kind}) — non calculé`;
    return `- ${scenario.name} (${scenario.kind}) — viabilité ${outcome.viability}/100, point mort ${
      outcome.breakEvenMonth ?? 'jamais'
    }, trésorerie épuisée ${outcome.runwayMonths ? `au mois ${outcome.runwayMonths}` : 'jamais'}, tient: ${
      outcome.survives ? 'oui' : 'non'
    }`;
  })
  .join('\n')}`;
  }

  // ===================================================================
  // NORMALISATION
  // ===================================================================

  /**
   * @param defaultSource Provenance des éléments que le modèle n'a pas
   * qualifiés : `document` pour un business plan importé, `project` pour un
   * projet IDEM. C'est ce qui permet ensuite de n'afficher, sous « ce que le
   * moteur sait », que ce qui vient réellement de la source.
   */
  private normalizeUnderstanding(
    parsed: any,
    fallbackName: string,
    defaultSource: Extract<KnowledgeSource, 'document' | 'project'>
  ): ProjectUnderstanding {
    const profileRaw = parsed.profile ?? {};
    const profile: ProjectProfile = {
      name: str(profileRaw.name) || fallbackName,
      sector: str(profileRaw.sector),
      businessModel: str(profileRaw.businessModel),
      product: str(profileRaw.product),
      targetCustomer: str(profileRaw.targetCustomer),
      market: str(profileRaw.market),
      location: str(profileRaw.location),
      country: str(profileRaw.country),
      currency: str(profileRaw.currency) || 'XAF',
      pricePoint: str(profileRaw.pricePoint) || undefined,
      plannedFunding: str(profileRaw.plannedFunding) || undefined,
      teamSize: str(profileRaw.teamSize) || undefined,
    };

    const items: KnowledgeItem[] = toArray(parsed.items).map((entry, index) =>
      this.normalizeKnowledgeItem(entry, index, defaultSource)
    );

    return {
      profile,
      baseline: this.normalizeBaseline(parsed.baseline, profile.currency),
      items,
      narrative: str(parsed.narrative) || undefined,
      extras: this.normalizeExtras(parsed.extras, profile),
      // Un projet IDEM existe déjà : rien à en semer.
      projectSeed:
        defaultSource === 'document'
          ? this.normalizeProjectSeed(parsed.projectSeed, profile)
          : undefined,
    };
  }

  /**
   * Un élément de connaissance, avec sa provenance rendue cohérente.
   *
   * Deux règles y sont appliquées, parce qu'un prompt ne suffit pas à les
   * garantir :
   *
   *  1. `known` exige une provenance de source — le document ou le projet. Ce
   *     que le modèle a déduit redescend en `uncertain`, quelle que soit sa
   *     confiance : c'est exactement la confusion que l'écran doit éviter.
   *  2. `uncertain` et `missing` portent toujours un motif. Sans lui, l'écran
   *     retombait sur une phrase de catégorie, identique d'un projet à l'autre
   *     et donc inutile.
   */
  private normalizeKnowledgeItem(
    entry: any,
    index: number,
    defaultSource: Extract<KnowledgeSource, 'document' | 'project'>
  ): KnowledgeItem {
    let state = pick(entry.state, KNOWLEDGE_STATES, 'uncertain');
    const value = str(entry.value) || undefined;
    let source = pick(
      entry.source,
      KNOWLEDGE_SOURCES,
      state === 'known' ? defaultSource : state === 'researchable' ? 'external' : 'inferred'
    );

    // Une provenance de source n'a de sens que pour ce qui est effectivement
    // écrit : un élément à rechercher ou déduit ne peut pas en porter une.
    if (state !== 'known' && (source === 'document' || source === 'project')) {
      source = state === 'researchable' ? 'external' : 'inferred';
    }
    // Et l'inverse : « su » sans rien qui l'atteste est une estimation.
    if (state === 'known' && (source === 'inferred' || source === 'external' || !value)) {
      state = 'uncertain';
      source = 'inferred';
    }

    const detail = str(entry.detail) || undefined;
    return {
      id: str(entry.id) || `k-${index + 1}`,
      label: str(entry.label),
      state,
      source,
      value,
      detail: detail ?? fallbackDetail(state, str(entry.label)),
      answerable: Boolean(entry.answerable) || state === 'missing',
    };
  }

  /**
   * Les informations que la source donne et qu'aucun champ IDEM n'accueille.
   *
   * Elles repartent dans le contexte de toutes les étapes suivantes, donc dans
   * chaque appel : le plafond n'est pas une précaution de forme, c'est ce qui
   * empêche une liste bavarde de renchérir toute l'exécution. Ce qui répète
   * déjà le profil est écarté — le modèle le reçoit par ailleurs.
   */
  private normalizeExtras(raw: any, profile: ProjectProfile): DocumentFact[] | undefined {
    const known = new Set(
      Object.values(profile)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map((value) => value.toLowerCase())
    );

    const facts: DocumentFact[] = [];
    const seen = new Set<string>();

    for (const entry of toArray(raw)) {
      const label = str(entry?.label).slice(0, MAX_EXTRA_LABEL_CHARS);
      const value = str(entry?.value).slice(0, MAX_EXTRA_VALUE_CHARS);
      if (!label || !value) continue;

      const key = `${label.toLowerCase()}|${value.toLowerCase()}`;
      if (seen.has(key) || known.has(value.toLowerCase())) continue;

      seen.add(key);
      facts.push({ label, value });
      if (facts.length >= MAX_EXTRAS) break;
    }

    return facts.length > 0 ? facts : undefined;
  }

  /**
   * La fiche projet n'a pas les mêmes champs que le profil de simulation : le
   * modèle les remplit dans le même appel, et on retombe sur le profil pour ce
   * qu'il n'a pas su donner. Un type inconnu devient `other` plutôt que de
   * faire échouer la création.
   */
  private normalizeProjectSeed(raw: any, profile: ProjectProfile): ImportedProjectSeed {
    const source = raw ?? {};
    const contact = source.contact ?? {};
    const seedContact = {
      email: str(contact.email) || undefined,
      phone: str(contact.phone) || undefined,
      address: str(contact.address) || undefined,
      zipCode: str(contact.zipCode) || undefined,
    };

    return {
      type: pick(source.type, IDEM_PROJECT_TYPES, 'other'),
      description: str(source.description) || profile.product || profile.businessModel,
      longDescription: str(source.longDescription) || undefined,
      scope: str(source.scope) || profile.sector || undefined,
      targets: str(source.targets) || profile.targetCustomer || undefined,
      constraints: toArray(source.constraints)
        .map((entry: any) => str(entry))
        .filter((entry: string) => entry.length > 0)
        .slice(0, 12),
      budgetIntervals: str(source.budgetIntervals) || profile.plannedFunding || undefined,
      teamSize: str(source.teamSize) || profile.teamSize || undefined,
      city: str(source.city) || profile.location || undefined,
      country: str(source.country) || profile.country || undefined,
      currency: str(source.currency) || profile.currency || undefined,
      // Un objet de coordonnées entièrement vide ne vaut pas mieux qu'absent.
      contact: Object.values(seedContact).some(Boolean) ? seedContact : undefined,
      teamMembers: toArray(source.teamMembers)
        .map((entry: any) => ({
          name: str(entry?.name),
          role: str(entry?.role),
          bio: str(entry?.bio) || undefined,
        }))
        .filter((member) => member.name.length > 0)
        .slice(0, 12),
    };
  }

  /**
   * Le moteur divise par ces valeurs et les élève en puissance : une valeur
   * aberrante ne fait pas planter le calcul, elle le rend faux en silence.
   * D'où le bornage systématique.
   */
  private normalizeBaseline(raw: any, currency: string): BusinessBaseline {
    const source = raw ?? {};
    return {
      unitPrice: Math.max(0, num(source.unitPrice, DEFAULT_BASELINE.unitPrice)),
      unitVariableCost: Math.max(0, num(source.unitVariableCost, DEFAULT_BASELINE.unitVariableCost)),
      monthlyFixedCosts: Math.max(0, num(source.monthlyFixedCosts, DEFAULT_BASELINE.monthlyFixedCosts)),
      acquisitionCost: Math.max(0, num(source.acquisitionCost, DEFAULT_BASELINE.acquisitionCost)),
      initialMonthlyCustomers: Math.max(
        0,
        num(source.initialMonthlyCustomers, DEFAULT_BASELINE.initialMonthlyCustomers)
      ),
      // Une croissance mensuelle au-delà de +100 % ferait exploser la projection.
      monthlyGrowthRate: clamp(num(source.monthlyGrowthRate, DEFAULT_BASELINE.monthlyGrowthRate), -0.9, 1),
      monthlyRetentionRate: clamp(
        num(source.monthlyRetentionRate, DEFAULT_BASELINE.monthlyRetentionRate),
        0,
        0.99
      ),
      purchasesPerCustomerPerMonth: Math.max(
        0,
        num(source.purchasesPerCustomerPerMonth, DEFAULT_BASELINE.purchasesPerCustomerPerMonth)
      ),
      startingCapital: Math.max(0, num(source.startingCapital, DEFAULT_BASELINE.startingCapital)),
      currency: str(source.currency) || currency,
    };
  }

  private normalizeFactor(entry: any, index: number): Factor {
    const tier = pick(entry.tier, FACTOR_TIERS, 'secondary');
    return {
      id: str(entry.id) || `f-${index + 1}`,
      name: str(entry.name),
      category: str(entry.category) || 'Général',
      tier,
      impact: Math.round(clamp(num(entry.impact, 50), 0, 100)),
      description: str(entry.description),
      lever: pick(entry.lever, FACTOR_LEVERS, 'none'),
      leverElasticity: clamp(num(entry.leverElasticity, 0.5), 0, 3),
      // Un facteur "unknown" ne porte pas de preuve : c'est ce qui le définit.
      evidence: tier === 'unknown' ? undefined : this.normalizeEvidence(entry.evidence, index),
    };
  }

  private normalizeEvidence(raw: any, index: number): Evidence | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const label = str(raw.label);
    const value = str(raw.value);
    if (!label && !value) return undefined;

    const kind = pick(raw.kind, EVIDENCE_KINDS, 'assumption');
    const source = str(raw.source) || undefined;

    return {
      id: str(raw.id) || `e-${index + 1}-${uuidv4().slice(0, 8)}`,
      label,
      value,
      numericValue: raw.numericValue !== undefined ? num(raw.numericValue, 0) : undefined,
      unit: str(raw.unit) || undefined,
      kind,
      // Une donnée sans source n'en est pas une : on la rétrograde plutôt que
      // de laisser passer une hypothèse habillée en fait.
      confidence: source ? pick(raw.confidence, CONFIDENCE_LEVELS, 'medium') : 'low',
      source,
      sourceUrl: str(raw.sourceUrl) || undefined,
      asOf: str(raw.asOf) || undefined,
      note: str(raw.note) || undefined,
    };
  }

  private normalizeScenario(entry: any, index: number): Scenario {
    const kind = pick(entry.kind, SCENARIO_KINDS, 'adverse');
    return {
      id: str(entry.id) || `s-${index + 1}`,
      name: str(entry.name) || `Scénario ${index + 1}`,
      kind,
      question: str(entry.question),
      shifts: kind === 'baseline' ? [] : toArray(entry.shifts).map((shift) => this.normalizeShift(shift)),
    };
  }

  private normalizeShift(raw: any): ScenarioShift {
    // Au-delà de ±90 %, un décalage ne décrit plus le même business.
    const magnitude = clamp(num(raw.magnitude, 0), -0.9, 3);
    return {
      factorId: str(raw.factorId),
      label: str(raw.label),
      lever: pick(raw.lever, FACTOR_LEVERS, 'none'),
      magnitude,
      delta: str(raw.delta) || `${magnitude >= 0 ? '+' : ''}${Math.round(magnitude * 100)} %`,
    };
  }

  private normalizeOverrides(raw: any): Partial<BusinessBaseline> {
    if (!raw || typeof raw !== 'object') return {};
    const overrides: Partial<BusinessBaseline> = {};
    const numericKeys: (keyof BusinessBaseline)[] = [
      'unitPrice',
      'unitVariableCost',
      'monthlyFixedCosts',
      'acquisitionCost',
      'initialMonthlyCustomers',
      'purchasesPerCustomerPerMonth',
      'startingCapital',
    ];

    for (const key of numericKeys) {
      if (raw[key] !== undefined) {
        (overrides as any)[key] = Math.max(0, num(raw[key], 0));
      }
    }
    if (raw.monthlyGrowthRate !== undefined) {
      overrides.monthlyGrowthRate = clamp(num(raw.monthlyGrowthRate, 0), -0.9, 1);
    }
    if (raw.monthlyRetentionRate !== undefined) {
      overrides.monthlyRetentionRate = clamp(num(raw.monthlyRetentionRate, 0.75), 0, 0.99);
    }
    return overrides;
  }

  // ===================================================================
  // PARSING
  // ===================================================================

  /**
   * Les modèles enveloppent régulièrement leur JSON dans un bloc markdown ou
   * l'accompagnent d'une phrase, malgré la consigne. On récupère le premier
   * objet équilibré plutôt que d'échouer sur du bruit.
   */
  private parseJSON(raw: string): any {
    const cleaned = raw
      .replace(/^\s*```(?:json)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const extracted = extractFirstJsonObject(cleaned);
      if (extracted) {
        try {
          return JSON.parse(extracted);
        } catch (error: any) {
          logger.error(`SimulationAI: JSON extraction failed — ${error.message}`);
        }
      }
      logger.error(`SimulationAI: unparseable model output (${cleaned.slice(0, 400)}…)`);
      throw new Error('The analysis engine returned an unreadable response.');
    }
  }
}

// =====================================================================
// UTILITAIRES
// =====================================================================

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function toArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: unknown): string[] {
  return toArray(value)
    .map((entry) => str(entry))
    .filter((entry) => entry.length > 0);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value);
}

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const candidate = str(value) as T;
  return allowed.includes(candidate) ? candidate : fallback;
}

/** Ramène la somme des parts à 1 quand le modèle a compté approximativement. */
function normalizeShares(segments: CustomerSegment[]): CustomerSegment[] {
  const total = segments.reduce((sum, segment) => sum + segment.share, 0);
  if (total <= 0) {
    const equal = segments.length > 0 ? 1 / segments.length : 0;
    return segments.map((segment) => ({ ...segment, share: equal }));
  }
  return segments.map((segment) => ({ ...segment, share: segment.share / total }));
}

/**
 * Empreinte d'un contexte, pour la clé de cache. Le hachage porte sur ce qui
 * part au modèle : un projet modifié produit un autre texte, donc une autre
 * clé, sans qu'aucune invalidation n'ait à être écrite.
 */
function digestOf(context: string): string {
  return crypto.createHash('sha256').update(context).digest('hex');
}

/**
 * Paires `clé: valeur`, une par ligne, les champs vides écartés.
 * Un JSON indenté dit la même chose pour près du double de jetons.
 */
function compactEntries(source: object): string {
  return Object.entries(source)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

/**
 * Motif de repli quand le modèle n'a pas dit pourquoi un élément lui échappe.
 *
 * Il nomme l'élément concerné plutôt que de décrire la catégorie : « le prix
 * de vente n'est pas fixé par la source » se lit, « aucune donnée fiable
 * n'existe » répété sous chaque ligne ne se lit plus.
 */
function fallbackDetail(state: KnowledgeState, label: string): string | undefined {
  const subject = label ? `« ${label} »` : 'Cet élément';
  if (state === 'uncertain') {
    return `${subject} n'est fixé nulle part dans la source : le moteur retient une estimation et la signale.`;
  }
  if (state === 'missing') {
    return `${subject} n'apparaît pas dans la source. Vous seul pouvez le renseigner.`;
  }
  return undefined;
}

function truncate(value: unknown, max = 4000): string {
  if (value === undefined || value === null) return 'non disponible';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
