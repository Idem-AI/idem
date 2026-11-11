import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { bannerPromotion } from '../client';
import { PromotionsStore } from './promotions.store';

/**
 * Le bandeau de la promotion en cours (« Bêta gratuite : tout est gratuit, seule limite vos crédits du
 * jour »). Rien n'est rendu s'il n'y a pas de campagne qui demande un bandeau. Fermable pour la page.
 */
@Component({
  selector: 'idem-promo-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: block; }
    .promo { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem 1rem; }
    .promo-text { flex: 1; min-width: 0; margin: 0; line-height: 1.5; }
    .promo-title { font-weight: 600; margin-right: 0.35rem; }
    .promo-until { display: block; font-size: 0.85em; color: var(--color-text-tertiary, inherit); }
  `,
  template: `
    @if (promotion(); as promo) {
      @if (!closed()) {
        <aside class="glass-card promo" role="status" [attr.aria-label]="promo.display.title">
          <span class="tag">{{ promo.display.badge || 'Offre' }}</span>
          <p class="promo-text">
            <span class="promo-title">{{ promo.display.title }}</span>{{ promo.display.message }}
            @if (until()) {
              <span class="promo-until">Jusqu’au {{ until() }}</span>
            }
          </p>
          @if (dismissible()) {
            <button type="button" class="button-icon button-sm" aria-label="Masquer ce message" (click)="closed.set(true)">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          }
        </aside>
      }
    }
  `,
})
export class PromoBannerComponent {
  private readonly store = inject(PromotionsStore);
  readonly dismissible = input(true);
  protected readonly closed = signal(false);
  protected readonly promotion = computed(() => bannerPromotion(this.store.promotions()));
  protected readonly until = computed(() => {
    const end = this.promotion()?.endsAt;
    return end ? new Date(end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  });
}
