import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
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
} from '../../models/motion-video.model';

/** Vidéos de promotion en motion design (module Communication). */
@Injectable({ providedIn: 'root' })
export class MotionVideoService {
  private readonly http = inject(HttpClient);
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

  create(projectId: string, input: { brief: VideoBrief; scope: VideoScope }): Observable<MotionVideo> {
    return this.http.post<MotionVideo>(`${this.apiUrl}/${projectId}/videos`, input);
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

  uploadPhotos(projectId: string, files: File[]): Observable<{ urls: string[] }> {
    const form = new FormData();
    files.slice(0, 6).forEach((file) => form.append('photos', file));
    return this.http.post<{ urls: string[] }>(`${this.apiUrl}/${projectId}/videos/photos`, form);
  }
}
