/**
 * Service Simulation — orchestre le pipeline, la persistance et les
 * laboratoires complémentaires.
 *
 * Les simulations sont stockées dans `project.analysisResultModel.simulations`
 * afin de réutiliser l'infrastructure existante (auth, ownership, schemas),
 * exactement comme le module Finance.
 *
 * Le pipeline tourne en arrière-plan: une exécution complète enchaîne six
 * appels LLM et plusieurs milliers de projections, ce qui dépasse largement le
 * temps de vie d'une requête HTTP. Le client suit l'avancement en interrogeant
 * la simulation.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../../config/logger';
import { ProjectModel } from '../../models/project.model';
import { projectService } from '../project.service';
import {
  BlackSwanEvent,
  BlackSwanReport,
  BusinessBaseline,
  CUSTOMER_PANEL_SIZE,
  CustomerSimulation,
  Evidence,
  Experiment,
  ExperimentPlan,
  Factor,
  InvestorReadiness,
  PipelineStageId,
  PricePoint,
  ProjectUnderstanding,
  RedTeamReport,
  Scenario,
  SimulationModel,
  SimulationOrigin,
  SimulationPricing,
  SimulationReport,
  SimulationResult,
  SimulationSummary,
  SimulationTier,
  StageState,
  TimeMachineReport,
  UniverseComparison,
  createSimulation,
  summariseFactors,
  toSimulationSummary,
} from '../../models/simulation.model';
import { IRepository } from '../../repository/IRepository';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { PromptService } from '../prompt.service';
import { SimulationAIService } from './simulation-ai.service';
import {
  applyShifts,
  buildFinancialSummary,
  buildTimeline,
  computeConfidence,
  computeRobustness,
  computeSensitivity,
  computeVerdict,
  computeViability,
  computeViabilityConditions,
  projectBusiness,
  runScenario,
} from './simulation-engine.service';

export type LabName =
  | 'redTeam'
  | 'customers'
  | 'investors'
  | 'blackSwan'
  | 'universes'
  | 'timeMachine'
  | 'experiments';

export interface CreateSimulationInput {
  name?: string;
  origin: SimulationOrigin;
  tier: SimulationTier;
  documentName?: string;
  /** Réponses fournies par l'utilisateur aux trous signalés par l'analyse. */
  answers?: Record<string, string>;
  previousRunId?: string;
  /**
   * Compréhension déjà établie, pour un business plan importé : le pipeline la
   * reprend telle quelle au lieu de relire le projet. Sans cela, tout ce que
   * le document apportait serait perdu — le projet fraîchement créé ne
   * contient que son nom et sa description.
   */
  understanding?: ProjectUnderstanding;
}

export class SimulationService {
  private readonly projectRepository: IRepository<ProjectModel>;
  private readonly ai: SimulationAIService;

  constructor(promptService: PromptService) {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
    this.ai = new SimulationAIService(promptService);
    logger.info('SimulationService initialized.');
  }

  // ===================================================================
  // PERSISTANCE
  // ===================================================================

  private collectionPath(userId: string): string {
    return `users/${userId}/projects`;
  }

  private async loadProject(userId: string, projectId: string): Promise<ProjectModel> {
    const project = await this.projectRepository.findById(projectId, this.collectionPath(userId));
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return project;
  }

  private readSimulations(project: ProjectModel): SimulationModel[] {
    const stored = (project as any).analysisResultModel?.simulations;
    return Array.isArray(stored) ? (stored as SimulationModel[]) : [];
  }

  private async writeSimulations(
    userId: string,
    projectId: string,
    project: ProjectModel,
    simulations: SimulationModel[]
  ): Promise<void> {
    const analysisResultModel = {
      ...((project as any).analysisResultModel || {}),
      simulations,
    };
    const updated = await this.projectRepository.update(
      projectId,
      { analysisResultModel } as any,
      this.collectionPath(userId)
    );
    if (!updated) {
      throw new Error(`Failed to persist simulations for project ${projectId}`);
    }
  }

  /**
   * Relit le projet avant d'écrire.
   *
   * Le pipeline s'exécute en arrière-plan pendant que l'utilisateur continue à
   * modifier son projet: écrire à partir d'une copie chargée six étapes plus
   * tôt écraserait ces modifications.
   */
  private async mutate(
    userId: string,
    projectId: string,
    simulationId: string,
    mutator: (simulation: SimulationModel) => void
  ): Promise<SimulationModel> {
    const project = await this.loadProject(userId, projectId);
    const simulations = this.readSimulations(project);
    const index = simulations.findIndex((candidate) => candidate.id === simulationId);
    if (index === -1) {
      throw new Error(`Simulation not found: ${simulationId}`);
    }

    const simulation = { ...simulations[index] };
    mutator(simulation);
    simulation.updatedAt = new Date();
    simulations[index] = simulation;

    await this.writeSimulations(userId, projectId, project, simulations);
    return simulation;
  }

  // ===================================================================
  // LECTURE
  // ===================================================================

  async listSimulations(userId: string, projectId: string): Promise<SimulationSummary[]> {
    const project = await this.loadProject(userId, projectId);
    return this.readSimulations(project)
      .map(toSimulationSummary)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getSimulation(
    userId: string,
    projectId: string,
    simulationId: string
  ): Promise<SimulationModel | null> {
    const project = await this.loadProject(userId, projectId);
    return this.readSimulations(project).find((s) => s.id === simulationId) ?? null;
  }

  async deleteSimulation(
    userId: string,
    projectId: string,
    simulationId: string
  ): Promise<boolean> {
    const project = await this.loadProject(userId, projectId);
    const simulations = this.readSimulations(project);
    const remaining = simulations.filter((s) => s.id !== simulationId);
    if (remaining.length === simulations.length) return false;
    await this.writeSimulations(userId, projectId, project, remaining);
    return true;
  }

  // ===================================================================
  // PRÉ-VOL — comprendre le projet avant de facturer quoi que ce soit
  // ===================================================================

  /**
   * Lit le projet et renvoie ce que le moteur en sait, sans rien persister ni
   * facturer. C'est ce que l'utilisateur voit avant de confirmer le prix.
   */
  async analyseProject(userId: string, projectId: string): Promise<ProjectUnderstanding> {
    const project = await this.loadProject(userId, projectId);
    return this.ai.understandProject(project, userId);
  }

  /** Même chose, à partir d'un business plan importé. */
  async analyseDocument(
    userId: string,
    documentText: string,
    documentName: string
  ): Promise<ProjectUnderstanding> {
    return this.ai.understandDocument(documentText, documentName, userId);
  }

  /**
   * Seule source des tarifs de simulation : le front les affiche, il ne les
   * calcule pas. Montants en FCFA, arrondis au demi-millier — la zone d'achat
   * sans friction du marché visé se situe entre 2 500 et 10 000 F.
   */
  getPricing(origin: SimulationOrigin): SimulationPricing {
    const fromIdem = origin === 'idem-project';
    return {
      idemProjectDiscount: fromIdem,
      plans: [
        {
          tier: 'run',
          price: fromIdem ? 3000 : 4000,
          listPrice: fromIdem ? 4000 : undefined,
          currency: 'FCFA',
          includes: [
            'pricing.includes.scenarios',
            'pricing.includes.factors',
            'pricing.includes.index',
          ],
          recommended: false,
        },
        {
          tier: 'pack',
          price: fromIdem ? 6500 : 8500,
          listPrice: fromIdem ? 8500 : 10_500,
          currency: 'FCFA',
          includes: [
            'pricing.includes.scenarios',
            'pricing.includes.factors',
            'pricing.includes.index',
            'pricing.includes.report',
            'pricing.includes.recommendations',
          ],
          recommended: true,
        },
        {
          tier: 'report',
          price: fromIdem ? 4500 : 6000,
          currency: 'FCFA',
          includes: [
            'pricing.includes.report',
            'pricing.includes.sensitivity',
            'pricing.includes.recommendations',
          ],
          recommended: false,
        },
      ],
    };
  }

  // ===================================================================
  // CRÉATION ET PIPELINE
  // ===================================================================

  /**
   * Crée la simulation, la persiste à l'état `running`, puis lance le pipeline
   * sans l'attendre. La requête HTTP rend la main tout de suite.
   */
  async createSimulation(
    userId: string,
    projectId: string,
    input: CreateSimulationInput
  ): Promise<SimulationModel> {
    const project = await this.loadProject(userId, projectId);
    const simulations = this.readSimulations(project);

    const previous = input.previousRunId
      ? simulations.find((s) => s.id === input.previousRunId)
      : undefined;

    const simulation = createSimulation({
      id: `sim-${uuidv4()}`,
      projectId,
      userId,
      name: input.name || project.name,
      origin: input.origin,
      tier: input.tier,
      projectName: project.name,
      documentName: input.documentName,
      previousRunId: input.previousRunId,
      revision: previous ? previous.revision + 1 : 1,
    });

    await this.writeSimulations(userId, projectId, project, [simulation, ...simulations]);

    // Volontairement non attendu: le pipeline dure plusieurs minutes.
    void this.runPipeline(
      userId,
      projectId,
      simulation.id,
      input.answers,
      input.understanding
    ).catch((error) => {
      logger.error(`Simulation pipeline crashed for ${simulation.id}: ${error.message}`, {
        stack: error.stack,
      });
    });

    return simulation;
  }

  /**
   * Crée le projet IDEM que le business plan importé décrit, puis lance la
   * simulation dessus.
   *
   * Un plan importé ne se rattache à rien : sans cette étape, la simulation
   * s'accrochait au premier projet venu, et le rapport parlait d'un autre
   * projet que celui du document. Le projet est créé avec ce que la lecture a
   * livré — nom, description, secteur, cible — et l'utilisateur le retrouve
   * ensuite dans IDEM comme n'importe quel autre.
   */
  async createSimulationFromDocument(
    userId: string,
    input: Omit<CreateSimulationInput, 'origin' | 'previousRunId'> & {
      understanding: ProjectUnderstanding;
    }
  ): Promise<SimulationModel> {
    const profile = input.understanding.profile;
    // La graine vient de la même lecture du document : elle est taillée pour la
    // fiche projet, là où le profil l'est pour la simulation.
    const seed = input.understanding.projectSeed;
    const name = (input.name || profile.name || 'Projet importé').trim();

    const project = await projectService.createUserProject(userId, {
      name,
      description: seed?.description || profile.product || profile.businessModel || '',
      type: seed?.type ?? 'other',
      constraints: seed?.constraints ?? [],
      teamSize: seed?.teamSize || profile.teamSize || '',
      scope: seed?.scope || profile.sector || '',
      targets: seed?.targets || profile.targetCustomer || '',
      budgetIntervals: seed?.budgetIntervals || profile.plannedFunding,
      currency: profile.currency,
      selectedPhases: [],
      // Aucun livrable IDEM n'existe encore : ils seront générés par leurs
      // propres modules si l'utilisateur les demande.
      analysisResultModel: {} as ProjectModel['analysisResultModel'],
      deployments: [],
      activeChatMessages: [],
      project: null,
      additionalInfos: {
        email: '',
        phone: '',
        address: '',
        city: seed?.city || profile.location || '',
        country: seed?.country || profile.country || '',
        zipCode: '',
        teamMembers: [],
      },
    });

    if (!project.id) {
      throw new Error('Project creation did not return an identifier');
    }

    logger.info(
      `Created project ${project.id} (${project.type}) from imported business plan for user ${userId}: ` +
        `${seed?.constraints.length ?? 0} constraints, budget "${project.budgetIntervals ?? '—'}"`
    );

    return this.createSimulation(userId, project.id, {
      name,
      origin: 'imported-document',
      tier: input.tier,
      documentName: input.documentName,
      answers: input.answers,
      understanding: input.understanding,
    });
  }

  /** Les six étapes, de la lecture du projet à l'analyse des résultats. */
  private async runPipeline(
    userId: string,
    projectId: string,
    simulationId: string,
    answers?: Record<string, string>,
    seedUnderstanding?: ProjectUnderstanding
  ): Promise<void> {
    try {
      // --- 1. Comprendre le projet
      await this.setStage(userId, projectId, simulationId, 'understand', 'active');
      // Un business plan importé a déjà été lu : le relire coûterait un appel
      // de plus et rendrait moins, le projet créé ne portant que l'essentiel.
      const understanding =
        seedUnderstanding ??
        (await this.ai.understandProject(await this.loadProject(userId, projectId), userId));

      // Les réponses de l'utilisateur écrasent ce que le moteur avait deviné.
      if (answers) {
        for (const item of understanding.items) {
          const answer = answers[item.id];
          if (answer) {
            item.answer = answer;
            item.state = 'known';
            item.value = answer;
          }
        }
      }

      await this.mutate(userId, projectId, simulationId, (simulation) => {
        simulation.understanding = understanding;
      });
      await this.setStage(
        userId,
        projectId,
        simulationId,
        'understand',
        'done',
        `${understanding.items.length} éléments identifiés`
      );

      // --- 2. Découvrir les facteurs
      await this.setStage(userId, projectId, simulationId, 'discover-factors', 'active');
      const factors = await this.ai.discoverFactors(understanding, userId);
      await this.mutate(userId, projectId, simulationId, (simulation) => {
        simulation.factors = factors;
      });
      await this.setStage(
        userId,
        projectId,
        simulationId,
        'discover-factors',
        'done',
        `${factors.length} facteurs identifiés`
      );

      // --- 3. Rassembler les données externes
      await this.setStage(userId, projectId, simulationId, 'research', 'active');
      const evidence: Evidence[] = factors
        .map((factor) => factor.evidence)
        .filter((item): item is Evidence => Boolean(item));
      await this.mutate(userId, projectId, simulationId, (simulation) => {
        simulation.evidence = evidence;
      });
      await this.setStage(
        userId,
        projectId,
        simulationId,
        'research',
        'done',
        `${evidence.length} valeurs sourcées`
      );

      // --- 4. Construire les scénarios
      await this.setStage(userId, projectId, simulationId, 'model', 'active');
      const scenarios = await this.ai.designScenarios(understanding, factors, userId);
      await this.setStage(
        userId,
        projectId,
        simulationId,
        'model',
        'done',
        `${scenarios.length} scénarios construits`
      );

      // --- 5. Exécuter les scénarios (déterministe, sans LLM)
      await this.setStage(userId, projectId, simulationId, 'simulate', 'active');
      const baseline = understanding.baseline;
      for (const scenario of scenarios) {
        scenario.outcome = runScenario(baseline, scenario);
      }
      const stressCount = scenarios.filter((s) => s.kind === 'stress' || s.kind === 'extreme').length;
      await this.setStage(
        userId,
        projectId,
        simulationId,
        'simulate',
        'done',
        `${scenarios.length} scénarios exécutés, dont ${stressCount} stress tests`
      );

      // --- 6. Analyser
      await this.setStage(userId, projectId, simulationId, 'analyse', 'active');
      const result = await this.buildResult(understanding, factors, evidence, scenarios, userId);

      await this.mutate(userId, projectId, simulationId, (simulation) => {
        simulation.result = result;
        simulation.status = 'completed';
        simulation.completedAt = new Date();
      });
      await this.setStage(userId, projectId, simulationId, 'analyse', 'done');

      // Le pack inclut le rapport: on l'enchaîne pour que l'utilisateur le
      // trouve prêt en arrivant sur les résultats.
      const current = await this.getSimulation(userId, projectId, simulationId);
      if (current?.tier !== 'run') {
        await this.generateReport(userId, projectId, simulationId);
      }

      logger.info(`Simulation ${simulationId} completed with index ${result.viabilityIndex}`);
    } catch (error: any) {
      logger.error(`Simulation ${simulationId} failed: ${error.message}`, { stack: error.stack });
      await this.mutate(userId, projectId, simulationId, (simulation) => {
        simulation.status = 'failed';
        simulation.failureReason = error.message;
        const active = simulation.progress.stages.find((stage) => stage.state === 'active');
        if (active) active.state = 'failed';
      }).catch(() => undefined);
    }
  }

  /** Assemble le résultat: chiffres du moteur + lecture faite par l'IA. */
  private async buildResult(
    understanding: ProjectUnderstanding,
    factors: Factor[],
    evidence: Evidence[],
    scenarios: Scenario[],
    userId: string
  ): Promise<SimulationResult> {
    const baseline = understanding.baseline;
    const baselineScenario = scenarios.find((s) => s.kind === 'baseline') ?? scenarios[0];
    const points = projectBusiness(baseline);
    const viability = computeViability(baseline, points);
    const robustness = computeRobustness(scenarios);
    const confidence = computeConfidence(evidence);
    const verdict = computeVerdict(viability.index, robustness);
    const sensitivity = computeSensitivity(baseline, factors);
    const conditions = computeViabilityConditions(baseline);

    const narrative = await this.ai.analyse(understanding, factors, scenarios, userId);

    return {
      viabilityIndex: baselineScenario?.outcome?.viability ?? viability.index,
      robustness,
      confidence,
      verdict,
      verdictRationale: narrative.verdictRationale,
      factorSummary: summariseFactors(factors),
      criticalFactors: factors
        .filter((factor) => factor.tier === 'critical')
        .sort((a, b) => b.impact - a.impact),
      scenarios,
      risks: narrative.risks,
      strengths: narrative.strengths,
      weaknesses: narrative.weaknesses,
      keyUncertainties: narrative.keyUncertainties,
      financials: buildFinancialSummary(baseline, points),
      sensitivity,
      conditions,
    };
  }

  private async setStage(
    userId: string,
    projectId: string,
    simulationId: string,
    stageId: PipelineStageId,
    state: StageState,
    note?: string
  ): Promise<void> {
    await this.mutate(userId, projectId, simulationId, (simulation) => {
      const stage = simulation.progress.stages.find((candidate) => candidate.id === stageId);
      if (!stage) return;

      stage.state = state;
      if (note) stage.note = note;
      if (state === 'active') stage.startedAt = new Date();
      if (state === 'done') stage.completedAt = new Date();

      const done = simulation.progress.stages.filter((s) => s.state === 'done').length;
      simulation.progress.percent = Math.round(
        (done / simulation.progress.stages.length) * 100
      );
    });
  }

  // ===================================================================
  // RAPPORT
  // ===================================================================

  /**
   * Produit le rapport complet. C'est une étape facturée à part: elle demande
   * une passe d'analyse supplémentaire et la génération des recommandations.
   */
  async generateReport(
    userId: string,
    projectId: string,
    simulationId: string
  ): Promise<SimulationReport> {
    const simulation = await this.getSimulation(userId, projectId, simulationId);
    if (!simulation) throw new Error(`Simulation not found: ${simulationId}`);
    if (!simulation.result || !simulation.understanding) {
      throw new Error('The simulation has not produced a result yet.');
    }
    if (simulation.report) return simulation.report;

    const { understanding, factors, result } = simulation;
    const sensitivitySummary = result.sensitivity
      .map((entry) => `- ${entry.factorName} (${entry.change}) : ${entry.viabilityDelta > 0 ? '+' : ''}${entry.viabilityDelta} points`)
      .join('\n');

    const output = await this.ai.recommend(
      understanding,
      factors,
      result.scenarios,
      sensitivitySummary,
      userId
    );

    const report: SimulationReport = {
      simulationId,
      generatedAt: new Date(),
      executiveSummary: {
        viabilityIndex: result.viabilityIndex,
        robustness: result.robustness,
        confidence: result.confidence,
        verdict: result.verdict,
        statement: output.executiveStatement,
      },
      profile: understanding.profile,
      factors,
      scenarios: result.scenarios,
      financials: result.financials,
      sensitivity: result.sensitivity,
      conditions: result.conditions,
      recommendations: output.recommendations,
      evidence: simulation.evidence,
      validationNeeded: output.validationNeeded,
    };

    await this.mutate(userId, projectId, simulationId, (current) => {
      current.report = report;
      current.hasReport = true;
    });

    return report;
  }

  // ===================================================================
  // LABORATOIRES
  // ===================================================================

  /** Point d'entrée unique des analyses complémentaires. */
  async runLab(
    userId: string,
    projectId: string,
    simulationId: string,
    lab: LabName
  ): Promise<SimulationModel> {
    const simulation = await this.getSimulation(userId, projectId, simulationId);
    if (!simulation) throw new Error(`Simulation not found: ${simulationId}`);
    if (!simulation.understanding || !simulation.result) {
      throw new Error('Complementary analyses require a completed simulation.');
    }

    switch (lab) {
      case 'redTeam':
        return this.storeLab(userId, projectId, simulationId, 'redTeam', await this.buildRedTeam(simulation, userId));
      case 'customers':
        return this.storeLab(userId, projectId, simulationId, 'customers', await this.buildCustomers(simulation, userId));
      case 'investors':
        return this.storeLab(userId, projectId, simulationId, 'investors', await this.buildInvestors(simulation, userId));
      case 'blackSwan':
        return this.storeLab(userId, projectId, simulationId, 'blackSwan', await this.buildBlackSwan(simulation, userId));
      case 'universes':
        return this.storeLab(userId, projectId, simulationId, 'universes', await this.buildUniverses(simulation, userId));
      case 'timeMachine':
        return this.storeLab(userId, projectId, simulationId, 'timeMachine', this.buildTimeMachine(simulation));
      case 'experiments':
        return this.storeLab(userId, projectId, simulationId, 'experiments', await this.buildExperiments(simulation, userId));
      default:
        throw new Error(`Unknown lab: ${lab}`);
    }
  }

  private async storeLab(
    userId: string,
    projectId: string,
    simulationId: string,
    key: LabName,
    payload: unknown
  ): Promise<SimulationModel> {
    return this.mutate(userId, projectId, simulationId, (simulation) => {
      (simulation.labs as any)[key] = payload;
    });
  }

  private async buildRedTeam(
    simulation: SimulationModel,
    userId: string
  ): Promise<RedTeamReport> {
    const { vulnerabilities, verdict } = await this.ai.runRedTeam(
      simulation.understanding!,
      simulation.factors,
      userId
    );

    return {
      generatedAt: new Date(),
      vulnerabilities,
      summary: {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
        important: vulnerabilities.filter((v) => v.severity === 'important').length,
        secondary: vulnerabilities.filter((v) => v.severity === 'secondary').length,
      },
      verdict,
    };
  }

  /**
   * Le panel client est calculé, pas raconté: l'IA fournit les segments et
   * leur consentement à payer, la courbe de conversion sort d'ici.
   */
  private async buildCustomers(
    simulation: SimulationModel,
    userId: string
  ): Promise<CustomerSimulation> {
    const understanding = simulation.understanding!;
    const { segments, testPrices, caveat } = await this.ai.simulateCustomers(understanding, userId);

    const prices = testPrices.length > 0 ? testPrices : this.defaultPriceLadder(understanding.baseline);

    const pricePoints: PricePoint[] = prices.map((price) => {
      let conversionRate = 0;
      for (const segment of segments) {
        // Au-dessus du consentement à payer, la conversion décroît d'autant
        // plus vite que le segment est sensible au prix.
        const ratio = segment.willingnessToPay > 0 ? price / segment.willingnessToPay : 2;
        const segmentConversion =
          ratio <= 1
            ? 1 - segment.priceSensitivity * ratio * 0.35
            : Math.max(0, 1 - segment.priceSensitivity * (ratio - 1) * 2.5 - segment.priceSensitivity * 0.35);
        conversionRate += segment.share * Math.max(0, Math.min(1, segmentConversion));
      }

      const buyers = Math.round(CUSTOMER_PANEL_SIZE * conversionRate);
      return {
        price,
        conversionRate: Number(conversionRate.toFixed(4)),
        buyers,
        estimatedRevenue: Math.round(buyers * price),
      };
    });

    const optimal = pricePoints.reduce(
      (best, point) => (point.estimatedRevenue > best.estimatedRevenue ? point : best),
      pricePoints[0] ?? { price: 0, estimatedRevenue: 0, buyers: 0, conversionRate: 0 }
    );

    return {
      generatedAt: new Date(),
      panelSize: CUSTOMER_PANEL_SIZE,
      currency: understanding.baseline.currency,
      segments,
      pricePoints,
      optimalPrice: optimal.price,
      caveat,
    };
  }

  private defaultPriceLadder(baseline: BusinessBaseline): number[] {
    const base = baseline.unitPrice > 0 ? baseline.unitPrice : 1000;
    return [0.6, 0.8, 1, 1.25, 1.5].map((factor) => Math.round(base * factor));
  }

  private async buildInvestors(
    simulation: SimulationModel,
    userId: string
  ): Promise<InvestorReadiness> {
    const { verdicts, expectedObjections } = await this.ai.simulateInvestors(
      simulation.understanding!,
      simulation.result!.scenarios,
      userId
    );

    const readinessScore =
      verdicts.length > 0
        ? Math.round(verdicts.reduce((sum, verdict) => sum + verdict.score, 0) / verdicts.length)
        : 0;

    return { generatedAt: new Date(), readinessScore, verdicts, expectedObjections };
  }

  /**
   * Chaque choc est effectivement rejoué dans le moteur: l'intérêt n'est pas
   * la liste des catastrophes mais la part de celles que le modèle encaisse.
   */
  private async buildBlackSwan(
    simulation: SimulationModel,
    userId: string
  ): Promise<BlackSwanReport> {
    const baseline = simulation.understanding!.baseline;
    const rawEvents = await this.ai.generateBlackSwans(
      simulation.understanding!,
      simulation.factors,
      userId
    );

    const events: BlackSwanEvent[] = rawEvents.map((event) => ({
      ...event,
      outcome: runScenario(baseline, {
        id: event.id,
        name: event.title,
        kind: 'extreme',
        question: event.description,
        shifts: event.shifts,
      }),
    }));

    const survived = events.filter((event) => event.outcome?.survives).length;

    return {
      generatedAt: new Date(),
      events,
      absorptionRate: events.length > 0 ? Number((survived / events.length).toFixed(2)) : 0,
    };
  }

  private async buildUniverses(
    simulation: SimulationModel,
    userId: string
  ): Promise<UniverseComparison> {
    const baseline = simulation.understanding!.baseline;
    const scenarios = simulation.result!.scenarios;
    const { universes, narrative } = await this.ai.generateUniverses(
      simulation.understanding!,
      userId
    );

    const evaluated = universes.map((universe) => {
      const universeBaseline: BusinessBaseline = { ...baseline, ...universe.baselineOverrides };

      // Chaque univers est soumis aux mêmes scénarios que l'original: comparer
      // deux modèles sur le seul cas de référence ne dirait rien de leur tenue.
      const stressed = scenarios
        .filter((scenario) => scenario.kind !== 'baseline')
        .map((scenario) => ({
          ...scenario,
          outcome: runScenario(universeBaseline, scenario),
        }));

      return {
        ...universe,
        outcome: runScenario(universeBaseline, {
          id: `${universe.id}-baseline`,
          name: universe.name,
          kind: 'baseline',
          question: universe.rationale,
          shifts: [],
        }),
        robustness: computeRobustness(stressed),
      };
    });

    const best = evaluated.reduce<(typeof evaluated)[number] | null>((champion, universe) => {
      if (!champion) return universe;
      const championScore = champion.outcome?.viability ?? 0;
      const candidateScore = universe.outcome?.viability ?? 0;
      return candidateScore > championScore ? universe : champion;
    }, null);

    return {
      generatedAt: new Date(),
      universes: evaluated,
      bestUniverseId: best?.id ?? null,
      narrative,
    };
  }

  /** Entièrement déterministe: c'est une projection longue, pas une nouvelle analyse. */
  private buildTimeMachine(simulation: SimulationModel): TimeMachineReport {
    const baseline = simulation.understanding!.baseline;
    const scenarios = simulation.result!.scenarios;

    // Une trajectoire par grande famille de scénario, pour garder la vue lisible.
    const representatives = ['baseline', 'favourable', 'adverse', 'stress']
      .map((kind) => scenarios.find((scenario) => scenario.kind === kind))
      .filter((scenario): scenario is Scenario => Boolean(scenario));

    return {
      generatedAt: new Date(),
      horizonYears: 5,
      timelines: representatives.map((scenario) => buildTimeline(baseline, scenario)),
    };
  }

  private async buildExperiments(
    simulation: SimulationModel,
    userId: string
  ): Promise<ExperimentPlan> {
    const output = await this.ai.planExperiments(
      simulation.understanding!,
      simulation.result!.keyUncertainties,
      simulation.factors,
      userId
    );
    return {
      generatedAt: new Date(),
      experiments: output.experiments as Experiment[],
      recommendedExperimentId: output.recommendedExperimentId,
      rationale: output.rationale,
    };
  }
}

export const simulationService = new SimulationService(new PromptService());
