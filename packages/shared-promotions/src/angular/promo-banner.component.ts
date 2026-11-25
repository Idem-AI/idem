import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { bannerPromotion, promotionTexts } from '../client';
import { pageLang } from '../pay-section';
import { PromotionsStore } from './promotions.store';

/**
 * La promotion en cours (« Bêta gratuite : tout est gratuit, seule limite vos crédits du jour »). Rien n'est
 * rendu s'il n'y a pas de campagne qui demande un bandeau. Fermable pour la page.
 *
 * Deux présentations : `banner` (bandeau pleine largeur, page des offres) et `toast` (une carte flottante, posée
 * par la page en haut au centre : bien visible, elle ne repousse pas le contenu vers le bas).
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
    .toast { display: flex; align-items: center; gap: 0.85rem; padding: 0.7rem 0.75rem 0.7rem 1rem; border-left: 4px solid var(--color-accent-500, var(--color-primary-500)); box-shadow: 0 12px 32px color-mix(in oklch, var(--color-text-primary) 16%, transparent); animation: promo-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .toast-icon { display: flex; flex: none; align-items: center; justify-content: center; width: 2.4rem; height: 2.4rem; border-radius: 999px; background: color-mix(in oklch, var(--color-primary-500) 12%, transparent); color: var(--color-primary-500); }
    .toast-body { flex: 1; min-width: 0; margin: 0; font-size: 0.85rem; line-height: 1.45; color: var(--color-text-secondary); }
    .toast-title { display: block; font-size: 0.95rem; font-weight: 700; color: var(--color-text-primary); }
    @keyframes promo-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `,
  template: `
    @if (texts(); as t) {
      @if (!closed() && variant() === 'toast') {
        <aside class="glass-card toast" role="status" [attr.aria-label]="shortTitle()">
          <span class="toast-icon" aria-hidden="true"><i class="pi pi-gift"></i></span>
          <p class="toast-body">
            <span class="toast-title">{{ shortTitle() }} <span class="tag">{{ t.badge || t.fallbackBadge }}</span></span>
            {{ t.message }}
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
      } @else if (!closed()) {
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
  /** `banner` : bandeau pleine largeur ; `toast` : carte flottante (la page la place). */
  readonly variant = input<'banner' | 'toast'>('banner');
  /** Langue forcée (sinon celle de la page, `<html lang>`). */
  readonly lang = input<string | null>(null);
  protected readonly closed = signal(false);
  protected readonly promotion = computed(() => bannerPromotion(this.store.promotions()));
  protected readonly texts = computed(() => {
    const promotion = this.promotion();
    return promotion ? promotionTexts(promotion, pageLang(this.lang())) : null;
  });
  /** Le titre sans sa ponctuation finale (« Bêta gratuite : » → « Bêta gratuite »). */
  protected readonly shortTitle = computed(() => (this.texts()?.title ?? '').replace(/[\s:：.—-]+$/u, ''));
  protected readonly until = computed(() => {
    const end = this.promotion()?.endsAt;
    const texts = this.texts();
    return end && texts ? texts.until(end) : '';
  });
}
