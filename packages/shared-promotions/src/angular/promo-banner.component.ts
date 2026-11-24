import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { bannerPromotion, promotionTexts } from '../client';
import { pageLang } from '../pay-section';
import { PromotionsStore } from './promotions.store';

/**
 * La promotion en cours (« Bêta gratuite : tout est gratuit, seule limite vos crédits du jour »). Rien n'est
 * rendu s'il n'y a pas de campagne qui demande un bandeau. Fermable pour la page.
 *
 * Deux présentations : `banner` (bandeau pleine largeur, page des offres) et `pill` (une pastille flottante qui
 * déplie le message au clic : elle ne repousse plus le contenu des pages vers le bas).
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
    .pill-wrap { position: relative; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
    .pill { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.4rem 0.35rem 0.5rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; color: var(--color-text-primary); cursor: pointer; }
    .pill:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }
    .pill .pi { font-size: 0.7rem; color: var(--color-text-tertiary); }
    .pop { width: min(20rem, calc(100vw - 2.5rem)); padding: 0.85rem 1rem; font-size: 0.85rem; line-height: 1.5; }
    .pop-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem; }
  `,
  template: `
    @if (texts(); as t) {
      @if (!closed() && variant() === 'pill') {
        <div class="pill-wrap">
          @if (open()) {
            <aside class="glass-card pop" role="status" [attr.aria-label]="t.title" [id]="popId">
              <div class="pop-head">
                <span class="promo-title">{{ shortTitle() }}</span>
                @if (dismissible()) {
                  <button type="button" class="button-icon button-sm" [attr.aria-label]="t.hide" (click)="closed.set(true)">
                    <i class="pi pi-times" aria-hidden="true"></i>
                  </button>
                }
              </div>
              <p class="promo-text">{{ t.message }}</p>
              @if (until()) {
                <span class="promo-until">{{ until() }}</span>
              }
            </aside>
          }
          <button type="button" class="glass-card pill" [attr.aria-expanded]="open()" [attr.aria-controls]="popId" (click)="open.set(!open())">
            <span class="tag">{{ t.badge || t.fallbackBadge }}</span>
            {{ shortTitle() }}
            <i [class]="open() ? 'pi pi-chevron-down' : 'pi pi-chevron-up'" aria-hidden="true"></i>
          </button>
        </div>
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
  /** `banner` : bandeau pleine largeur ; `pill` : pastille flottante qui déplie le message. */
  readonly variant = input<'banner' | 'pill'>('banner');
  protected readonly open = signal(false);
  protected readonly popId = `idem-promo-${Math.random().toString(36).slice(2, 8)}`;
  /** Langue forcée (sinon celle de la page, `<html lang>`). */
  readonly lang = input<string | null>(null);
  protected readonly closed = signal(false);
  protected readonly promotion = computed(() => bannerPromotion(this.store.promotions()));
  protected readonly texts = computed(() => {
    const promotion = this.promotion();
    return promotion ? promotionTexts(promotion, pageLang(this.lang())) : null;
  });
  /** Le titre sans sa ponctuation finale (« Bêta gratuite : » → « Bêta gratuite ») pour la pastille. */
  protected readonly shortTitle = computed(() => (this.texts()?.title ?? '').replace(/[\s:：.—-]+$/u, ''));
  protected readonly until = computed(() => {
    const end = this.promotion()?.endsAt;
    const texts = this.texts();
    return end && texts ? texts.until(end) : '';
  });
}
