import { Observable } from 'rxjs';

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

/**
 * Everything the UI needs from the simulation backend.
 *
 * Declared as an abstract class so it doubles as a DI token: the app binds
 * either the HTTP implementation or the demo one, and no page ever knows
 * which is in use.
 */
export abstract class SimulationGateway {
  /** IDEM projects the signed-in user can simulate. */
  abstract listProjects(): Observable<LinkedProject[]>;

  /**
   * Reads the project and returns what is known, researchable, uncertain or
   * missing, before anything is simulated or billed.
   */
  abstract analyseProject(projectId: string): Observable<ProjectUnderstanding>;

  /** Same, for a business plan uploaded by a user with no IDEM project. */
  abstract analyseDocument(file: File): Observable<ProjectUnderstanding>;

  abstract getPricing(origin: SimulationOrigin): Observable<SimulationPricing>;

  abstract listSimulations(): Observable<SimulationSummary[]>;

  abstract getSimulation(id: string): Observable<Simulation>;

  abstract createSimulation(input: CreateSimulationInput): Observable<Simulation>;

  /** Emits progress updates until the run reaches a terminal state. */
  abstract watchSimulation(id: string): Observable<Simulation>;

  abstract getReport(id: string): Observable<SimulationReport>;

  /** Buys the full report for a run that was bought without it. */
  abstract purchaseReport(id: string): Observable<Simulation>;
}
