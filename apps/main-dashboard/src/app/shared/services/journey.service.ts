import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { IdemApp, JourneyClient, JourneyDestination, JourneyEventType, JourneyFeedback, Recommendation } from '@idem/shared-journey';
import { environment } from '../../../environments/environment';

/**
 * La boucle IDEM côté dashboard : le même contrat que le client du paquet partagé (`JourneyClient`), passé
 * par `HttpClient` pour bénéficier de l'authentification de l'application. Une erreur ne remonte jamais : une
 * recommandation absente n'est pas une panne.
 */
@Injectable({ providedIn: 'root' })
export class JourneyService implements JourneyClient {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.services.api.url.replace(/\/+$/, '')}/journey`;

  async record(event: { type: JourneyEventType; app: IdemApp; projectId?: string }, options: { place?: JourneyDestination; limit?: number } = {}): Promise<Recommendation[]> {
    try {
      const answer = await firstValueFrom(this.http.post<{ recommendations?: Recommendation[] }>(`${this.base}/events`, { ...event, ...options }));
      return answer.recommendations ?? [];
    } catch {
      return [];
    }
  }

  async next(options: { app: IdemApp; projectId?: string; place?: JourneyDestination; limit?: number; ambient?: boolean }): Promise<Recommendation[]> {
    let params = new HttpParams().set('app', options.app);
    if (options.projectId) params = params.set('projectId', options.projectId);
    if (options.place) params = params.set('place', options.place);
    if (options.limit) params = params.set('limit', String(options.limit));
    if (options.ambient) params = params.set('ambient', '1');
    try {
      const answer = await firstValueFrom(this.http.get<{ recommendations?: Recommendation[] }>(`${this.base}/next`, { params }));
      return answer.recommendations ?? [];
    } catch {
      return [];
    }
  }

  async feedback(id: string, action: JourneyFeedback, projectId?: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.base}/feedback`, { id, action, projectId }));
    } catch {
      /* la mémoire des refus est un confort */
    }
  }
}
