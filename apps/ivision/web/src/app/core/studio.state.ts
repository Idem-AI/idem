import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Brand, ChatMode, Montage, SessionSummary } from './models';

/** Ce que la coque de l'atelier et la conversation partagent : conversations, marques, crédits. */
@Injectable({ providedIn: 'root' })
export class StudioState {
  private readonly api = inject(ApiService);
  readonly sessions = signal<SessionSummary[]>([]);
  readonly sessionsLoading = signal(false);
  readonly brands = signal<Brand[]>([]);
  readonly brandsLoaded = signal(false);
  readonly credits = signal<number | null>(null);
  /** Les montages (atelier « Montage ») : l'historique de la barre latérale. */
  readonly montages = signal<Montage[]>([]);
  readonly montagesLoading = signal(false);
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

  refreshMontages(): void {
    this.montagesLoading.set(true);
    this.api.montages().subscribe({
      next: ({ montages }) => {
        this.montages.set(montages);
        this.montagesLoading.set(false);
      },
      error: () => this.montagesLoading.set(false),
    });
  }

  upsertMontage(montage: Montage): void {
    this.montages.update((list) => (list.some((m) => m.id === montage.id) ? list.map((m) => (m.id === montage.id ? { ...m, ...montage, words: [] } : m)) : [{ ...montage, words: [] }, ...list]));
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
    this.api.me().subscribe({ next: (me) => this.credits.set(me.credits), error: () => undefined });
  }
}
