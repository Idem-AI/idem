import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SimulationSummary } from '../models/simulation.model';

/**
 * Accès en lecture aux simulations d'un projet.
 *
 * Le dashboard n'en fait rien d'autre qu'un récapitulatif : lancer, consulter
 * et acheter une simulation appartient au simulateur, qui partage la même
 * session IDEM. D'où la seule méthode de lecture, et l'URL de renvoi.
 */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.services.api.url}/project/simulations`;

  /** Les simulations du projet, de la plus récente à la plus ancienne. */
  listSimulations(projectId: string): Observable<SimulationSummary[]> {
    return this.http
      .get<SimulationSummary[]>(`${this.apiUrl}/${projectId}`, { withCredentials: true })
      .pipe(
        catchError((error) => {
          console.error('Error fetching simulations:', error);
          return of([]);
        }),
      );
  }

  /**
   * URL du simulateur. Sans `simulationId`, on ouvre la création d'une
   * exécution sur ce projet ; la session voyage par le cookie partagé.
   */
  simulatorUrl(projectId: string, simulationId?: string): string {
    const base = environment.services.simulation.url;
    return simulationId
      ? `${base}/simulations/${encodeURIComponent(simulationId)}`
      : `${base}/simulations/new?projectId=${encodeURIComponent(projectId)}`;
  }
}
