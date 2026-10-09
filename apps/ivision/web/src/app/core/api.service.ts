import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { readLocaleCookie } from './locale-cookie';
import { Brand, ChatEvent, ChatMode, ChatOptions, ChatSession, MediaAsset, MotionVideo, Reference, SessionSummary, VideoOptions, Visual } from './models';

/** Le client de l'API iVision (`/v1`). Les flux (conversation, scan) passent par `fetch`. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.api.url}/v1`;

  me() {
    return this.http.get<{ user: { uid: string; email: string; displayName?: string }; credits: number | null; plan: string | null }>(`${this.base}/me`);
  }

  // ── Marques ──
  brands() {
    return this.http.get<{ brands: Brand[] }>(`${this.base}/brands`);
  }
  brand(id: string) {
    return this.http.get<Brand>(`${this.base}/brands/${id}`);
  }
  chooseProposals(id: string, choice: { palette?: string; typography?: string; name?: string }) {
    return this.http.post<Brand>(`${this.base}/brands/${id}/choose`, choice);
  }
  updateBrand(id: string, patch: Record<string, unknown>) {
    return this.http.patch<Brand>(`${this.base}/brands/${id}`, patch);
  }
  createBrand(body: { name: string; colors?: Record<string, string>; display?: string; body?: string }) {
    return this.http.post<Brand>(`${this.base}/brands`, body);
  }
  importIdem(projectId: string) {
    return this.http.post<Brand>(`${this.base}/brands/import-idem`, { projectId });
  }
  deleteBrand(id: string) {
    return this.http.delete<void>(`${this.base}/brands/${id}`);
  }
  addPhotos(id: string, files: File[]) {
    const form = new FormData();
    files.forEach((f) => form.append('photos', f));
    return this.http.post<Brand>(`${this.base}/brands/${id}/photos`, form);
  }
  idemProjects() {
    return this.http.get<{ projects: { id: string; name: string; hasBrand: boolean; primary?: string }[] }>(`${this.base}/idem/projects`);
  }
  /** Scan d'un site hors conversation (page « Marques ») : étapes en direct. */
  scan(url: string): Observable<ChatEvent> {
    return this.stream(`${this.base}/brands/scan`, { url });
  }

  // ── Conversations ──
  sessions(mode?: ChatMode) {
    return this.http.get<{ sessions: SessionSummary[] }>(`${this.base}/sessions`, { params: mode ? { mode } : {} });
  }
  createSession(mode: ChatMode, brandId?: string) {
    return this.http.post<ChatSession>(`${this.base}/sessions`, { mode, ...(brandId ? { brandId } : {}) });
  }
  session(id: string) {
    return this.http.get<ChatSession>(`${this.base}/sessions/${id}`);
  }
  setSessionBrand(id: string, brandId: string) {
    return this.http.patch<ChatSession>(`${this.base}/sessions/${id}`, { brandId });
  }
  deleteSession(id: string) {
    return this.http.delete<void>(`${this.base}/sessions/${id}`);
  }
  turn(id: string, body: { text?: string; referenceId?: string; noReference?: boolean; media?: MediaAsset[]; photoUrl?: string; options?: ChatOptions; resume?: boolean }): Observable<ChatEvent> {
    return this.stream(`${this.base}/sessions/${id}/turn`, body);
  }
  quote(mode: ChatMode, creativity: string, scope?: unknown) {
    return this.http.post<{ action: string; cost: number }>(`${this.base}/quote`, { mode, creativity, scope });
  }

  // ── Modèles ──
  uploadReference(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Reference>(`${this.base}/references`, form);
  }
  references() {
    return this.http.get<{ references: Reference[] }>(`${this.base}/references`);
  }
  reference(id: string) {
    return this.http.get<Reference>(`${this.base}/references/${id}`);
  }
  sheetUrl(id: string, index: number): string {
    return `${this.base}/references/${id}/sheets/${index}`;
  }

  // ── Vidéos ──
  videoOptions() {
    return this.http.get<VideoOptions>(`${this.base}/videos/options`);
  }
  uploadMedia(brandId: string, files: File[]) {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return this.http.post<{ assets: MediaAsset[] }>(`${this.base}/brands/${brandId}/media`, form);
  }
  video(brandId: string, videoId: string) {
    return this.http.get<MotionVideo>(`${this.base}/brands/${brandId}/videos/${videoId}`);
  }
  videos(brandId: string) {
    return this.http.get<{ videos: MotionVideo[] }>(`${this.base}/brands/${brandId}/videos`);
  }
  updateVideo(brandId: string, videoId: string, patch: Record<string, unknown>) {
    return this.http.patch<MotionVideo>(`${this.base}/brands/${brandId}/videos/${videoId}`, patch);
  }
  preview(brandId: string, videoId: string, format?: string) {
    return this.http.get<{ html: string }>(`${this.base}/brands/${brandId}/videos/${videoId}/preview`, { params: format ? { format } : {} });
  }
  exportQuote(brandId: string, videoId: string, scope: unknown) {
    return this.http.post<{ cost: number }>(`${this.base}/brands/${brandId}/videos/${videoId}/export-quote`, { scope });
  }
  exportVideo(brandId: string, videoId: string, scope: unknown) {
    return this.http.post<MotionVideo>(`${this.base}/brands/${brandId}/videos/${videoId}/export`, { scope });
  }

  // ── Visuels ──
  visuals(brandId?: string) {
    return this.http.get<{ visuals: Visual[] }>(`${this.base}/visuals`, { params: brandId ? { brandId } : {} });
  }
  visual(id: string) {
    return this.http.get<Visual & { html: string }>(`${this.base}/visuals/${id}`);
  }

  /**
   * Un flux SSE en POST (EventSource ne sait faire que du GET) : chaque événement est émis dès
   * qu'il arrive ; l'abonnement annulé coupe la requête.
   */
  private stream(url: string, body: unknown): Observable<ChatEvent> {
    return new Observable<ChatEvent>((subscriber) => {
      const controller = new AbortController();
      (async () => {
        const res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'Accept-Language': readLocaleCookie() ?? 'fr' },
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) {
          const payload = await res.json().catch(() => ({}));
          subscriber.next({ type: 'error', error: payload.error || `http_${res.status}`, message: payload.message || '' });
          subscriber.complete();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const data = chunk.split('\n').find((l) => l.startsWith('data: '));
            if (data) subscriber.next(JSON.parse(data.slice(6)) as ChatEvent);
          }
        }
        subscriber.complete();
      })().catch((error: Error) => {
        if (error.name === 'AbortError') return;
        subscriber.next({ type: 'error', error: 'network', message: '' });
        subscriber.complete();
      });
      return () => controller.abort();
    });
  }
}
