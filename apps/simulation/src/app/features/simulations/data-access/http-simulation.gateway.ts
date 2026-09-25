import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, map, switchMap, takeWhile, timer } from 'rxjs';

import { environment } from '@env';

import {
  CreateSimulationInput,
  LabName,
  LinkedProject,
  ProjectInputs,
  ProjectUnderstanding,
  Simulation,
  SimulationOrigin,
  SimulationPricing,
  SimulationReport,
  SimulationSummary,
} from '../models';
import {
  CreateFromDocumentInput,
  ReportDownload,
  SimulationGateway,
} from './simulation.gateway';

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

  /** Routes du parcours « business plan importé », sans projet. */
  private readonly importBase = `${this.apiUrl}/project/simulations/import`;

  private base(projectId: string): string {
    return `${this.apiUrl}/project/simulations/${projectId}`;
  }

  override listProjects(): Observable<LinkedProject[]> {
    return this.http
      .get<Record<string, unknown>[]>(`${this.apiUrl}/projects`, { withCredentials: true })
      .pipe(map((projects) => projects.map((project) => toLinkedProject(project))));
  }

  override getProjectInputs(projectId: string): Observable<ProjectInputs> {
    return this.http.get<ProjectInputs>(`${this.base(projectId)}/inputs`, {
      withCredentials: true,
    });
  }

  override analyseProject(projectId: string): Observable<ProjectUnderstanding> {
    return this.http.post<ProjectUnderstanding>(
      `${this.base(projectId)}/analysis`,
      {},
      { withCredentials: true }
    );
  }

  override analyseDocument(file: File): Observable<ProjectUnderstanding> {
    const body = new FormData();
    body.append('document', file);
    // Sans projet : le plan importé n'en a pas encore. L'API refuse ici un
    // format non géré (415) ou un document qui n'est pas un business plan
    // (422), avec un message destiné à l'utilisateur.
    return this.http.post<ProjectUnderstanding>(`${this.importBase}/analysis`, body, {
      withCredentials: true,
    });
  }

  override getPricing(
    origin: SimulationOrigin,
    projectId?: string
  ): Observable<SimulationPricing> {
    const url = projectId ? `${this.base(projectId)}/pricing` : `${this.importBase}/pricing`;
    return this.http.get<SimulationPricing>(url, {
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

  override createFromDocument(input: CreateFromDocumentInput): Observable<Simulation> {
    return this.http.post<Simulation>(`${this.importBase}/run`, input, {
      withCredentials: true,
    });
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

  override downloadReport(projectId: string, simulationId: string): Observable<ReportDownload> {
    return this.http
      .get(`${this.base(projectId)}/${simulationId}/report/pdf`, {
        withCredentials: true,
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((response) => ({
          blob: response.body as Blob,
          // L'API nomme le fichier ; on retombe sur un nom neutre si l'en-tête
          // n'a pas traversé (CORS, proxy).
          fileName: fileNameFrom(response.headers.get('Content-Disposition')) ?? 'rapport-simulation.pdf',
        })),
      );
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

  override resumeSimulation(projectId: string, simulationId: string): Observable<Simulation> {
    return this.http.post<Simulation>(
      `${this.base(projectId)}/${simulationId}/resume`,
      {},
      { withCredentials: true }
    );
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
  // Business plans et pitch decks vivent en collections (`businessPlans`,
  // `pitchDecks`) ; l'ancien emplacement unique reste sur les projets que rien
  // n'a modifiés depuis. Les deux comptent.
  const deliverables: [string[], string][] = [
    [['businessPlans', 'businessPlan'], 'Business plan'],
    [['marketAnalysis'], 'Analyse de marché'],
    [['finance'], 'Prévisions financières'],
    [['branding'], 'Identité de marque'],
    [['communication'], 'Marketing & communication'],
    [['legalDocs'], 'Juridique'],
    [['pitchDecks', 'pitchDeck'], 'Pitch deck'],
    [['development'], 'Site web / application'],
    [['diagrams'], 'Diagrammes'],
    [['deployment'], 'Déploiement'],
  ];
  for (const [keys, label] of deliverables) {
    if (keys.some((key) => isDeliverablePresent(key, analysis[key]))) assets.push(label);
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

/**
 * Vrai quand un livrable existe VRAIMENT, et pas seulement en tant qu'objet.
 *
 * Trois sections ne peuvent pas se juger par leur simple présence, et ce sont
 * précisément les trois sur lesquelles une simulation s'appuie :
 *   · `finance` s'écrit dès la première ouverture du module, garni de ses
 *     valeurs d'usine (barèmes d'impôt, durées d'amortissement) ;
 *   · `communication` existe dès qu'un visuel a été produit dans l'atelier,
 *     sans qu'aucune stratégie n'ait été définie ;
 *   · un business plan existe dès qu'on a choisi son sommaire.
 *
 * Les compter comme présents faisait afficher « Prévisions financières » sous
 * un projet qui n'en a pas une seule ligne — et, depuis que l'écran avertit des
 * livrables manquants, faisait dire deux choses contraires sur le même écran.
 * Ces règles sont celles de `services/common/project-inputs.ts` côté API.
 */
function isDeliverablePresent(key: string, value: unknown): boolean {
  if (Array.isArray(value)) {
    return key === 'businessPlans' || key === 'pitchDecks'
      ? value.some((document) => hasFilledSection(document))
      : value.length > 0;
  }
  if (!value) return false;

  if (key === 'businessPlan' || key === 'pitchDeck') {
    return hasFilledSection(value);
  }
  if (key === 'finance') {
    const finance = value as { products?: unknown[]; salesObjectives?: unknown[] };
    return (finance.products?.length ?? 0) > 0 && (finance.salesObjectives?.length ?? 0) > 0;
  }
  if (key === 'communication') {
    const strategy = (value as { strategy?: { summary?: string; blocks?: { body?: string }[] } })
      .strategy;
    if (!strategy) return false;
    return (
      (strategy.summary ?? '').trim().length > 0 ||
      (strategy.blocks ?? []).some((block) => (block?.body ?? '').trim().length > 0)
    );
  }
  return true;
}

/** Vrai quand au moins une section du document porte du contenu. */
function hasFilledSection(document: unknown): boolean {
  const sections = (document as { sections?: { data?: unknown }[] } | null)?.sections ?? [];
  return sections.some((section) =>
    typeof section?.data === 'string' ? section.data.trim().length > 0 : section?.data != null,
  );
}

/** Extrait le nom de fichier d'un en-tête `Content-Disposition`. */
function fileNameFrom(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}
