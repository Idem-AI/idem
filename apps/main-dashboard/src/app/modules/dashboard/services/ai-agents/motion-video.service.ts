import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, from, shareReplay, switchMap } from 'rxjs';
import { SseClient } from 'ngx-sse-client';
import { TokenService } from '../../../../shared/services/token.service';
import { environment } from '../../../../../environments/environment';
import {
  MotionStyle,
  MotionVideo,
  MusicMood,
  MusicTrack,
  VideoBrief,
  VideoFormat,
  VideoOptions,
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
  createStream(projectId: string, input: { brief: VideoBrief; scope: VideoScope; type: VideoType }): Observable<VideoStreamEvent> {
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

  update(
    projectId: string,
    videoId: string,
    patch: {
      slots?: Record<string, Record<string, string>>;
      style?: MotionStyle;
      musicMood?: MusicMood;
      musicTrackId?: string;
      scope?: Partial<VideoScope>;
      sfx?: boolean;
    },
  ): Observable<MotionVideo> {
    return this.http.patch<MotionVideo>(`${this.apiUrl}/${projectId}/videos/${videoId}`, patch);
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

  /** Photos, clips vidéo, modèles 3D (GLB) et animations Lottie (JSON). */
  uploadMedia(projectId: string, files: File[]): Observable<{ assets: VideoMediaAsset[] }> {
    const form = new FormData();
    files.slice(0, 8).forEach((file) => form.append('files', file));
    return this.http.post<{ assets: VideoMediaAsset[] }>(`${this.apiUrl}/${projectId}/videos/media`, form);
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
