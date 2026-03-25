import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IDeployApplication,
  IDeployDatabase,
  IDeployDockerService,
  IDeployServer,
  IDeployProject,
  IDeploySummary,
} from '../models/ideploy.model';

/**
 * Interface pour la réponse de l'API
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Service pour interagir avec iDeploy via l'API centrale
 * Le frontend ne contacte JAMAIS iDeploy directement
 * Toutes les requêtes passent par l'API centrale qui gère l'authentification
 */
@Injectable({ providedIn: 'root' })
export class IDeployService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.services.api.url}/api/ideploy`;

  /**
   * Récupère toutes les applications via l'API
   * L'authentification se fait automatiquement via les cookies de session
   */
  getApplications(): Observable<IDeployApplication[]> {
    return this.http
      .get<ApiResponse<IDeployApplication[]>>(`${this.apiUrl}/applications`, {
        withCredentials: true,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching applications:', error);
          return of([]);
        }),
      );
  }

  /**
   * Récupère toutes les bases de données via l'API
   */
  getDatabases(): Observable<IDeployDatabase[]> {
    return this.http
      .get<ApiResponse<IDeployDatabase[]>>(`${this.apiUrl}/databases`, {
        withCredentials: true,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching databases:', error);
          return of([]);
        }),
      );
  }

  /**
   * Récupère tous les services Docker via l'API
   */
  getServices(): Observable<IDeployDockerService[]> {
    return this.http
      .get<ApiResponse<IDeployDockerService[]>>(`${this.apiUrl}/services`, {
        withCredentials: true,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching services:', error);
          return of([]);
        }),
      );
  }

  /**
   * Récupère tous les serveurs via l'API
   */
  getServers(): Observable<IDeployServer[]> {
    return this.http
      .get<ApiResponse<IDeployServer[]>>(`${this.apiUrl}/servers`, {
        withCredentials: true,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching servers:', error);
          return of([]);
        }),
      );
  }

  /**
   * Récupère tous les projets via l'API
   */
  getProjects(): Observable<IDeployProject[]> {
    return this.http
      .get<ApiResponse<IDeployProject[]>>(`${this.apiUrl}/projects`, {
        withCredentials: true,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching projects:', error);
          return of([]);
        }),
      );
  }

  /**
   * Récupère un résumé complet de toutes les ressources iDeploy via l'API
   * Cette méthode fait un seul appel API qui agrège toutes les données
   */
  getSummary(): Observable<IDeploySummary> {
    return this.http
      .get<ApiResponse<IDeploySummary>>(`${this.apiUrl}/summary`, {
        withCredentials: true,
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          console.error('Error fetching iDeploy summary:', error);
          return of({
            applications: [],
            databases: [],
            services: [],
            servers: [],
            projects: [],
            stats: {
              totalApplications: 0,
              totalDatabases: 0,
              totalServices: 0,
              totalServers: 0,
              totalProjects: 0,
              runningApplications: 0,
            },
          });
        }),
      );
  }

  /**
   * Vérifie la connexion à iDeploy via l'API
   */
  checkConnection(): Observable<boolean> {
    return this.http
      .get<ApiResponse<{ connected: boolean }>>(`${this.apiUrl}/check-connection`, {
        withCredentials: true,
      })
      .pipe(
        map((response) => response.data.connected),
        catchError(() => of(false)),
      );
  }

  /**
   * Retourne l'URL d'iDeploy pour les redirections
   */
  getIDeployUrl(): string {
    return environment.services.ideploy.url;
  }
}
