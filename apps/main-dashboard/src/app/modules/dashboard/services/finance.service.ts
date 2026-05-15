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
    return this.http
      .get<FinanceSummaryResponse>(`${this.baseUrl}/${projectId}/summary`)
      .pipe(
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
          console.error(
            `[FinanceService] updateSection(${projectId}, ${section}) failed`,
            error,
          );
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
    const formatted = rounded
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formatted} ${currency === 'XAF' ? 'FCFA' : currency}`;
  }

  /** Formate un pourcentage */
  static formatPercent(value: number, decimals = 1): string {
    if (!Number.isFinite(value)) return '—';
    return `${value.toFixed(decimals)} %`;
  }
}
