/**
 * Le client de la boucle, pour les applications (navigateur) : il parle à l'API IDEM (`/journey/*`) avec la
 * session de l'utilisateur (cookie partagé, `credentials: 'include'`). Les recommandations sont calculées par
 * l'API — elle seule voit ce que l'utilisateur a fait dans TOUTES les applications.
 *
 * Aucune erreur ne remonte : une recommandation est un bonus, jamais une raison de casser l'écran.
 */
import type { IdemApp, JourneyDestination, JourneyEventType, JourneyFeedback, Recommendation } from './model';

export interface JourneyClient {
  /** Un geste vient d'avoir lieu ; rend les recommandations qu'il ouvre (déjà triées). */
  record(event: { type: JourneyEventType; app: IdemApp; projectId?: string }, options?: { place?: JourneyDestination; limit?: number }): Promise<Recommendation[]>;
  /** Les recommandations du moment pour cette page. */
  next(options: { app: IdemApp; projectId?: string; place?: JourneyDestination; limit?: number; ambient?: boolean }): Promise<Recommendation[]>;
  /** Ce que l'utilisateur en a fait : la mémoire évite de répéter ce qui a été écarté. */
  feedback(id: string, action: JourneyFeedback, projectId?: string): Promise<void>;
}

export function createJourneyClient(options: { apiUrl: string; headers?: () => Record<string, string> }): JourneyClient {
  const base = options.apiUrl.replace(/\/+$/, '');

  async function call<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    try {
      const response = await fetch(`${base}/journey${path}`, {
        ...init,
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...(options.headers?.() ?? {}), ...((init.headers as Record<string, string>) ?? {}) },
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  return {
    async record(event, extra = {}) {
      const answer = await call<{ recommendations?: Recommendation[] }>('/events', { method: 'POST', body: JSON.stringify({ ...event, ...extra }) });
      return answer?.recommendations ?? [];
    },
    async next({ app, projectId, place, limit, ambient }) {
      const params = new URLSearchParams({ app });
      if (projectId) params.set('projectId', projectId);
      if (place) params.set('place', place);
      if (limit) params.set('limit', String(limit));
      if (ambient) params.set('ambient', '1');
      const answer = await call<{ recommendations?: Recommendation[] }>(`/next?${params.toString()}`);
      return answer?.recommendations ?? [];
    },
    async feedback(id, action, projectId) {
      await call('/feedback', { method: 'POST', body: JSON.stringify({ id, action, projectId }) });
    },
  };
}
