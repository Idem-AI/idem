import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { SseClient } from 'ngx-sse-client';
import { environment } from '../../../../../environments/environment';
import { TokenService } from '../../../../shared/services/token.service';
import {
  CommunicationContext,
  CommunicationModel,
  CommunicationStrategy,
  CommunicationStreamEvent,
  ContentIdea,
  EditorialCalendar,
  Flyer,
  FlyerFormat,
} from '../../models/communication.model';

@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private readonly apiUrl = `${environment.services.api.url}/project/communication`;
  private readonly http = inject(HttpClient);
  private readonly sse = inject(SseClient);
  private readonly tokenService = inject(TokenService);

  /** GET /project/communication/:projectId */
  getCommunication(projectId: string): Observable<CommunicationModel> {
    return this.http
      .get<CommunicationModel>(`${this.apiUrl}/${projectId}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST /project/communication/:projectId/extract-context */
  extractContext(
    projectId: string,
    opts: { force?: boolean } = {},
  ): Observable<CommunicationContext> {
    const q = opts.force ? '?force=true' : '';
    return this.http
      .post<CommunicationContext>(`${this.apiUrl}/${projectId}/extract-context${q}`, {})
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** SSE: strategy generation */
  streamStrategy(
    projectId: string,
    opts: { force?: boolean } = {},
  ): Observable<CommunicationStreamEvent> {
    const q = opts.force ? '?force=true' : '';
    return this.streamUrl(`${this.apiUrl}/${projectId}/generate-strategy${q}`);
  }

  /** SSE: calendar generation */
  streamCalendar(
    projectId: string,
    opts: {
      force?: boolean;
      rhythm?: 'weekly' | 'biweekly' | 'monthly';
      horizonWeeks?: number;
    } = {},
  ): Observable<CommunicationStreamEvent> {
    const params = new URLSearchParams();
    if (opts.force) params.set('force', 'true');
    if (opts.rhythm) params.set('rhythm', opts.rhythm);
    if (opts.horizonWeeks) params.set('horizonWeeks', String(opts.horizonWeeks));
    const q = params.toString();
    return this.streamUrl(`${this.apiUrl}/${projectId}/generate-calendar${q ? `?${q}` : ''}`);
  }

  /** PUT strategy */
  updateStrategy(
    projectId: string,
    strategy: CommunicationStrategy,
  ): Observable<CommunicationModel> {
    return this.http
      .put<CommunicationModel>(`${this.apiUrl}/${projectId}/strategy`, strategy)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** PUT single calendar item */
  updateCalendarItem(
    projectId: string,
    contentId: string,
    updates: Partial<ContentIdea>,
  ): Observable<CommunicationModel> {
    return this.http
      .put<CommunicationModel>(`${this.apiUrl}/${projectId}/calendar/${contentId}`, updates)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST on-demand flyer generation */
  generateFlyer(projectId: string, contentId: string, format: FlyerFormat): Observable<Flyer> {
    return this.http
      .post<Flyer>(`${this.apiUrl}/${projectId}/flyer/${contentId}`, { format })
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST force flyer regeneration */
  regenerateFlyer(projectId: string, contentId: string, format: FlyerFormat): Observable<Flyer> {
    return this.http
      .post<Flyer>(`${this.apiUrl}/${projectId}/flyer/${contentId}/regenerate`, { format })
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private streamUrl(url: string): Observable<CommunicationStreamEvent> {
    return from(this.tokenService.getTokenAsync()).pipe(
      switchMap((token: string | null) => {
        return new Observable<CommunicationStreamEvent>((observer) => {
          const requestOptions = token
            ? { headers: { Authorization: `Bearer ${token}` } }
            : undefined;

          const sub = this.sse
            .stream(url, { keepAlive: true, reconnectionDelay: 1000 }, requestOptions)
            .subscribe({
              next: (event: Event) => {
                if (event.type !== 'message') return;
                const message = event as MessageEvent;
                if (!message.data || typeof message.data !== 'string') return;
                try {
                  const payload = JSON.parse(message.data) as CommunicationStreamEvent;
                  observer.next(payload);
                  if (payload.type === 'complete' || payload.type === 'error') {
                    observer.complete();
                  }
                } catch {
                  // ignore invalid frames
                }
              },
              error: (err) => observer.error(err),
              complete: () => observer.complete(),
            });
          return () => sub.unsubscribe();
        });
      }),
    );
  }

  /** Editable calendar model helpers */
  buildEmptyCalendar(): EditorialCalendar {
    return { rhythm: 'weekly', horizonWeeks: 4, items: [] };
  }
}
