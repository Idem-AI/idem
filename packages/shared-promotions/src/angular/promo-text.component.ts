import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { localAmountAfter } from '../engine';
import { freeLabel, rewriteAmount, srLabels } from '../format';
import { PromotionsStore } from './promotions.store';

/**
 * Une chaîne de prix existante, barrée quand une promotion la réduit, suivie du prix remisé écrit
 * avec les mêmes mots : « ~~10 F par jour~~ 0 F CFA par jour ».
 *
 *   <idem-promo-text [text]="row.price" item="ideploy.meter" [xaf]="10" />
 *
 * `xaf` est le prix de référence de l'article (celui que l'API remise) ; le montant écrit dans
 * `text` (éventuellement en devise locale) est remisé dans la même proportion.
 */
@Component({
  selector: 'idem-promo-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'idem-promo-text' },
  styles: `
    .vh { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    :host { display: inline-flex; align-items: baseline; flex-wrap: wrap; justify-content: inherit; gap: 0.4em; }
    del { font-size: 0.85em; font-weight: 400; color: var(--color-text-tertiary, currentColor); opacity: 0.85; }
  `,
  template: `
    @if (view(); as v) {
      <del><span class="vh">{{ labels().normal }} </span>{{ liveText() }}</del>
      <span><span class="vh">{{ labels().promo }} </span>{{ v }}</span>
    } @else {
      <span>{{ liveText() }}</span>
    }
  `,
})
export class PromoTextComponent {
  private readonly store = inject(PromotionsStore);
  /** Libellés pour les lecteurs d'écran, dans la langue de la page. */
  protected readonly labels = computed(() => srLabels());
  readonly text = input.required<string>();
  readonly item = input<string | null>(null);
  readonly xaf = input<number | null>(null);
  readonly locale = input('fr-FR');
  /** Où lire le prix à jour sur l'API : le montant de `text` est alors remplacé par celui de l'API. */
  readonly source = input<string | null>(null);

  /** Le texte, montant mis à jour d'après l'API quand `source` est donné. */
  protected readonly liveText = computed(() => {
    const fallback = this.xaf();
    const live = fallback === null ? null : this.store.offerPrice(this.source(), fallback);
    return live === null || live === fallback ? this.text() : rewriteAmount(this.text(), () => live, this.locale());
  });

  protected readonly view = computed(() => {
    const fallback = this.xaf();
    if (!this.item() || !fallback) return null;
    const xaf = this.store.offerPrice(this.source(), fallback);
    const price = this.store.price(this.item(), xaf);
    if (price.discountXaf <= 0) return null;
    const promotion = this.store.promotions().find((entry) => entry.id === price.applied[0]?.id);
    if (promotion?.display?.strikethrough === false) return null;
    // Un prix offert s'écrit « Gratuit » ; une remise partielle garde les mots d'origine (« 7 F par jour »).
    if (price.free) return freeLabel(this.locale().startsWith('en') ? 'en' : undefined);
    return rewriteAmount(this.liveText(), (amount) => localAmountAfter(price, amount), this.locale());
  });
}
