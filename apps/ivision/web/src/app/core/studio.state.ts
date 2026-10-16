import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';
import { Brand, ChatMode, SessionSummary } from './models';

/** Ce que la coque de l'atelier et la conversation partagent : conversations, marques, crédits. */
@Injectable({ providedIn: 'root' })
export class StudioState {
  private readonly api = inject(ApiService);
  readonly sessions = signal<SessionSummary[]>([]);
  readonly sessionsLoading = signal(false);
  readonly brands = signal<Brand[]>([]);
  readonly brandsLoaded = signal(false);
  /** Le portefeuille IDEM, en francs (nom historique : `credits`). */
  readonly credits = signal<number | null>(null);
  /** iVision Créateur actif : les exports HD sont inclus. */
  readonly createur = signal(false);
  /** Prix d'un export HD de visuel (100 F, lu chez IDEM). */
  readonly exportVisualXaf = signal(100);
  /** Le tiroir des conversations (téléphone). */
  readonly drawerOpen = signal(false);

  refreshSessions(mode: ChatMode): void {
    this.sessionsLoading.set(true);
    this.api.sessions(mode).subscribe({
      next: ({ sessions }) => {
        this.sessions.set(sessions);
        this.sessionsLoading.set(false);
      },
      error: () => this.sessionsLoading.set(false),
    });
  }

  refreshBrands(): void {
    this.api.brands().subscribe({
      next: ({ brands }) => {
        this.brands.set(brands);
        this.brandsLoaded.set(true);
      },
      error: () => this.brandsLoaded.set(true),
    });
  }

  upsertBrand(brand: Brand): void {
    this.brands.update((list) => [brand, ...list.filter((b) => b.id !== brand.id)]);
  }

  refreshCredits(): void {
    this.api.me().subscribe({
      next: (me) => {
        this.credits.set(me.walletXaf ?? me.credits);
        this.createur.set(Boolean(me.createur));
        if (typeof me.exportVisualXaf === 'number') this.exportVisualXaf.set(me.exportVisualXaf);
      },
      error: () => undefined,
    });
  }

  refreshBalance(): void {
    this.refreshCredits();
  }

  /** La recharge se fait dans la console IDEM (mobile money), avec le montant qui manque. */
  topUpUrl(missingXaf?: number): string {
    return `${environment.services.dashboard.url}/account/plans${missingXaf ? `?topup=${Math.max(100, Math.ceil(missingXaf / 50) * 50)}` : ''}`;
  }
}
