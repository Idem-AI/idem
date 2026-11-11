import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { localAmountAfter } from '../engine';
import { formatAmount, currencyUnit } from '../format';
import { PromotionsStore } from './promotions.store';

/**
 * Un prix, barré quand une promotion le réduit : « ~~2 500 F CFA~~ 0 F CFA ».
 *
 *   <idem-promo-price item="pack.lancement" [xaf]="5000" />
 *   <idem-promo-price item="pass.croissance" [xaf]="3000" [amount]="local.amount" [currency]="local.currency" />
 *
 * `xaf` est le prix de référence (celui sur lequel la remise se calcule, comme au débit) ; `amount`
 * et `currency` affichent un prix local, remisé dans la même proportion. Sans promotion, seul le prix
 * s'affiche, exactement comme avant. Le style du nombre est celui de l'hôte (`.offer-amount`…).
 */
@Component({
  selector: 'idem-promo-price',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'idem-promo-price' },
  styles: `
    :host { display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 0.4em; }
    del { font-size: 0.62em; font-weight: 500; color: var(--color-text-tertiary, currentColor); opacity: 0.85; text-decoration-thickness: 0.08em; }
    .badge { font-size: 0.5em; font-weight: 600; letter-spacing: 0.02em; padding: 0.15em 0.55em; border-radius: 999px;
      color: var(--color-primary-600, currentColor); background: color-mix(in srgb, var(--color-primary-500, currentColor) 12%, transparent); align-self: center; }
  `,
  template: `
    @if (view().discounted) {
      <del><span class="sr-only">Prix normal : </span>{{ view().original }}</del>
      <span><span class="sr-only">Prix pendant la promotion : </span>{{ view().final }}</span>
      @if (showBadge() && view().badge) {
        <span class="badge">{{ view().badge }}</span>
      }
    } @else {
      <span>{{ view().original }}</span>
    }
  `,
})
export class PromoPriceComponent {
  private readonly store = inject(PromotionsStore);

  /** Article du catalogue des promotions (`pack.lancement`, `deliverable.business_plan`…). */
  readonly item = input<string | null>(null);
  /** Prix de référence en F CFA. */
  readonly xaf = input.required<number>();
  /** Prix local à afficher (sinon `xaf`). */
  readonly amount = input<number | null>(null);
  readonly currency = input<string>('XAF');
  readonly decimals = input<number>(0);
  /** Unité écrite après le nombre ; `''` pour laisser l'hôte l'écrire. */
  readonly unit = input<string | null>(null);
  readonly showBadge = input(true);

  protected readonly view = computed(() => {
    const price = this.store.price(this.item(), this.xaf());
    const base = this.amount() ?? this.xaf();
    const decimals = this.decimals();
    const unit = this.unit() ?? currencyUnit(this.currency());
    const write = (value: number) => (unit ? `${formatAmount(value, decimals)} ${unit}` : formatAmount(value, decimals));
    const promotion = price.applied[0] ? this.store.promotions().find((entry) => entry.id === price.applied[0].id) : undefined;
    return {
      discounted: price.discountXaf > 0 && promotion?.display?.strikethrough !== false,
      original: write(base),
      final: write(localAmountAfter(price, base, decimals)),
      badge: promotion?.display?.badge ?? '',
    };
  });
}
