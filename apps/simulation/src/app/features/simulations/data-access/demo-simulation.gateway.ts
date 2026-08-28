import { Injectable } from '@angular/core';
import { Observable, concat, defer, of, throwError, timer } from 'rxjs';
import { delay, map, takeWhile } from 'rxjs/operators';

import {
  CreateSimulationInput,
  LinkedProject,
  ProjectUnderstanding,
  Simulation,
  SimulationOrigin,
  SimulationPricing,
  SimulationReport,
  SimulationSummary,
} from '../models';
import { DEMO_PROJECTS, DEMO_REPORT, DEMO_SIMULATIONS } from './demo-data';
import { SimulationGateway } from './simulation.gateway';

const LATENCY_MS = 420;
/** How fast the demo run walks through the pipeline. */
const STEP_MS = 1600;

/**
 * In-memory backend used when `environment.useMockData` is on.
 *
 * It exists so the product can be built, reviewed and demoed before the
 * simulation API ships. It holds no persistence: a reload resets it.
 */
@Injectable()
export class DemoSimulationGateway extends SimulationGateway {
  private simulations: Simulation[] = DEMO_SIMULATIONS.map((simulation) => ({ ...simulation }));

  override listProjects(): Observable<LinkedProject[]> {
    return of(DEMO_PROJECTS).pipe(delay(LATENCY_MS));
  }

  override analyseProject(projectId: string): Observable<ProjectUnderstanding> {
    const understanding = DEMO_SIMULATIONS[0].understanding;
    if (!understanding) {
      throw new Error('Demo dataset is missing its project analysis.');
    }
    const project = DEMO_PROJECTS.find((candidate) => candidate.id === projectId);
    return of({
      ...understanding,
      profile: { ...understanding.profile, name: project?.name ?? understanding.profile.name },
    }).pipe(delay(LATENCY_MS * 3));
  }

  override analyseDocument(file: File): Observable<ProjectUnderstanding> {
    const understanding = DEMO_SIMULATIONS[0].understanding;
    if (!understanding) {
      throw new Error('Demo dataset is missing its project analysis.');
    }
    return of({
      ...understanding,
      profile: {
        ...understanding.profile,
        name: file.name.replace(/\.[^.]+$/, ''),
      },
    }).pipe(delay(LATENCY_MS * 4));
  }

  override getPricing(origin: SimulationOrigin): Observable<SimulationPricing> {
    const fromIdem = origin === 'idem-project';
    return of<SimulationPricing>({
      idemProjectDiscount: fromIdem,
      plans: [
        {
          tier: 'run',
          price: fromIdem ? 9000 : 12_000,
          listPrice: fromIdem ? 12_000 : undefined,
          currency: 'FCFA',
          includes: ['pricing.includes.scenarios', 'pricing.includes.factors', 'pricing.includes.index'],
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
          includes: ['pricing.includes.report', 'pricing.includes.sensitivity', 'pricing.includes.recommendations'],
          recommended: false,
        },
      ],
    }).pipe(delay(LATENCY_MS));
  }

  override listSimulations(): Observable<SimulationSummary[]> {
    return of(this.simulations.map(toSummary)).pipe(delay(LATENCY_MS));
  }

  override getSimulation(id: string): Observable<Simulation> {
    return defer(() => {
      const simulation = this.simulations.find((candidate) => candidate.id === id);
      return simulation
        ? of({ ...simulation }).pipe(delay(LATENCY_MS))
        : throwError(() => new Error(`Unknown simulation: ${id}`));
    });
  }

  override createSimulation(input: CreateSimulationInput): Observable<Simulation> {
    const now = new Date().toISOString();
    const created: Simulation = {
      id: `sim-${Date.now()}`,
      name: input.name,
      origin: input.origin,
      projectId: input.projectId,
      projectName: DEMO_PROJECTS.find((project) => project.id === input.projectId)?.name,
      documentName: input.documentName,
      tier: input.tier,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      hasReport: false,
      previousRunId: input.previousRunId,
      revision: input.previousRunId ? 2 : 1,
      progress: {
        percent: 4,
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
    this.simulations = [created, ...this.simulations];
    return of(created).pipe(delay(LATENCY_MS));
  }

  /**
   * Walks the run through its six stages, then swaps in the reference result
   * so the results screen has something real to render.
   */
  override watchSimulation(id: string): Observable<Simulation> {
    const total = 6;
    const ticks = defer(() =>
      timer(STEP_MS, STEP_MS).pipe(
        map((tick) => this.advance(id, Math.min(tick + 1, total), total)),
        takeWhile((simulation) => simulation.status === 'running', true),
      ),
    );
    return concat(this.getSimulation(id), ticks);
  }

  override getReport(id: string): Observable<SimulationReport> {
    return of({ ...DEMO_REPORT, simulationId: id }).pipe(delay(LATENCY_MS * 2));
  }

  override purchaseReport(id: string): Observable<Simulation> {
    this.simulations = this.simulations.map((simulation) =>
      simulation.id === id ? { ...simulation, hasReport: true, tier: 'pack' as const } : simulation,
    );
    return this.getSimulation(id);
  }

  private advance(id: string, step: number, total: number): Simulation {
    const reference = DEMO_SIMULATIONS[0];
    const index = this.simulations.findIndex((candidate) => candidate.id === id);
    if (index === -1) {
      throw new Error(`Unknown simulation: ${id}`);
    }

    const current = this.simulations[index];
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
      progress: { percent: Math.round((step / total) * 100), stages },
      understanding: current.understanding ?? reference.understanding,
      result: finished ? reference.result : undefined,
      hasReport: finished ? current.tier !== 'run' : false,
    };

    this.simulations = this.simulations.map((simulation, i) => (i === index ? updated : simulation));
    return updated;
  }
}

function toSummary(simulation: Simulation): SimulationSummary {
  return {
    id: simulation.id,
    name: simulation.name,
    origin: simulation.origin,
    projectName: simulation.projectName,
    documentName: simulation.documentName,
    status: simulation.status,
    tier: simulation.tier,
    createdAt: simulation.createdAt,
    updatedAt: simulation.updatedAt,
    hasReport: simulation.hasReport,
    revision: simulation.revision,
    viabilityIndex: simulation.result?.viabilityIndex,
    verdict: simulation.result?.verdict,
  };
}
