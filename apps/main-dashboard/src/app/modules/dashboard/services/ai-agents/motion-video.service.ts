import { CreativityLevel } from '@idem/shared-models';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, from, shareReplay, switchMap } from 'rxjs';
import { SseClient } from 'ngx-sse-client';
import { TokenService } from '../../../../shared/services/token.service';
import { environment } from '../../../../../environments/environment';
import {
  MotionVideo,
  MusicMood,
  MusicTrack,
  VideoBrief,
  VideoFormat,
  VideoOptions,
  VideoPatch,
  VideoRevisionResult,
  VideoScope,
  VideoMediaAsset,
  VideoType,
  VideoStreamEvent,
} from '../../models/motion-video.model';

/** Vidéos de promotion en motion design (module Communication). */
@Injectable({ providedIn: 'root' })
export class MotionVideoService {
  private readonly http = inject(HttpClient);
  private readonly sse = inject(SseClient);
  private readonly tokenService = inject(TokenService);
  private readonly apiUrl = `${environment.services.api.url}/project/communication`;
  private options$: Observable<VideoOptions> | null = null;

  /** Barème et choix possibles — lus une fois par session. */
  options(projectId: string): Observable<VideoOptions> {
    this.options$ ??= this.http
      .get<VideoOptions>(`${this.apiUrl}/${projectId}/videos/options`)
      .pipe(shareReplay(1));
    return this.options$;
  }

  list(projectId: string): Observable<MotionVideo[]> {
    return this.http.get<MotionVideo[]>(`${this.apiUrl}/${projectId}/videos`);
  }

  get(projectId: string, videoId: string): Observable<MotionVideo> {
    return this.http.get<MotionVideo>(`${this.apiUrl}/${projectId}/videos/${videoId}`);
  }

  create(projectId: string, input: { brief: VideoBrief; scope: VideoScope; type: VideoType }): Observable<MotionVideo> {
    return this.http.post<MotionVideo>(`${this.apiUrl}/${projectId}/videos`, input);
  }

  /**
   * Création en flux : chaque étape réelle arrive dès qu'elle a lieu.
   *
   * `keepAlive: false` est ESSENTIEL : une reconnexion rejouerait le POST, donc
   * créerait (et facturerait) une seconde vidéo.
   */
  /**
   * Crée une vidéo en suivant les étapes en direct. `type: 'auto'` : le modèle
   * choisit le type (ou en combine plusieurs) d'après la demande ; `contentId` :
   * vidéo d'un contenu du calendrier (brief et type viennent du contenu).
   */
  createStream(projectId: string, input: { brief: Partial<VideoBrief>; scope: VideoScope; type: VideoType | 'auto'; contentId?: string; creativity?: CreativityLevel; intent?: VideoIntentOverride; clarification?: { id: string; option: string } }): Observable<VideoStreamEvent> {
    return from(this.tokenService.getTokenAsync()).pipe(
      switchMap(
        (token: string | null) =>
          new Observable<VideoStreamEvent>((observer) => {
            const sub = this.sse
              .stream(
                `${this.apiUrl}/${projectId}/videos/stream`,
                { keepAlive: false, responseType: 'event' },
                {
                  body: input,
                  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                },
                'POST',
              )
              .subscribe({
                next: (event: Event) => {
                  if (event.type === 'error') {
                    // Refus avant le flux (crédits insuffisants, champ manquant) :
                    // la réponse HTTP d'erreur est portée par l'ErrorEvent.
                    const http = (event as ErrorEvent).error as { status?: number; error?: unknown } | undefined;
                    const body = typeof http?.error === 'string' ? safeJson(http.error) : (http?.error as any);
                    observer.next({ type: 'error', error: body?.error || 'video_failed', status: http?.status, cost: body?.cost, balance: body?.balance });
                    observer.complete();
                    return;
                  }
                  if (event.type !== 'message') return;
                  const data = (event as MessageEvent).data;
                  if (typeof data !== 'string' || !data) return;
                  const payload = safeJson(data) as VideoStreamEvent | null;
                  if (!payload) return;
                  observer.next(payload);
                  if (payload.type === 'complete' || payload.type === 'error') observer.complete();
                },
                // L'erreur a déjà été traduite en événement ci-dessus.
                error: () => observer.complete(),
                complete: () => observer.complete(),
              });
            return () => sub.unsubscribe();
          }),
      ),
    );
  }

  /**
   * Retouche gratuite : textes et photos (données, le code des scènes ne change pas), musique,
   * effets, voix, sous-titres — ou une nouvelle version du code d'une scène (`visual`, `fix`, `regenerate`).
   */
  update(projectId: string, videoId: string, patch: VideoPatch): Observable<MotionVideo> {
    return this.http.patch<MotionVideo>(`${this.apiUrl}/${projectId}/videos/${videoId}`, patch);
  }

  /** Une retouche écrite en clair (« la scène 2 plus lente », « sans musique ») : l'IA dit ce qui change. */
  revise(projectId: string, videoId: string, text: string): Observable<VideoRevisionResult> {
    return this.http.post<VideoRevisionResult>(`${this.apiUrl}/${projectId}/videos/${videoId}/revise`, { text });
  }

  /** HTML autonome du lecteur : le même moteur que le MP4. */
  preview(projectId: string, videoId: string, format?: VideoFormat): Observable<{ html: string }> {
    const query = format ? `?format=${format}` : '';
    return this.http.get<{ html: string }>(`${this.apiUrl}/${projectId}/videos/${videoId}/preview${query}`);
  }

  music(projectId: string, videoId: string, mood?: MusicMood): Observable<MusicTrack[]> {
    const query = mood ? `?mood=${mood}` : '';
    return this.http.get<MusicTrack[]>(`${this.apiUrl}/${projectId}/videos/${videoId}/music${query}`);
  }

  export(projectId: string, videoId: string, scope?: Partial<VideoScope>): Observable<MotionVideo> {
    return this.http.post<MotionVideo>(`${this.apiUrl}/${projectId}/videos/${videoId}/export`, { scope });
  }

  delete(projectId: string, videoId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${projectId}/videos/${videoId}`);
  }

  /** Photos et clips vidéo. */
  uploadMedia(projectId: string, files: File[]): Observable<{ assets: VideoMediaAsset[] }> {
    const form = new FormData();
    files.slice(0, 8).forEach((file) => form.append('files', file));
    return this.http.post<{ assets: VideoMediaAsset[] }>(`${this.apiUrl}/${projectId}/videos/media`, form);
  }

  /** « Améliorer ma demande » : réécriture précise, faits conservés (gratuit). */
  /** L'interprétation d'une demande avant création (gratuite) : objectif, matière, mouvement, et la question éventuelle. */
  interpret(projectId: string, input: { brief: Partial<VideoBrief>; type: VideoType | 'auto'; creativity?: CreativityLevel }): Observable<VideoInterpretation> {
    return this.http.post<VideoInterpretation>(`${this.apiUrl}/${projectId}/videos/interpret`, input);
  }

  enhanceRequest(projectId: string, text: string, media: VideoMediaAsset[]): Observable<{ prompt: string; source: 'llm' | 'template' }> {
    return this.http.post<{ prompt: string; source: 'llm' | 'template' }>(`${this.apiUrl}/${projectId}/videos/enhance`, {
      text,
      media: media.map((m) => ({ kind: m.kind })),
    });
  }

  uploadPhotos(projectId: string, files: File[]): Observable<{ urls: string[] }> {
    const form = new FormData();
    files.slice(0, 6).forEach((file) => form.append('photos', file));
    return this.http.post<{ urls: string[] }>(`${this.apiUrl}/${projectId}/videos/photos`, form);
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const VIDEO_GOALS = ['conversion', 'product-demo', 'website-tour', 'explainer', 'brand-film', 'event', 'story', 'announcement', 'repurpose'] as const;
export const PRODUCTION_MODES = ['app-presentation', 'footage-edit', 'pure-motion', 'hybrid', 'product-showcase', 'data-story'] as const;
export const MOTION_LANGUAGES = ['kinetic-type', 'editorial', 'geometric', 'illustration-2d', 'spatial-3d', 'interface', 'cinematic', 'data-led', 'collage', 'minimal-broadcast'] as const;
export type VideoGoal = (typeof VIDEO_GOALS)[number];
export type ProductionMode = (typeof PRODUCTION_MODES)[number];
export type MotionLanguage = (typeof MOTION_LANGUAGES)[number];

/** L'intention lue par le serveur (request/intent.ts) : seuls les champs que l'interface affiche ou corrige. */
export interface VideoIntent {
  objective: VideoGoal;
  productionModes: ProductionMode[];
  motionDirection: MotionLanguage[];
  voiceover: 'yes' | 'no' | 'ask';
  subtitles: 'yes' | 'no' | 'ask';
  confidence: number;
  pipeline: 'motion' | 'montage';
}

/** Ce que l'utilisateur corrige dans l'interprétation. */
export type VideoIntentOverride = Partial<Pick<VideoIntent, 'objective' | 'productionModes' | 'motionDirection'>>;

export interface VideoInterpretation {
  intent: VideoIntent;
  interpretation: { tags: string[]; summary: string };
  clarification: { id: string; question: string; options: { id: string; label: string; description: string }[]; fields?: string[] } | null;
}
