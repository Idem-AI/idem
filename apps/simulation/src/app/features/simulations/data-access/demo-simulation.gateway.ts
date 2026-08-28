import { Injectable } from '@angular/core';
import { Observable, concat, defer, delay, map, of, takeWhile, throwError, timer } from 'rxjs';

import { DEMO_STATE_KEY } from '../../../core/mock';

import {
  CreateSimulationInput,
  LabName,
  LinkedProject,
  ProjectUnderstanding,
  Simulation,
  SimulationOrigin,
  SimulationPricing,
  SimulationReport,
  SimulationSummary,
} from '../models';
import {
  DEMO_BLACK_SWAN,
  DEMO_CUSTOMERS,
  DEMO_EXPERIMENTS,
  DEMO_INVESTORS,
  DEMO_PROJECTS,
  DEMO_RED_TEAM,
  DEMO_REPORT,
  DEMO_SIMULATIONS,
  DEMO_TIME_MACHINE,
  DEMO_UNIVERSES,
} from './demo-data';
import { SimulationGateway } from './simulation.gateway';

const LATENCY_MS = 420;
/** Cadence à laquelle la démo parcourt les étapes du pipeline. */
const STEP_MS = 1600;

/**
 * Backend en mémoire, actif quand le mode démonstration est retenu.
 *
 * Il existe pour que le produit soit développable, revu et démontré sans API
 * ni crédits LLM. L'état est conservé dans le navigateur : une exécution lancée
 * en démo survit à un rechargement, comme elle le ferait côté serveur.
 * `MockDataService.resetDemoData()` le remet à zéro.
 */
@Injectable()
export class DemoSimulationGateway extends SimulationGateway {
  private simulations: Simulation[] = restoreState();

  override listProjects(): Observable<LinkedProject[]> {
    return of(DEMO_PROJECTS).pipe(delay(LATENCY_MS));
  }

  override analyseProject(projectId: string): Observable<ProjectUnderstanding> {
    const understanding = referenceFor(projectId).understanding!;
    const project = DEMO_PROJECTS.find((candidate) => candidate.id === projectId);
    return of({
      ...understanding,
      profile: { ...understanding.profile, name: project?.name ?? understanding.profile.name },
    }).pipe(delay(LATENCY_MS * 3));
  }

  override analyseDocument(projectId: string, file: File): Observable<ProjectUnderstanding> {
    const understanding = referenceFor(projectId).understanding!;
    return of({
      ...understanding,
      profile: { ...understanding.profile, name: file.name.replace(/\.[^.]+$/, '') },
    }).pipe(delay(LATENCY_MS * 4));
  }

  override getPricing(
    _projectId: string,
    origin: SimulationOrigin
  ): Observable<SimulationPricing> {
    const fromIdem = origin === 'idem-project';
    return of<SimulationPricing>({
      idemProjectDiscount: fromIdem,
      plans: [
        {
          tier: 'run',
          price: fromIdem ? 9000 : 12_000,
          listPrice: fromIdem ? 12_000 : undefined,
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
          price: fromIdem ? 19_000 : 25_000,
          listPrice: fromIdem ? 25_000 : 32_000,
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
          price: fromIdem ? 14_000 : 18_000,
          currency: 'FCFA',
          includes: [
            'pricing.includes.report',
            'pricing.includes.sensitivity',
            'pricing.includes.recommendations',
          ],
          recommended: false,
        },
      ],
    }).pipe(delay(LATENCY_MS));
  }

  override listSimulations(projectId: string): Observable<SimulationSummary[]> {
    return of(
      this.simulations
        .filter((simulation) => simulation.projectId === projectId)
        .map(toSummary)
    ).pipe(delay(LATENCY_MS));
  }

  override getSimulation(_projectId: string, simulationId: string): Observable<Simulation> {
    return defer(() => {
      const simulation = this.simulations.find((candidate) => candidate.id === simulationId);
      return simulation
        ? of({ ...simulation }).pipe(delay(LATENCY_MS))
        : throwError(() => new Error(`Unknown simulation: ${simulationId}`));
    });
  }

  override createSimulation(input: CreateSimulationInput): Observable<Simulation> {
    const now = new Date().toISOString();
    const created: Simulation = {
      id: `sim-${Date.now()}`,
      projectId: input.projectId,
      name: input.name,
      origin: input.origin,
      projectName: DEMO_PROJECTS.find((project) => project.id === input.projectId)?.name,
      documentName: input.documentName,
      tier: input.tier,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      hasReport: false,
      previousRunId: input.previousRunId,
      revision: input.previousRunId ? 2 : 1,
      factors: [],
      evidence: [],
      labs: {},
      progress: {
        percent: 0,
        stages: [
          { id: 'understand', state: 'active' },
          { id: 'discover-factors', state: 'pending' },
          { id: 'research', state: 'pending' },
          { id: 'model', state: 'pending' },
          { id: 'simulate', state: 'pending' },
          { id: 'analyse', state: 'pending' },
        ],
      },
    };
    this.commit([created, ...this.simulations]);
    return of(created).pipe(delay(LATENCY_MS));
  }

  /**
   * Fait avancer l'exécution étape par étape, puis substitue le résultat de
   * référence pour que l'écran de résultats ait quelque chose de réel à rendre.
   */
  override watchSimulation(projectId: string, simulationId: string): Observable<Simulation> {
    const total = 6;
    const ticks = defer(() =>
      timer(STEP_MS, STEP_MS).pipe(
        map((tick) => this.advance(simulationId, Math.min(tick + 1, total), total)),
        takeWhile((simulation) => simulation.status === 'running', true)
      )
    );
    return concat(this.getSimulation(projectId, simulationId), ticks);
  }

  override getReport(_projectId: string, simulationId: string): Observable<SimulationReport> {
    return of({ ...DEMO_REPORT, simulationId }).pipe(delay(LATENCY_MS * 2));
  }

  override generateReport(projectId: string, simulationId: string): Observable<SimulationReport> {
    this.commit(
      this.simulations.map((simulation) =>
        simulation.id === simulationId
          ? { ...simulation, hasReport: true, report: { ...DEMO_REPORT, simulationId } }
          : simulation
      )
    );
    return this.getReport(projectId, simulationId);
  }

  override runLab(
    projectId: string,
    simulationId: string,
    lab: LabName
  ): Observable<Simulation> {
    const payloads: Record<LabName, unknown> = {
      redTeam: DEMO_RED_TEAM,
      customers: DEMO_CUSTOMERS,
      investors: DEMO_INVESTORS,
      blackSwan: DEMO_BLACK_SWAN,
      universes: DEMO_UNIVERSES,
      timeMachine: DEMO_TIME_MACHINE,
      experiments: DEMO_EXPERIMENTS,
    };

    this.commit(
      this.simulations.map((simulation) =>
        simulation.id === simulationId
          ? { ...simulation, labs: { ...simulation.labs, [lab]: payloads[lab] } }
          : simulation
      )
    );

    // Une analyse complémentaire mobilise plusieurs agents : la latence
    // simulée le reflète, sinon l'écran de chargement n'est jamais testé.
    return this.getSimulation(projectId, simulationId).pipe(delay(LATENCY_MS * 4));
  }

  override deleteSimulation(_projectId: string, simulationId: string): Observable<void> {
    this.commit(this.simulations.filter((simulation) => simulation.id !== simulationId));
    return of(undefined).pipe(delay(LATENCY_MS));
  }

  private advance(simulationId: string, step: number, total: number): Simulation {
    const index = this.simulations.findIndex((candidate) => candidate.id === simulationId);
    if (index === -1) {
      throw new Error(`Unknown simulation: ${simulationId}`);
    }

    const current = this.simulations[index];
    const reference = referenceFor(current.projectId);
    const stages = current.progress.stages.map((stage, stageIndex) => ({
      ...stage,
      state:
        stageIndex < step
          ? ('done' as const)
          : stageIndex === step
            ? ('active' as const)
            : ('pending' as const),
      note: reference.progress.stages[stageIndex]?.note,
    }));

    const finished = step >= total;
    const updated: Simulation = {
      ...current,
      status: finished ? 'completed' : 'running',
      updatedAt: new Date().toISOString(),
      completedAt: finished ? new Date().toISOString() : undefined,
      progress: { percent: Math.round((step / total) * 100), stages },
      understanding: current.understanding ?? reference.understanding,
      factors: step >= 2 ? reference.factors : [],
      evidence: step >= 3 ? reference.evidence : [],
      result: finished ? reference.result : undefined,
      report: finished && current.tier !== 'run' ? { ...DEMO_REPORT, simulationId } : undefined,
      hasReport: finished ? current.tier !== 'run' : false,
    };

    this.commit(this.simulations.map((simulation, i) => (i === index ? updated : simulation)));
    return updated;
  }

  /** Toute mutation passe par ici, pour qu'aucune n'échappe à la persistance. */
  private commit(simulations: Simulation[]): void {
    this.simulations = simulations;
    try {
      localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(simulations));
    } catch {
      // Stockage plein ou indisponible : la démo reste utilisable en mémoire.
    }
  }
}

/**
 * Reprend l'état de démonstration laissé par la session précédente, ou repart
 * du jeu de référence. Un état illisible est ignoré plutôt que de bloquer
 * l'application sur un écran vide.
 */
function restoreState(): Simulation[] {
  try {
    const raw = localStorage.getItem(DEMO_STATE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed as Simulation[];
      }
    }
  } catch {
    // On repart du jeu de référence.
  }
  return DEMO_SIMULATIONS.map((simulation) => ({ ...simulation }));
}

/**
 * Le jeu de référence d'un projet.
 *
 * Un seul projet de démonstration porte un résultat complet et cohérent
 * (facteurs, scénarios, finances et sensibilité se répondent). Les autres le
 * réutilisent : inventer des chiffres par projet produirait un dossier qui se
 * contredit, ce qui est pire qu'un dossier partagé.
 */
function referenceFor(projectId: string): Simulation {
  return (
    DEMO_SIMULATIONS.find(
      (simulation) => simulation.projectId === projectId && simulation.result
    ) ??
    DEMO_SIMULATIONS.find((simulation) => simulation.result) ??
    DEMO_SIMULATIONS[0]
  );
}

function toSummary(simulation: Simulation): SimulationSummary {
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
