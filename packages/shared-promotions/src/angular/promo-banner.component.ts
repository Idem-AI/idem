import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { bannerPromotion, promotionTexts } from '../client';
import { pageLang } from '../pay-section';
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
    @if (texts(); as t) {
      @if (!closed()) {
        <aside class="glass-card promo" role="status" [attr.aria-label]="t.title">
          <span class="tag">{{ t.badge || t.fallbackBadge }}</span>
          <p class="promo-text">
            <span class="promo-title">{{ t.title }}</span>{{ t.message }}
            @if (until()) {
              <span class="promo-until">{{ until() }}</span>
            }
          </p>
          @if (dismissible()) {
            <button type="button" class="button-icon button-sm" [attr.aria-label]="t.hide" (click)="closed.set(true)">
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
  /** Langue forcée (sinon celle de la page, `<html lang>`). */
  readonly lang = input<string | null>(null);
  protected readonly closed = signal(false);
  protected readonly promotion = computed(() => bannerPromotion(this.store.promotions()));
  protected readonly texts = computed(() => {
    const promotion = this.promotion();
    return promotion ? promotionTexts(promotion, pageLang(this.lang())) : null;
  });
  protected readonly until = computed(() => {
    const end = this.promotion()?.endsAt;
    const texts = this.texts();
    return end && texts ? texts.until(end) : '';
  });
}
