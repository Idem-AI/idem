import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { SseClient } from 'ngx-sse-client';
import { environment } from '../../../../../environments/environment';
import { TokenService } from '../../../../shared/services/token.service';
import {
  AssistedShare,
  CommunicationContext,
  CommunicationModel,
  CommunicationPlan,
  CommunicationStrategy,
  CommunicationStreamEvent,
  ContentChannel,
  ContentIdea,
  EditorialCalendar,
  Flyer,
  FlyerFormat,
  MomentIdea,
  MomentSuggestion,
  PlanBrief,
  PlanStatus,
  Publication,
  PublicationStatus,
  SocialNetwork,
  StudioConversation,
  StudioStreamEvent,
  VisualIntent,
  VisualOrigin,
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

  /** GET /project/communication/:projectId/moments/suggestions */
  getMomentSuggestions(
    projectId: string,
    opts: { force?: boolean } = {},
  ): Observable<MomentSuggestion[]> {
    const q = opts.force ? '?force=true' : '';
    return this.http
      .get<MomentSuggestion[]>(`${this.apiUrl}/${projectId}/moments/suggestions${q}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST /project/communication/:projectId/moments */
  createMoment(
    projectId: string,
    input: {
      occasion: string;
      occasionDate?: string;
      message?: string;
      intent?: VisualIntent;
      channel?: ContentIdea['channel'];
      source?: 'suggestion' | 'custom';
    },
  ): Observable<MomentIdea> {
    return this.http
      .post<MomentIdea>(`${this.apiUrl}/${projectId}/moments`, input)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST /project/communication/:projectId/publish (assisted) */
  preparePublication(
    projectId: string,
    input: { contentId: string; network: SocialNetwork; flyerId?: string; scheduledFor?: string },
  ): Observable<{ publication: Publication; share: AssistedShare }> {
    return this.http
      .post<{ publication: Publication; share: AssistedShare }>(
        `${this.apiUrl}/${projectId}/publish`,
        input,
      )
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** PUT /project/communication/:projectId/publish/:publicationId */
  updatePublication(
    projectId: string,
    publicationId: string,
    patch: { status?: PublicationStatus; externalUrl?: string; scheduledFor?: string },
  ): Observable<Publication> {
    return this.http
      .put<Publication>(`${this.apiUrl}/${projectId}/publish/${publicationId}`, patch)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** GET on-demand flyer image blob */
  /**
   * PUT le HTML d'un visuel retouché dans l'éditeur WYSIWYG. L'API oublie le PNG
   * en cache : l'`imageUrl` du visuel ne change pas, son contenu si.
   */
  updateFlyerHtml(projectId: string, flyerId: string, html: string): Observable<Flyer> {
    return this.http
      .put<Flyer>(`${this.apiUrl}/${projectId}/flyer/${flyerId}/html`, { html })
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST une consigne de retouche IA sur un visuel ; renvoie le visuel modifié. */
  aiEditFlyer(projectId: string, flyerId: string, instruction: string): Observable<Flyer> {
    return this.http
      .post<Flyer>(`${this.apiUrl}/${projectId}/flyer/${flyerId}/ai-edit`, { instruction })
      .pipe(catchError((err) => throwError(() => err)));
  }

  /**
   * Télécharge le PNG d'un visuel.
   *
   * On passe par l'`imageUrl` que l'API a renvoyée, et non par un chemin
   * reconstruit : cette URL porte le jeton capacitaire qui remplace
   * l'authentification sur cet endpoint (une balise `<img>` ne peut pas envoyer
   * d'en-tête `Authorization`). Un chemin reconstruit à la main serait refusé.
   */
  downloadFlyerImage(imageUrl: string): Observable<Blob> {
    return this.http
      .get(imageUrl, { responseType: 'blob', headers: { Accept: 'image/png' } })
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

  /** @deprecated Le calendrier unique est remplacé par les périodes. */
  buildEmptyCalendar(): EditorialCalendar {
    return { rhythm: 'weekly', horizonWeeks: 4, items: [] };
  }

  // ===========================================================================
  // PÉRIODES
  // ===========================================================================

  /** GET …/plans */
  listPlans(projectId: string): Observable<CommunicationPlan[]> {
    return this.http
      .get<CommunicationPlan[]>(`${this.apiUrl}/${projectId}/plans`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /**
   * POST …/plans — crée une période VIDE.
   *
   * Aucune IA, aucun crédit : l'utilisateur voit d'abord ses dates et les
   * occasions qui y tombent, puis décide de générer. C'est ce qui évite de
   * facturer un plan dont les dates étaient fausses.
   */
  createPlan(
    projectId: string,
    input: {
      name: string;
      objective?: string;
      start: string;
      end: string;
      kind?: 'regular' | 'campaign';
      postsPerWeek?: number;
      channels?: ContentChannel[];
    },
  ): Observable<CommunicationPlan> {
    return this.http
      .post<CommunicationPlan>(`${this.apiUrl}/${projectId}/plans`, input)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** SSE …/plans/:planId/generate — brief puis contenus datés. */
  streamPlanGeneration(projectId: string, planId: string): Observable<CommunicationStreamEvent> {
    return this.streamUrl(`${this.apiUrl}/${projectId}/plans/${planId}/generate`);
  }

  /** PUT …/plans/:planId */
  updatePlan(
    projectId: string,
    planId: string,
    patch: {
      name?: string;
      objective?: string;
      start?: string;
      end?: string;
      postsPerWeek?: number;
      channels?: ContentChannel[];
      status?: PlanStatus;
      brief?: PlanBrief;
    },
  ): Observable<CommunicationPlan> {
    return this.http
      .put<CommunicationPlan>(`${this.apiUrl}/${projectId}/plans/${planId}`, patch)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** DELETE …/plans/:planId — archive, jamais de suppression dure. */
  archivePlan(projectId: string, planId: string): Observable<{ archived: boolean }> {
    return this.http
      .delete<{ archived: boolean }>(`${this.apiUrl}/${projectId}/plans/${planId}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** PUT …/plans/:planId/items/:itemId */
  updatePlanItem(
    projectId: string,
    planId: string,
    itemId: string,
    patch: Partial<ContentIdea>,
  ): Observable<CommunicationPlan> {
    return this.http
      .put<CommunicationPlan>(`${this.apiUrl}/${projectId}/plans/${planId}/items/${itemId}`, patch)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST …/plans/:planId/items — ajout manuel d'un contenu. */
  addPlanItem(
    projectId: string,
    planId: string,
    input: Partial<ContentIdea> & { title: string },
  ): Observable<ContentIdea> {
    return this.http
      .post<ContentIdea>(`${this.apiUrl}/${projectId}/plans/${planId}/items`, input)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** DELETE …/plans/:planId/items/:itemId */
  removePlanItem(
    projectId: string,
    planId: string,
    itemId: string,
  ): Observable<{ removed: boolean }> {
    return this.http
      .delete<{ removed: boolean }>(`${this.apiUrl}/${projectId}/plans/${planId}/items/${itemId}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** GET …/occasions?from&to — gratuit : elles servent à DÉCIDER d'une période. */
  getOccasions(projectId: string, from: string, to: string): Observable<MomentSuggestion[]> {
    const params = new URLSearchParams({ from, to });
    return this.http
      .get<MomentSuggestion[]>(`${this.apiUrl}/${projectId}/occasions?${params.toString()}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ===========================================================================
  // BIBLIOTHÈQUE DE VISUELS
  // ===========================================================================

  /** GET …/visuals — sans le HTML. */
  listVisuals(
    projectId: string,
    filters: { planId?: string; format?: FlyerFormat; origin?: VisualOrigin } = {},
  ): Observable<Flyer[]> {
    const params = new URLSearchParams();
    if (filters.planId) params.set('planId', filters.planId);
    if (filters.format) params.set('format', filters.format);
    if (filters.origin) params.set('origin', filters.origin);
    const query = params.toString();
    return this.http
      .get<Flyer[]>(`${this.apiUrl}/${projectId}/visuals${query ? `?${query}` : ''}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** GET …/visuals/:visualId — HTML compris (éditeur). */
  getVisual(projectId: string, visualId: string): Observable<Flyer> {
    return this.http
      .get<Flyer>(`${this.apiUrl}/${projectId}/visuals/${visualId}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST …/visuals — un visuel libre, depuis un brief en langage naturel. */
  createVisual(
    projectId: string,
    input: {
      brief: string;
      format?: FlyerFormat;
      intent?: VisualIntent;
      withPhoto?: boolean;
      variants?: number;
    },
  ): Observable<Flyer[]> {
    return this.http
      .post<Flyer[]>(`${this.apiUrl}/${projectId}/visuals`, input)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /**
   * DELETE …/visuals/:visualId — suppression définitive.
   *
   * La seule suppression dure du module : on n'archive pas une image ratée, on la
   * jette. Les plannings, eux, portent l'historique et s'archivent.
   */
  deleteVisual(projectId: string, visualId: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(`${this.apiUrl}/${projectId}/visuals/${visualId}`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST …/visuals/:visualId/declinate */
  declinateVisual(
    projectId: string,
    visualId: string,
    formats: FlyerFormat[],
  ): Observable<Flyer[]> {
    return this.http
      .post<Flyer[]>(`${this.apiUrl}/${projectId}/visuals/${visualId}/declinate`, { formats })
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** POST …/visuals/:visualId/schedule */
  scheduleVisual(
    projectId: string,
    visualId: string,
    input: { planId: string; date: string; channel?: ContentChannel; caption?: string },
  ): Observable<ContentIdea> {
    return this.http
      .post<ContentIdea>(`${this.apiUrl}/${projectId}/visuals/${visualId}/schedule`, input)
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ===========================================================================
  // ATELIER
  // ===========================================================================

  /** GET …/studio */
  getStudio(projectId: string): Observable<StudioConversation> {
    return this.http
      .get<StudioConversation>(`${this.apiUrl}/${projectId}/studio`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /** DELETE …/studio — vide le fil ; les visuels produits sont conservés. */
  clearStudio(projectId: string): Observable<{ cleared: boolean }> {
    return this.http
      .delete<{ cleared: boolean }>(`${this.apiUrl}/${projectId}/studio`)
      .pipe(catchError((err) => throwError(() => err)));
  }

  /**
   * POST …/studio/message en SSE.
   *
   * `keepAlive: false` est ESSENTIEL : une reconnexion rejouerait le POST, donc
   * recomposerait un visuel et débiterait une seconde fois. Un tour de chat n'est
   * pas idempotent — contrairement aux générations en GET.
   */
  streamStudioMessage(projectId: string, content: string): Observable<StudioStreamEvent> {
    return from(this.tokenService.getTokenAsync()).pipe(
      switchMap((token: string | null) => {
        return new Observable<StudioStreamEvent>((observer) => {
          const sub = this.sse
            .stream(
              `${this.apiUrl}/${projectId}/studio/message`,
              { keepAlive: false, responseType: 'event' },
              {
                body: { content },
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              },
              'POST',
            )
            .subscribe({
              next: (event: Event) => {
                if (event.type !== 'message') return;
                const message = event as MessageEvent;
                if (!message.data || typeof message.data !== 'string') return;
                try {
                  const payload = JSON.parse(message.data) as StudioStreamEvent;
                  observer.next(payload);
                  if (payload.type === 'complete' || payload.type === 'error') {
                    observer.complete();
                  }
                } catch {
                  /* trame invalide — ignorée */
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
}
