import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IDeployApplication,
  IDeployDatabase,
  IDeployDockerService,
  IDeployServer,
  IDeployProject,
  IDeploySummary,
} from '../models/ideploy.model';

@Injectable({ providedIn: 'root' })
export class IDeployService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.services.ideploy.url}/api/v1`;
  private readonly token = environment.services.ideploy.apiToken;

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}`, Accept: 'application/json' });
  }

  getApplications(): Observable<IDeployApplication[]> {
    return this.http.get<IDeployApplication[]>(`${this.baseUrl}/applications`, { headers: this.headers }).pipe(catchError(() => of([])));
  }

  getDatabases(): Observable<IDeployDatabase[]> {
    return this.http.get<IDeployDatabase[]>(`${this.baseUrl}/databases`, { headers: this.headers }).pipe(catchError(() => of([])));
  }

  getServices(): Observable<IDeployDockerService[]> {
    return this.http.get<IDeployDockerService[]>(`${this.baseUrl}/services`, { headers: this.headers }).pipe(catchError(() => of([])));
  }

  getServers(): Observable<IDeployServer[]> {
    return this.http.get<IDeployServer[]>(`${this.baseUrl}/servers`, { headers: this.headers }).pipe(catchError(() => of([])));
  }

  getProjects(): Observable<IDeployProject[]> {
    return this.http.get<IDeployProject[]>(`${this.baseUrl}/projects`, { headers: this.headers }).pipe(catchError(() => of([])));
  }

  getSummary(): Observable<IDeploySummary> {
    return forkJoin({
      applications: this.getApplications(),
      databases: this.getDatabases(),
      services: this.getServices(),
      servers: this.getServers(),
      projects: this.getProjects(),
    }).pipe(
      map(({ applications, databases, services, servers, projects }) => ({
        applications: [...applications].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
        databases,
        services,
        servers,
        projects,
        stats: {
          totalApplications: applications.length,
          totalDatabases: databases.length,
          totalServices: services.length,
          totalServers: servers.length,
          totalProjects: projects.length,
          runningApplications: applications.filter(a => a.status?.toLowerCase().startsWith('running')).length,
        },
      })),
    );
  }

  getIDeployUrl(): string {
    return environment.services.ideploy.url;
  }
}
