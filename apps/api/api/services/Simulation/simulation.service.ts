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
  SimulationConsent,
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
  computeUnitEconomics,
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
   * Compréhension déjà établie, telle que l'utilisateur l'a validée à l'écran
   * avant de payer. Le pipeline la reprend au lieu de relire la source.
   *
   * Pour un business plan importé, elle est indispensable : sans elle, tout ce
   * que le document apportait serait perdu, le projet fraîchement créé ne
   * contenant que son nom et sa description. Pour un projet IDEM, elle évite
   * de relire le même projet une seconde fois — et surtout évite que la
   * simulation ne tourne sur une lecture différente de celle que l'écran
   * d'analyse a montrée.
   */
  understanding?: ProjectUnderstanding;
  /**
   * L'accord recueilli juste avant ce lancement, validé par
   * `requireSimulationConsent`. Conservé avec l'exécution qu'il autorise.
   */
  consent?: SimulationConsent;
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

  /**
   * Écrit les simulations, et RIEN d'autre.
   *
   * Le chemin pointé est ce qui rend l'écriture sûre : une simulation dure
   * plusieurs minutes pendant lesquelles la charte, le business plan ou le
   * pitch deck écrivent sur le même document. Reposer `analysisResultModel`
   * en entier depuis l'instantané lu ici remettrait leurs branches dans
   * l'état qu'elles avaient au début de cette étape.
   */
  private async writeSimulations(
    userId: string,
    projectId: string,
    simulations: SimulationModel[]
  ): Promise<void> {
    const updated = await this.projectRepository.update(
      projectId,
      { 'analysisResultModel.simulations': simulations } as any,
      this.collectionPath(userId)
    );
    if (!updated) {
      throw new Error(`Failed to persist simulations for project ${projectId}`);
    }
  }

  /**
   * Reporte l'accord de l'exécution sur la fiche projet, quand elle n'en porte
   * aucun.
   *
   * Les routes de rapport et de laboratoires vérifient l'acceptation au niveau
   * du projet. Sans ce report, un projet créé depuis un business plan importé
   * — qui n'a jamais connu l'écran de finalisation — voyait sa simulation
   * aboutir puis chaque livrable suivant refusé.
   *
   * Une fiche déjà finalisée n'est pas touchée : son acceptation d'origine,
   * avec sa date et son adresse, vaut mieux que celle d'aujourd'hui.
   */
  private async ensureProjectPolicyAcceptance(
    userId: string,
    projectId: string,
    project: ProjectModel,
    consent: SimulationConsent
  ): Promise<void> {
    if (project.policyAcceptance) {
      return;
    }

    try {
      await this.projectRepository.update(
        projectId,
        {
          policyAcceptance: {
            privacyPolicyAccepted: consent.privacyPolicyAccepted,
            // Les conditions acceptées ici sont celles de la simulation :
            // c'est l'acte qui a fait exister ce projet, ou le seul que
            // l'utilisateur ait posé sur lui.
            termsOfServiceAccepted: consent.simulationTermsAccepted,
            betaPolicyAccepted: consent.betaPolicyAccepted,
            marketingAccepted: false,
            acceptedAt: consent.acceptedAt,
            ipAddress: consent.ipAddress,
            userAgent: consent.userAgent,
          },
        } as Partial<ProjectModel>,
        this.collectionPath(userId)
      );
      logger.info(`Policy acceptance recorded on project ${projectId} from simulation consent`);
    } catch (error: any) {
      // L'exécution est déjà lancée : la faire échouer ici serait pire que de
      // signaler le manque. Le refus se produirait au premier laboratoire.
      logger.error(
        `Failed to record policy acceptance on project ${projectId}: ${error.message}`
      );
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

    await this.writeSimulations(userId, projectId, simulations);
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
    await this.writeSimulations(userId, projectId, remaining);
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
      consent: input.consent,
    });

    await this.writeSimulations(userId, projectId, [simulation, ...simulations]);

    // Le rapport et les laboratoires qui suivront restent gardés par
    // l'acceptation portée par la fiche projet. Un projet jamais finalisé —
    // ou créé à l'instant depuis un business plan — n'en a aucune : l'accord
    // donné pour cette exécution la constitue, plutôt que de laisser
    // l'utilisateur devant un refus au premier laboratoire ouvert.
    if (input.consent) {
      await this.ensureProjectPolicyAcceptance(userId, projectId, project, input.consent);
    }

    // La lecture validée à l'écran repasse par les bornes du moteur avant de
    // servir : elle a transité par le navigateur.
    const understanding = input.understanding
      ? this.ai.sanitizeUnderstanding(
          input.understanding,
          project.name,
          input.origin === 'imported-document' ? 'document' : 'project'
        )
      : undefined;

    // Volontairement non attendu: le pipeline dure plusieurs minutes.
    void this.runPipeline(userId, projectId, simulation.id, input.answers, understanding).catch(
      (error) => {
        logger.error(`Simulation pipeline crashed for ${simulation.id}: ${error.message}`, {
          stack: error.stack,
        });
      }
    );

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
    // La lecture revient du navigateur : elle est remise en forme avant de
    // peupler quoi que ce soit — un type de projet inconnu ou une liste sans
    // fin ne doivent pas atteindre la fiche.
    const understanding = this.ai.sanitizeUnderstanding(
      input.understanding,
      input.name || 'Projet importé',
      'document'
    );
    const profile = understanding.profile;
    // La graine vient de la même lecture du document : elle est taillée pour la
    // fiche projet, là où le profil l'est pour la simulation.
    const seed = understanding.projectSeed;
    const name = (input.name || profile.name || 'Projet importé').trim();

    const project = await projectService.createUserProject(userId, {
      name,
      description: seed?.description || profile.product || profile.businessModel || '',
      // La fiche projet doit se tenir seule une fois le document parti : c'est
      // elle que liront le business plan, le branding et le reste d'IDEM. Sans
      // description longue, ils repartaient de deux phrases.
      longDescription: buildLongDescription(understanding),
      type: seed?.type ?? 'other',
      constraints: seed?.constraints ?? [],
      teamSize: seed?.teamSize || profile.teamSize || '',
      scope: seed?.scope || profile.sector || '',
      targets: seed?.targets || profile.targetCustomer || '',
      budgetIntervals: seed?.budgetIntervals || profile.plannedFunding,
      currency: seed?.currency || profile.currency,
      selectedPhases: [],
      // Aucun livrable IDEM n'existe encore : ils seront générés par leurs
      // propres modules si l'utilisateur les demande.
      analysisResultModel: {} as ProjectModel['analysisResultModel'],
      deployments: [],
      activeChatMessages: [],
      project: null,
      // La fiche naît avec l'accord qui l'a fait naître : sans lui, le rapport
      // et les laboratoires de sa propre simulation lui seraient refusés.
      policyAcceptance: input.consent
        ? {
            privacyPolicyAccepted: input.consent.privacyPolicyAccepted,
            termsOfServiceAccepted: input.consent.simulationTermsAccepted,
            betaPolicyAccepted: input.consent.betaPolicyAccepted,
            marketingAccepted: false,
            acceptedAt: input.consent.acceptedAt,
            ipAddress: input.consent.ipAddress,
            userAgent: input.consent.userAgent,
          }
        : undefined,
      additionalInfos: {
        // Coordonnées et équipe ne sont reprises que si le document les
        // écrivait : une fiche à moitié inventée serait pire que vide.
        email: seed?.contact?.email || '',
        phone: seed?.contact?.phone || '',
        address: seed?.contact?.address || '',
        city: seed?.city || profile.location || '',
        country: seed?.country || profile.country || '',
        zipCode: seed?.contact?.zipCode || '',
        teamMembers: (seed?.teamMembers ?? []).map((member) => ({
          name: member.name,
          role: member.role,
          bio: member.bio ?? '',
          email: '',
        })),
      },
    });

    if (!project.id) {
      throw new Error('Project creation did not return an identifier');
    }

    logger.info(
      `Created project ${project.id} (${project.type}) from imported business plan for user ${userId}: ` +
        `${project.longDescription?.length ?? 0} chars of long description, ` +
        `${seed?.constraints.length ?? 0} constraints, ${seed?.teamMembers?.length ?? 0} team members, ` +
        `${understanding.extras?.length ?? 0} extra facts, budget "${project.budgetIntervals ?? '—'}"`
    );

    return this.createSimulation(userId, project.id, {
      name,
      origin: 'imported-document',
      tier: input.tier,
      documentName: input.documentName,
      answers: input.answers,
      understanding,
      consent: input.consent,
    });
  }

  /**
   * Données acquises lors d'une exécution précédente, disponibles pour
   * reprendre depuis un point de contrôle sans relancer les étapes déjà faites.
   */
  private resumeContext(
    simulation: SimulationModel
  ): { startFrom: PipelineStageId; understanding?: ProjectUnderstanding; factors?: Factor[]; evidence?: Evidence[] } {
    const stages = simulation.progress.stages;

    // Première étape non marquée `done` — c'est là qu'on repart.
    const firstPending = stages.find((s) => s.state !== 'done');
    const startFrom: PipelineStageId = firstPending?.id ?? 'understand';

    return {
      startFrom,
      understanding: simulation.understanding,
      factors: simulation.factors?.length ? simulation.factors : undefined,
      evidence: simulation.evidence?.length ? simulation.evidence : undefined,
    };
  }

  /**
   * Reprend une simulation interrompue (statut `failed` ou `running` bloquée).
   *
   * Identifie la première étape non terminée depuis les données persistées et
   * repart de là sans re-débiter le quota ni redemander le consentement.
   * Répond immédiatement : le pipeline continue en arrière-plan.
   */
  async resumeSimulation(
    userId: string,
    projectId: string,
    simulationId: string
  ): Promise<SimulationModel> {
    const simulation = await this.getSimulation(userId, projectId, simulationId);
    if (!simulation) {
      throw new Error(`Simulation not found: ${simulationId}`);
    }
    if (simulation.status === 'completed') {
      throw Object.assign(new Error('This simulation has already completed.'), { status: 409 });
    }

    const { startFrom, understanding, factors, evidence } = this.resumeContext(simulation);

    logger.info(
      `Resuming simulation ${simulationId} from stage "${startFrom}" ` +
        `(understanding: ${!!understanding}, factors: ${factors?.length ?? 0}, evidence: ${evidence?.length ?? 0})`
    );

    // Remet la simulation en état courant : on efface l'erreur et on marque
    // l'étape de reprise comme pending pour qu'elle reparte proprement.
    const resumed = await this.mutate(userId, projectId, simulationId, (sim) => {
      sim.status = 'running';
      sim.failureReason = undefined;
      // Réinitialise l'étape qui avait échoué (active → pending) et celles
      // qui n'ont pas encore tourné, sans toucher aux étapes déjà done.
      for (const stage of sim.progress.stages) {
        if (stage.state === 'active' || stage.state === 'failed') {
          stage.state = 'pending';
        }
      }
    });

    // Relance le pipeline en arrière-plan depuis le checkpoint.
    void this.runPipeline(
      userId,
      projectId,
      simulationId,
      undefined, // les réponses sont déjà intégrées dans l'understanding persisté
      undefined, // seedUnderstanding passé via resumeFrom
      { startFrom, understanding, factors, evidence }
    ).catch((error) => {
      logger.error(`Resumed simulation pipeline crashed for ${simulationId}: ${error.message}`, {
        stack: error.stack,
      });
    });

    return resumed;
  }

  /** Les six étapes, de la lecture du projet à l'analyse des résultats. */
  private async runPipeline(
    userId: string,
    projectId: string,
    simulationId: string,
    answers?: Record<string, string>,
    seedUnderstanding?: ProjectUnderstanding,
    resume?: {
      startFrom: PipelineStageId;
      understanding?: ProjectUnderstanding;
      factors?: Factor[];
      evidence?: Evidence[];
    }
  ): Promise<void> {
    const skip = (stage: PipelineStageId): boolean => {
      if (!resume) return false;
      const order: PipelineStageId[] = [
        'understand', 'discover-factors', 'research', 'model', 'simulate', 'analyse',
      ];
      return order.indexOf(stage) < order.indexOf(resume.startFrom);
    };

    try {
      // --- 1. Comprendre le projet
      let understanding: ProjectUnderstanding;
      if (skip('understand') && resume?.understanding) {
        understanding = resume.understanding;
        logger.info(`Simulation ${simulationId}: skipping 'understand' (already done)`);
      } else {
        await this.setStage(userId, projectId, simulationId, 'understand', 'active');
        // Un business plan importé a déjà été lu : le relire coûterait un appel
        // de plus et rendrait moins, le projet créé ne portant que l'essentiel.
        understanding =
          seedUnderstanding ??
          (resume?.understanding) ??
          (await this.ai.understandProject(await this.loadProject(userId, projectId), userId));

        // Les réponses de l'utilisateur écrasent ce que le moteur avait deviné.
        if (answers) {
          for (const item of understanding.items) {
            const answer = answers[item.id];
            if (answer) {
              item.answer = answer;
              item.state = 'known';
              item.value = answer;
              item.source = 'answer';
              item.detail = undefined;
            }
          }
        }

        await this.mutate(userId, projectId, simulationId, (simulation) => {
          simulation.understanding = understanding;
        });
        await this.setStage(
          userId, projectId, simulationId, 'understand', 'done',
          `${understanding.items.length} éléments identifiés`
        );
      }

      // --- 2. Découvrir les facteurs
      let factors: Factor[];
      if (skip('discover-factors') && resume?.factors?.length) {
        factors = resume.factors;
        logger.info(`Simulation ${simulationId}: skipping 'discover-factors' (already done)`);
      } else {
        await this.setStage(userId, projectId, simulationId, 'discover-factors', 'active');
        factors = await this.ai.discoverFactors(understanding, userId);
        await this.mutate(userId, projectId, simulationId, (simulation) => {
          simulation.factors = factors;
        });
        await this.setStage(
          userId, projectId, simulationId, 'discover-factors', 'done',
          `${factors.length} facteurs identifiés`
        );
      }

      // --- 3. Rassembler les données externes
      let evidence: Evidence[];
      if (skip('research') && resume?.evidence?.length) {
        evidence = resume.evidence;
        logger.info(`Simulation ${simulationId}: skipping 'research' (already done)`);
      } else {
        await this.setStage(userId, projectId, simulationId, 'research', 'active');
        evidence = factors
          .map((factor) => factor.evidence)
          .filter((item): item is Evidence => Boolean(item));
        await this.mutate(userId, projectId, simulationId, (simulation) => {
          simulation.evidence = evidence;
        });
        await this.setStage(
          userId, projectId, simulationId, 'research', 'done',
          `${evidence.length} valeurs sourcées`
        );
      }

      // --- 4. Construire les scénarios
      await this.setStage(userId, projectId, simulationId, 'model', 'active');
      const scenarios = await this.ai.designScenarios(understanding, factors, userId);
      await this.setStage(
        userId, projectId, simulationId, 'model', 'done',
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
        userId, projectId, simulationId, 'simulate', 'done',
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
      // La décomposition et l'économie unitaire étaient calculées puis jetées :
      // le rapport n'avait plus de quoi expliquer d'où sort le score.
      viabilityBreakdown: viability,
      unitEconomics: computeUnitEconomics(baseline),
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
    if (simulation.report) return this.completeReport(simulation);

    const { understanding, factors, result } = simulation;
    const sensitivitySummary = result.sensitivity
      .map((entry) => `- ${entry.factorName} (${entry.change}) : ${entry.viabilityDelta > 0 ? '+' : ''}${entry.viabilityDelta} points`)
      .join('\n');

    const output = await this.ai.recommend(
      understanding,
      factors,
      result.scenarios,
      sensitivitySummary,
      userId,
      result.risks
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
      risks: result.risks,
      recommendations: output.recommendations,
      evidence: simulation.evidence,
      validationNeeded: output.validationNeeded,
      // Le rapport ARGUMENTE, l'exécution constate : tout ce que l'analyse a
      // produit pour justifier son verdict voyage avec le document, sans quoi
      // le PDF affirmait un score sans jamais dire d'où il sort.
      ...reportAnalysis(result, understanding),
    };

    await this.mutate(userId, projectId, simulationId, (current) => {
      current.report = report;
      current.hasReport = true;
    });

    return report;
  }

  /**
   * Renvoie le rapport, en le produisant s'il manque alors que le forfait
   * l'inclut.
   *
   * `hasReport` vaut vrai dès la création pour tout forfait au-dessus de
   * `run` : il dit ce qui est DÛ, pas ce qui existe. Les écrans de rapport et
   * de téléchargement s'y fiaient pour ne plus rien demander, si bien qu'une
   * génération enchaînée qui n'aboutissait pas — écrasée par une écriture
   * concurrente, interrompue par un redémarrage — laissait la simulation dans
   * un état sans issue : le forfait était payé, le bouton présent, et chaque
   * appel répondait « pas encore de rapport » sans jamais proposer de le
   * produire.
   *
   * Produire ici ne facture rien de plus : pour ces forfaits le rapport est
   * déjà compris, et le pipeline l'enchaîne de lui-même en fin d'exécution.
   * Renvoie `null` quand le rapport reste à acheter (`run`) ou quand
   * l'exécution n'a pas de quoi le composer.
   */
  async ensureReport(
    userId: string,
    projectId: string,
    simulationId: string
  ): Promise<SimulationReport | null> {
    const simulation = await this.getSimulation(userId, projectId, simulationId);
    if (!simulation) {
      throw new Error(`Simulation not found: ${simulationId}`);
    }
    if (simulation.report) {
      return this.completeReport(simulation);
    }
    if (simulation.tier === 'run' || !simulation.result || !simulation.understanding) {
      return null;
    }

    logger.info(
      `Rapport manquant sur ${simulationId} (forfait ${simulation.tier}) — génération à la demande`
    );
    return this.generateReport(userId, projectId, simulationId);
  }

  /**
   * Complète un rapport déjà en base avec ce que sa version n'y mettait pas.
   *
   * Un rapport est persisté une fois puis relu pendant des mois : chaque
   * chapitre ajouté au document trouverait donc son champ vide sur tout ce qui
   * a été produit avant lui. Les valeurs manquantes sont reprises du RÉSULTAT,
   * qui les a toujours portées — c'est une recomposition, pas une invention, et
   * elle ne coûte aucun appel au modèle.
   *
   * Rien n'est réécrit en base : le rapport stocké reste celui qui a été payé,
   * seule sa lecture est complétée.
   */
  private completeReport(simulation: SimulationModel): SimulationReport {
    const report = simulation.report!;
    const result = simulation.result;
    if (!result) return report;

    const completed: SimulationReport = { ...report };
    // Les risques d'abord : sans eux le chapitre des recommandations perd le
    // problème auquel chaque action répond.
    if (!completed.risks?.length && result.risks?.length) {
      completed.risks = result.risks;
    }
    const analysis = reportAnalysis(result, simulation.understanding);
    for (const [key, value] of Object.entries(analysis)) {
      if (value === undefined) continue;
      if ((completed as any)[key] === undefined) {
        (completed as any)[key] = value;
      }
    }
    return completed;
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


/**
 * Ce que le RAPPORT reprend du résultat pour pouvoir s'expliquer.
 *
 * Un seul endroit, appelé à la composition comme à la relecture : sans cela,
 * un champ ajouté au rapport aurait été rempli à la génération et absent des
 * rapports déjà produits, ou l'inverse.
 */
function reportAnalysis(
  result: SimulationResult,
  understanding?: ProjectUnderstanding
): Partial<SimulationReport> {
  const baseline = understanding?.baseline;

  // La décomposition et l'économie unitaire sont DÉTERMINISTES : quand une
  // exécution ancienne ne les porte pas, les recalculer depuis la baseline
  // coûte quelques multiplications et rend au rapport son chapitre le plus
  // utile. Aucun appel au modèle, aucun chiffre inventé.
  const viabilityBreakdown =
    result.viabilityBreakdown ??
    (baseline ? computeViability(baseline, projectBusiness(baseline)) : undefined);
  const unitEconomics =
    result.unitEconomics ?? (baseline ? computeUnitEconomics(baseline) : undefined);

  return {
    verdictRationale: result.verdictRationale,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    keyUncertainties: result.keyUncertainties,
    factorSummary: result.factorSummary,
    viabilityBreakdown,
    unitEconomics,
    baseline,
  };
}

/**
 * Compose la description longue du projet créé à partir d'un business plan.
 *
 * Purement mécanique : le modèle a déjà tout lu, il serait absurde de le
 * rappeler pour reformuler. On rassemble ce qu'il a rendu — le récit, ce que
 * le document établit, et les particularités qui n'entrent dans aucun champ —
 * pour que la fiche projet contienne le document, et non un résumé du résumé.
 */
function buildLongDescription(understanding: ProjectUnderstanding): string {
  const sections: string[] = [];
  const seed = understanding.projectSeed;

  const opening = seed?.longDescription?.trim() || understanding.narrative?.trim();
  if (opening) {
    sections.push(opening);
  }

  const established = understanding.items.filter(
    (item) => item.state === 'known' && item.value
  );
  if (established.length > 0) {
    sections.push(
      `Ce que le business plan établit :\n${established
        .map((item) => `- ${item.label} : ${item.value}`)
        .join('\n')}`
    );
  }

  if (understanding.extras?.length) {
    sections.push(
      `Particularités du projet :\n${understanding.extras
        .map((fact) => `- ${fact.label} : ${fact.value}`)
        .join('\n')}`
    );
  }

  if (seed?.constraints.length) {
    sections.push(`Contraintes annoncées :\n${seed.constraints.map((c) => `- ${c}`).join('\n')}`);
  }

  return sections.join('\n\n');
}
