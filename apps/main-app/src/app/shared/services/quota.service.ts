import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, EMPTY } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { QuotaInfoResponse, QuotaStatus, QuotaDisplayData, BetaRestrictions } from '../models/quota.model';

@Injectable({
  providedIn: 'root',
})
export class QuotaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    environment.services?.api?.url || 'http://localhost:3000/api';

  // Signals for reactive state management
  public readonly quotaInfo = signal<QuotaInfoResponse | null>(null);
  public readonly isBeta = signal<boolean>(false);
  public readonly betaRestrictions = signal<BetaRestrictions | null>(null);

  // Computed quota display data
  public readonly quotaDisplay = computed(() => {
    const info = this.quotaInfo();
    if (!info) return null;

    const dailyPercentage = (info.dailyUsage / info.dailyLimit) * 100;
    const weeklyPercentage = (info.weeklyUsage / info.weeklyLimit) * 100;

    return {
      dailyPercentage,
      weeklyPercentage,
      dailyStatus: this.getQuotaStatus(dailyPercentage),
      weeklyStatus: this.getQuotaStatus(weeklyPercentage),
      canUseFeature: info.remainingDaily > 0 && info.remainingWeekly > 0,
    } as QuotaDisplayData;
  });

  public getQuotaInfo(): Observable<QuotaInfoResponse> {
    return this.http.get<QuotaInfoResponse>(`${this.apiUrl}/quota/info`).pipe(
      tap((info) => {
        this.quotaInfo.set(info);
      }),
      catchError((error) => {
        return EMPTY;
      })
    );
  }

  public getBetaInfo(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/quota/beta`).pipe(
      tap((betaInfo) => {
        this.isBeta.set(betaInfo.isBeta || false);
        this.betaRestrictions.set(betaInfo.restrictions || null);
      }),
      catchError((error) => {
        return EMPTY;
      })
    );
  }

  public isFeatureAllowedInBeta(featureName: string): boolean {
    const restrictions = this.betaRestrictions();
    if (!restrictions) return true;
    return restrictions.allowedFeatures?.includes(featureName) || false;
  }

  /**
   * Determines quota status based on usage percentage
   */
  private getQuotaStatus(percentage: number): QuotaStatus {
    if (percentage >= 100) return QuotaStatus.EXCEEDED;
    if (percentage >= 80) return QuotaStatus.WARNING;
    return QuotaStatus.AVAILABLE;
  }
}
