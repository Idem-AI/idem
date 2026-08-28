import { Observable } from 'rxjs';

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

/**
 * Tout ce que l'interface attend du backend de simulation.
 *
 * Déclarée en classe abstraite pour servir aussi de jeton d'injection : l'app
 * fournit soit l'implémentation HTTP, soit celle de démonstration, et aucune
 * page ne sait laquelle est active.
 */
export abstract class SimulationGateway {
  /** Projets IDEM que l'utilisateur connecté peut simuler. */
  abstract listProjects(): Observable<LinkedProject[]>;

  /**
   * Lit le projet et renvoie ce qui est su, à chercher, incertain ou manquant.
   * Rien n'est persisté ni facturé à cette étape.
   */
  abstract analyseProject(projectId: string): Observable<ProjectUnderstanding>;

  /** Même sortie, à partir d'un business plan importé. */
  abstract analyseDocument(projectId: string, file: File): Observable<ProjectUnderstanding>;

  abstract getPricing(projectId: string, origin: SimulationOrigin): Observable<SimulationPricing>;

  abstract listSimulations(projectId: string): Observable<SimulationSummary[]>;

  abstract getSimulation(projectId: string, simulationId: string): Observable<Simulation>;

  abstract createSimulation(input: CreateSimulationInput): Observable<Simulation>;

  /** Émet l'avancement jusqu'à ce que l'exécution atteigne un état terminal. */
  abstract watchSimulation(projectId: string, simulationId: string): Observable<Simulation>;

  abstract getReport(projectId: string, simulationId: string): Observable<SimulationReport>;

  /** Génère le rapport complet d'une exécution achetée sans lui. */
  abstract generateReport(projectId: string, simulationId: string): Observable<SimulationReport>;

  /** Lance une analyse complémentaire et renvoie la simulation enrichie. */
  abstract runLab(projectId: string, simulationId: string, lab: LabName): Observable<Simulation>;

  abstract deleteSimulation(projectId: string, simulationId: string): Observable<void>;
}
