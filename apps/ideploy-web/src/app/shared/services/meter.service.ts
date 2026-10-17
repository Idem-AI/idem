import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type MeterTier = 'veille' | 'vitrine' | 'application' | 'application_plus' | 'boutique';

export interface AppMeter {
  appUuid: string;
  appName: string;
  appStatus?: string;
  fqdn?: string | null;
  tier: MeterTier;
  options: string[];
  status: 'active' | 'asleep' | 'archived';
  perDayXaf: number;
  autoRecharge: boolean;
  coveredBy?: string;
  sleepingSince?: string;
  freeUntil?: string;
}

export interface MetersView {
  meters: AppMeter[];
  walletXaf: number;
  /** Jours que le portefeuille couvre au rythme actuel (`null` : rien ne se paie). */
  daysCovered: number | null;
}

export interface MeterCatalog {
  meters: { tier: MeterTier; label: string; perDayXaf: number; description: string }[];
  meterOptions: { code: string; label: string; perDayXaf: number }[];
  domains: Record<string, { registrar: string; priceXaf: number; renewalXaf: number; packXaf: number }>;
}

/** Un domaine de l'utilisateur, tenu par iDomain (relayé par l'API IDEM). */
export interface UserDomain {
  id: string;
  name: string;
  status: string;
  expiresAt: string | null;
  renewalXaf: number | null;
}

/**
 * Les compteurs d'iDeploy, tenus par l'API IDEM (`/billing/deploy/meters`) : une application =
 * un compteur, payé au jour depuis le portefeuille IDEM, commun à tous les services. iDeploy
 * applique l'état voulu (allumée, endormie) ; il ne facture rien lui-même.
 */
@Injectable({ providedIn: 'root' })
export class MeterService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.services.api.url}/billing`;

  /** Solde du portefeuille, pour la barre du haut. `null` tant que rien n'est chargé. */
  readonly walletXaf = signal<number | null>(null);

  list(): Observable<MetersView> {
    return this.http.get<MetersView>(`${this.base}/deploy/meters`, { withCredentials: true }).pipe(tap((view) => this.walletXaf.set(view.walletXaf)));
  }

  catalog(): Observable<MeterCatalog> {
    return this.http.get<MeterCatalog>(`${this.base}/offers`, { withCredentials: true });
  }

  configure(appUuid: string, patch: { tier?: MeterTier; options?: string[]; autoRecharge?: boolean }): Observable<{ ok: true; meter: AppMeter }> {
    return this.http.put<{ ok: true; meter: AppMeter }>(`${this.base}/deploy/meters/${encodeURIComponent(appUuid)}`, patch, { withCredentials: true });
  }

  wake(appUuid: string): Observable<{ ok: true; meter: AppMeter }> {
    return this.http.post<{ ok: true; meter: AppMeter }>(`${this.base}/deploy/meters/${encodeURIComponent(appUuid)}/wake`, {}, { withCredentials: true });
  }

  /** Les domaines de l'utilisateur : iDomain en est la seule source, l'API IDEM les relaie. */
  domains(): Observable<{ domains: UserDomain[] }> {
    return this.http.get<{ domains: UserDomain[] }>(`${this.base}/domains`, { withCredentials: true });
  }

  /** La recharge se fait dans la console IDEM (mobile money), là où est le portefeuille. */
  topUpUrl(amountXaf?: number): string {
    return `${environment.services.console.url}/account/plans${amountXaf ? `?topup=${amountXaf}` : ''}`;
  }
}
