import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Brand, ChatMode, SessionSummary } from './models';

/** Ce que la coque de l'atelier et la conversation partagent : conversations, marques, crédits. */
@Injectable({ providedIn: 'root' })
export class StudioState {
  private readonly api = inject(ApiService);
  readonly sessions = signal<SessionSummary[]>([]);
  readonly sessionsLoading = signal(false);
  readonly brands = signal<Brand[]>([]);
  readonly brandsLoaded = signal(false);
  readonly credits = signal<number | null>(null);
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
    this.api.me().subscribe({ next: (me) => this.credits.set(me.credits), error: () => undefined });
  }
}
