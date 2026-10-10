import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { readLocaleCookie } from './locale-cookie';
import { Brand, ChatEvent, ChatMode, ChatOptions, ChatSession, MediaAsset, Montage, MontageUpload, MotionVideo, Reference, SessionSummary, VideoOptions, Visual } from './models';

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
  /** Des couleurs choisies sans charte : une marque provisoire. */
  autoBrand(colors?: Record<string, string>) {
    return this.http.post<Brand>(`${this.base}/brands/auto`, { colors });
  }
  /** Une charte (PDF) ou un logo (image) : couleurs, polices et logo lus. */
  brandFromFile(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Brand & { found: { kind: string; colors: number; fonts: string[]; logo: boolean } }>(`${this.base}/brands/from-file`, form);
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

  // ── Montages ──
  montageStatus() {
    return this.http.get<{ available: boolean; limits: { maxBytes: number; maxDurationSec: number; minDurationSec: number } }>(`${this.base}/montages/status`);
  }
  montageQuote(durationSec: number, creativity: string) {
    return this.http.post<{ cost: number }>(`${this.base}/montages/quote`, { durationSec, creativity });
  }
  montages(brandId?: string) {
    return this.http.get<{ montages: Montage[] }>(`${this.base}/montages`, { params: brandId ? { brandId } : {} });
  }
  /** Dépôt des vidéos (une ou plusieurs) : les événements d'envoi (progression) puis la réponse. */
  uploadMontageVideos(files: File[]): Observable<HttpEvent<{ uploads: MontageUpload[] }>> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return this.http.post<{ uploads: MontageUpload[] }>(`${this.base}/montages/uploads`, form, { reportProgress: true, observe: 'events' });
  }
  createMontage(body: { inputs: { url: string; name?: string; posterUrl?: string }[]; prompt?: string; brandId?: string; format?: string; creativity?: string; cuts?: string; music?: boolean }) {
    return this.http.post<Montage>(`${this.base}/montages`, body);
  }
  /** Un retour écrit dans la conversation du montage. */
  sendMontageMessage(id: string, text: string) {
    return this.http.post<Montage>(`${this.base}/montages/${id}/messages`, { text });
  }
  montage(id: string) {
    return this.http.get<Montage>(`${this.base}/montages/${id}`);
  }
  updateMontage(id: string, patch: Record<string, unknown>) {
    return this.http.patch<Montage>(`${this.base}/montages/${id}`, patch);
  }
  montagePreview(id: string) {
    return this.http.get<{ html: string }>(`${this.base}/montages/${id}/preview`);
  }
  montageExportQuote(id: string) {
    return this.http.post<{ cost: number }>(`${this.base}/montages/${id}/export-quote`, {});
  }
  exportMontage(id: string) {
    return this.http.post<Montage>(`${this.base}/montages/${id}/export`, {});
  }
  deleteMontage(id: string) {
    return this.http.delete<void>(`${this.base}/montages/${id}`);
  }

  // ── Visuels ──
  visuals(brandId?: string) {
    return this.http.get<{ visuals: Visual[] }>(`${this.base}/visuals`, { params: brandId ? { brandId } : {} });
  }
  /**
   * Télécharge un fichier (visuel, MP4) en pièce jointe et l'enregistre : il n'est jamais ouvert
   * dans un nouvel onglet. Le nom vient de l'API (`Content-Disposition`).
   */
  saveFile(path: string, fallbackName: string): Observable<void> {
    return new Observable<void>((sub) => {
      const req = this.http.get(`${this.base}${path}`, { responseType: 'blob', observe: 'response' }).subscribe({
        next: (res) => {
          const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || fallbackName;
          const url = URL.createObjectURL(res.body as Blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          sub.next();
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
      return () => req.unsubscribe();
    });
  }
  visual(id: string) {
    return this.http.get<Visual & { html: string }>(`${this.base}/visuals/${id}`);
  }
  /** HTML retouché dans l'éditeur : l'API l'enregistre et re-rend l'image. */
  saveVisualHtml(id: string, html: string) {
    return this.http.put<Visual & { html: string }>(`${this.base}/visuals/${id}/html`, { html });
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
