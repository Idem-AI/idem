import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, map, switchMap, takeWhile, timer } from 'rxjs';

import { environment } from '@env';

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
import { SimulationGateway } from './simulation.gateway';

/** Le pipeline dure plusieurs minutes ; on interroge sans saturer l'API. */
const POLL_INTERVAL_MS = 4000;

/**
 * Implémentation HTTP, branchée sur les routes `/project/simulations/...`
 * exposées par l'API IDEM.
 */
@Injectable()
export class HttpSimulationGateway extends SimulationGateway {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.services.api.url;

  private base(projectId: string): string {
    return `${this.apiUrl}/project/simulations/${projectId}`;
  }

  override listProjects(): Observable<LinkedProject[]> {
    return this.http
      .get<Record<string, unknown>[]>(`${this.apiUrl}/projects`, { withCredentials: true })
      .pipe(map((projects) => projects.map((project) => toLinkedProject(project))));
  }

  override analyseProject(projectId: string): Observable<ProjectUnderstanding> {
    return this.http.post<ProjectUnderstanding>(
      `${this.base(projectId)}/analysis`,
      {},
      { withCredentials: true }
    );
  }

  override analyseDocument(projectId: string, file: File): Observable<ProjectUnderstanding> {
    const body = new FormData();
    body.append('document', file);
    return this.http.post<ProjectUnderstanding>(`${this.base(projectId)}/analysis`, body, {
      withCredentials: true,
    });
  }

  override getPricing(
    projectId: string,
    origin: SimulationOrigin
  ): Observable<SimulationPricing> {
    return this.http.get<SimulationPricing>(`${this.base(projectId)}/pricing`, {
      params: { origin },
      withCredentials: true,
    });
  }

  override listSimulations(projectId: string): Observable<SimulationSummary[]> {
    return this.http.get<SimulationSummary[]>(this.base(projectId), { withCredentials: true });
  }

  override getSimulation(projectId: string, simulationId: string): Observable<Simulation> {
    return this.http.get<Simulation>(`${this.base(projectId)}/${simulationId}`, {
      withCredentials: true,
    });
  }

  override createSimulation(input: CreateSimulationInput): Observable<Simulation> {
    const { projectId, ...body } = input;
    return this.http.post<Simulation>(this.base(projectId), body, { withCredentials: true });
  }

  override watchSimulation(projectId: string, simulationId: string): Observable<Simulation> {
    // Interrogation régulière plutôt que SSE : cela traverse sans histoire les
    // proxys et CDN placés devant l'API.
    const poll = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS).pipe(
      switchMap(() => this.getSimulation(projectId, simulationId))
    );
    return concat(this.getSimulation(projectId, simulationId), poll).pipe(
      takeWhile((simulation) => simulation.status === 'running', true)
    );
  }

  override getReport(projectId: string, simulationId: string): Observable<SimulationReport> {
    return this.http.get<SimulationReport>(`${this.base(projectId)}/${simulationId}/report`, {
      withCredentials: true,
    });
  }

  override generateReport(projectId: string, simulationId: string): Observable<SimulationReport> {
    return this.http.post<SimulationReport>(
      `${this.base(projectId)}/${simulationId}/report`,
      {},
      { withCredentials: true }
    );
  }

  override runLab(
    projectId: string,
    simulationId: string,
    lab: LabName
  ): Observable<Simulation> {
    return this.http.post<Simulation>(
      `${this.base(projectId)}/${simulationId}/labs/${lab}`,
      {},
      { withCredentials: true }
    );
  }

  override deleteSimulation(projectId: string, simulationId: string): Observable<void> {
    return this.http.delete<void>(`${this.base(projectId)}/${simulationId}`, {
      withCredentials: true,
    });
  }
}

/**
 * L'API projet renvoie le modèle IDEM complet ; on n'en garde que ce que
 * l'écran de sélection affiche, et on déduit les livrables disponibles de la
 * présence des sections d'analyse.
 */
function toLinkedProject(project: Record<string, unknown>): LinkedProject {
  const analysis = (project['analysisResultModel'] ?? {}) as Record<string, unknown>;
  const assets: string[] = [];
  const deliverables: [string, string][] = [
    ['businessPlan', 'Business plan'],
    ['marketAnalysis', 'Analyse de marché'],
    ['finance', 'Prévisions financières'],
    ['branding', 'Identité de marque'],
    ['communication', 'Marketing & communication'],
    ['legalDocs', 'Juridique'],
    ['pitchDeck', 'Pitch deck'],
    ['development', 'Site web / application'],
    ['diagrams', 'Diagrammes'],
    ['deployment', 'Déploiement'],
  ];
  for (const [key, label] of deliverables) {
    if (analysis[key]) assets.push(label);
  }

  return {
    id: String(project['id'] ?? ''),
    name: String(project['name'] ?? ''),
    description: String(project['description'] ?? ''),
    sector: String(project['type'] ?? project['scope'] ?? ''),
    availableAssets: assets,
    updatedAt: String(project['updatedAt'] ?? project['createdAt'] ?? new Date().toISOString()),
  };
}
