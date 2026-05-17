import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  AISuggestion,
  FinanceComputed,
  FinanceModel,
  FinanceSectionKey,
  FinanceSummaryResponse,
} from '../models/finance.model';

/** Intent finance retournée par /chat/parse */
export interface FinanceChatIntent {
  isFinanceIntent: boolean;
  kind: 'read_summary' | 'read_section' | 'update_field' | 'add_line' | 'delete_line' | 'none';
  section?: FinanceSectionKey | null;
  target?: string | null;
  fieldPath?: string | null;
  value?: number | string | null;
  month?: number | null;
  year?: number | null;
  confirmationSentence?: string | null;
  summaryText?: string | null;
}

export interface FinanceAutoFillResult {
  finance: FinanceModel;
  suggestionsAdded: AISuggestion[];
}

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly baseUrl = `${environment.services.api.url}/project/finance`;
  private readonly http = inject(HttpClient);

  /** Récupère le modèle Finance complet (avec snapshot calculé) */
  getFinance(projectId: string): Observable<FinanceModel> {
    return this.http.get<FinanceModel>(`${this.baseUrl}/${projectId}`).pipe(
      catchError((error) => {
        console.error(`[FinanceService] getFinance(${projectId}) failed`, error);
        return throwError(() => error);
      }),
    );
  }

  /** Résumé synthétique pour le dashboard d'accueil + chat */
  getSummary(projectId: string): Observable<FinanceSummaryResponse> {
    return this.http.get<FinanceSummaryResponse>(`${this.baseUrl}/${projectId}/summary`).pipe(
      catchError((error) => {
        console.error(`[FinanceService] getSummary(${projectId}) failed`, error);
        return throwError(() => error);
      }),
    );
  }

  /** Remplace l'intégralité du modèle Finance (auto-fill global IA) */
  replaceFinance(projectId: string, payload: Partial<FinanceModel>): Observable<FinanceModel> {
    return this.http.put<FinanceModel>(`${this.baseUrl}/${projectId}`, payload).pipe(
      tap(() => console.log(`[FinanceService] replaceFinance(${projectId}) OK`)),
      catchError((error) => {
        console.error(`[FinanceService] replaceFinance(${projectId}) failed`, error);
        return throwError(() => error);
      }),
    );
  }

  /** Met à jour une section précise */
  updateSection<K extends FinanceSectionKey>(
    projectId: string,
    section: K,
    payload: FinanceModel[K],
  ): Observable<FinanceModel> {
    return this.http
      .patch<FinanceModel>(`${this.baseUrl}/${projectId}/section/${section}`, payload)
      .pipe(
        catchError((error) => {
          console.error(`[FinanceService] updateSection(${projectId}, ${section}) failed`, error);
          return throwError(() => error);
        }),
      );
  }

  /** Append AI suggestions (justifications par champ) */
  appendAISuggestions(projectId: string, suggestions: AISuggestion[]): Observable<FinanceModel> {
    return this.http
      .post<FinanceModel>(`${this.baseUrl}/${projectId}/ai-suggestions`, suggestions)
      .pipe(
        catchError((error) => {
          console.error(`[FinanceService] appendAISuggestions(${projectId}) failed`, error);
          return throwError(() => error);
        }),
      );
  }

  /** Force un recalcul backend */
  recompute(projectId: string): Observable<FinanceModel> {
    return this.http.post<FinanceModel>(`${this.baseUrl}/${projectId}/recompute`, {}).pipe(
      catchError((error) => {
        console.error(`[FinanceService] recompute(${projectId}) failed`, error);
        return throwError(() => error);
      }),
    );
  }

  /** Simulation à la volée (preview temps réel, sans persistance) */
  simulate(model: FinanceModel): Observable<{ computed: FinanceComputed }> {
    return this.http.post<{ computed: FinanceComputed }>(`${this.baseUrl}/simulate`, model).pipe(
      catchError((error) => {
        console.error('[FinanceService] simulate() failed', error);
        return throwError(() => error);
      }),
    );
  }

  // -------------------------------------------------------------------
  // IA — auto-fill et chat
  // -------------------------------------------------------------------

  /** Auto-fill IA d'une section précise (le backend appelle Gemini puis persiste). */
  autoFillSection(
    projectId: string,
    section: FinanceSectionKey,
  ): Observable<FinanceAutoFillResult> {
    return this.http
      .post<FinanceAutoFillResult>(`${this.baseUrl}/${projectId}/ai-fill/${section}`, {})
      .pipe(
        tap(() => console.log(`[FinanceService] autoFillSection(${section}) OK`)),
        catchError((error) => {
          console.error(`[FinanceService] autoFillSection(${section}) failed`, error);
          return throwError(() => error);
        }),
      );
  }

  /** Auto-fill IA global — remplit toutes les sections en une fois. */
  autoFillAll(projectId: string): Observable<FinanceAutoFillResult> {
    return this.http
      .post<FinanceAutoFillResult>(`${this.baseUrl}/${projectId}/ai-fill-all`, {})
      .pipe(
        tap(() => console.log(`[FinanceService] autoFillAll() OK`)),
        catchError((error) => {
          console.error('[FinanceService] autoFillAll() failed', error);
          return throwError(() => error);
        }),
      );
  }

  /** Parse l'intention finance d'un message utilisateur (sans appliquer). */
  parseChatIntent(projectId: string, message: string): Observable<FinanceChatIntent> {
    return this.http
      .post<FinanceChatIntent>(`${this.baseUrl}/${projectId}/chat/parse`, { message })
      .pipe(
        catchError((error) => {
          console.error('[FinanceService] parseChatIntent() failed', error);
          return throwError(() => error);
        }),
      );
  }

  /** Applique une intention confirmée par l'utilisateur. */
  applyChatIntent(projectId: string, intent: FinanceChatIntent): Observable<FinanceModel> {
    return this.http.post<FinanceModel>(`${this.baseUrl}/${projectId}/chat/apply`, intent).pipe(
      catchError((error) => {
        console.error('[FinanceService] applyChatIntent() failed', error);
        return throwError(() => error);
      }),
    );
  }

  /** Télécharge le rapport financier PDF complet. */
  downloadFinancePdf(projectId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${projectId}/pdf`, { responseType: 'blob' }).pipe(
      catchError((error) => {
        console.error(`[FinanceService] downloadFinancePdf(${projectId}) failed`, error);
        return throwError(() => error);
      }),
    );
  }

  /** Helper: déclenche le téléchargement navigateur du PDF généré. */
  static triggerPdfDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Supprime le module Finance d'un projet */
  deleteFinance(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${projectId}`).pipe(
      catchError((error) => {
        console.error(`[FinanceService] deleteFinance(${projectId}) failed`, error);
        return throwError(() => error);
      }),
    );
  }

  // -------------------------------------------------------------------
  // Helpers d'affichage
  // -------------------------------------------------------------------

  /** Formate un montant en FCFA (XAF) avec séparateur d'espaces */
  static formatCurrency(amount: number, currency = 'XAF'): string {
    if (!Number.isFinite(amount)) return '—';
    const rounded = Math.round(amount);
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formatted} ${currency === 'XAF' ? 'FCFA' : currency}`;
  }

  /** Formate un pourcentage */
  static formatPercent(value: number, decimals = 1): string {
    if (!Number.isFinite(value)) return '—';
    return `${value.toFixed(decimals)} %`;
  }
}
