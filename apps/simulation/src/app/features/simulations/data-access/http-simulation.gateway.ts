import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concat, timer } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';

import { environment } from '@env';

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
import { SimulationGateway } from './simulation.gateway';

const POLL_INTERVAL_MS = 4000;

/** Talks to the IDEM simulation API. */
@Injectable()
export class HttpSimulationGateway extends SimulationGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.services.api.url}/simulations`;
  private readonly projectsUrl = `${environment.services.api.url}/projects`;

  override listProjects(): Observable<LinkedProject[]> {
    return this.http.get<LinkedProject[]>(`${this.projectsUrl}/simulatable`, {
      withCredentials: true,
    });
  }

  override analyseProject(projectId: string): Observable<ProjectUnderstanding> {
    return this.http.post<ProjectUnderstanding>(
      `${this.baseUrl}/analysis`,
      { projectId },
      { withCredentials: true },
    );
  }

  override analyseDocument(file: File): Observable<ProjectUnderstanding> {
    const body = new FormData();
    body.append('document', file);
    return this.http.post<ProjectUnderstanding>(`${this.baseUrl}/analysis`, body, {
      withCredentials: true,
    });
  }

  override getPricing(origin: SimulationOrigin): Observable<SimulationPricing> {
    return this.http.get<SimulationPricing>(`${this.baseUrl}/pricing`, {
      params: { origin },
      withCredentials: true,
    });
  }

  override listSimulations(): Observable<SimulationSummary[]> {
    return this.http.get<SimulationSummary[]>(this.baseUrl, { withCredentials: true });
  }

  override getSimulation(id: string): Observable<Simulation> {
    return this.http.get<Simulation>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  override createSimulation(input: CreateSimulationInput): Observable<Simulation> {
    return this.http.post<Simulation>(this.baseUrl, input, { withCredentials: true });
  }

  override watchSimulation(id: string): Observable<Simulation> {
    // Polling rather than SSE: a run takes minutes, and this keeps the app
    // working through the proxies and CDNs in front of the API.
    const poll = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS).pipe(
      switchMap(() => this.getSimulation(id)),
    );
    return concat(this.getSimulation(id), poll).pipe(
      takeWhile((simulation) => simulation.status === 'running', true),
    );
  }

  override getReport(id: string): Observable<SimulationReport> {
    return this.http.get<SimulationReport>(`${this.baseUrl}/${id}/report`, {
      withCredentials: true,
    });
  }

  override purchaseReport(id: string): Observable<Simulation> {
    return this.http
      .post<Simulation>(`${this.baseUrl}/${id}/report`, {}, { withCredentials: true })
      .pipe(map((simulation) => ({ ...simulation, hasReport: true })));
  }
}
