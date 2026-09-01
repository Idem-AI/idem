import { Observable } from 'rxjs';

import {
  CreateSimulationInput,
  SimulationTier,
  LabName,
  LinkedProject,
  ProjectUnderstanding,
  Simulation,
  SimulationConsent,
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
/** Lancement d'une simulation à partir d'un business plan importé. */
export interface CreateFromDocumentInput {
  name?: string;
  tier: SimulationTier;
  documentName?: string;
  answers?: Record<string, string>;
  understanding: ProjectUnderstanding;
  /** Sans lui, l'API refuse la création du projet et le lancement (403). */
  consent: SimulationConsent;
}

/** Un rapport rendu, prêt à être enregistré par le navigateur. */
export interface ReportDownload {
  blob: Blob;
  fileName: string;
}

export abstract class SimulationGateway {
  /** Projets IDEM que l'utilisateur connecté peut simuler. */
  abstract listProjects(): Observable<LinkedProject[]>;

  /**
   * Lit le projet et renvoie ce qui est su, à chercher, incertain ou manquant.
   * Rien n'est persisté ni facturé à cette étape.
   */
  abstract analyseProject(projectId: string): Observable<ProjectUnderstanding>;

  /**
   * Même sortie, à partir d'un business plan importé.
   *
   * Sans projet : un plan importé ne se rattache à rien. Le projet IDEM qu'il
   * décrit n'est créé qu'au lancement, par `createFromDocument`.
   */
  abstract analyseDocument(file: File): Observable<ProjectUnderstanding>;

  abstract getPricing(
    origin: SimulationOrigin,
    projectId?: string,
  ): Observable<SimulationPricing>;

  abstract listSimulations(projectId: string): Observable<SimulationSummary[]>;

  abstract getSimulation(projectId: string, simulationId: string): Observable<Simulation>;

  abstract createSimulation(input: CreateSimulationInput): Observable<Simulation>;

  /**
   * Crée le projet IDEM décrit par le business plan importé, puis lance la
   * simulation dessus. La compréhension déjà établie est renvoyée telle
   * quelle : le document n'est pas relu.
   */
  abstract createFromDocument(input: CreateFromDocumentInput): Observable<Simulation>;

  /** Émet l'avancement jusqu'à ce que l'exécution atteigne un état terminal. */
  abstract watchSimulation(projectId: string, simulationId: string): Observable<Simulation>;

  abstract getReport(projectId: string, simulationId: string): Observable<SimulationReport>;

  /** Génère le rapport complet d'une exécution achetée sans lui. */
  abstract generateReport(projectId: string, simulationId: string): Observable<SimulationReport>;

  /**
   * Rend le rapport en PDF. Le document est composé par l'API, avec le template
   * IDEM : impossible d'obtenir la même chose depuis l'impression navigateur,
   * qui change de rendu d'un poste à l'autre.
   */
  abstract downloadReport(projectId: string, simulationId: string): Observable<ReportDownload>;

  /** Lance une analyse complémentaire et renvoie la simulation enrichie. */
  abstract runLab(projectId: string, simulationId: string, lab: LabName): Observable<Simulation>;

  abstract deleteSimulation(projectId: string, simulationId: string): Observable<void>;
}
