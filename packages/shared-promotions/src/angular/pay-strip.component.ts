import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { PAYMENT_OPERATORS } from '../operators';
import { PAY_CSS, pageLang, payTexts } from '../pay-section';

/** « Payé en mobile money », les logos en petit (Orange Money en premier) : pour les héros des pages de prix. */
@Component({
  selector: 'idem-pay-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [PAY_CSS, 'idem-pay-strip { display: block; }'],
  template: `
    @let t = texts().strip;
    <p class="idem-pay-strip">
      <span class="idem-pay-strip-label">{{ t.label }}</span>
      <span class="idem-pay-strip-logos" role="list">
        @for (operator of operators; track operator.id) {
          <span role="listitem" class="idem-pay-strip-logo" [style.background]="operator.tile ?? null"><img [src]="operator.logo" [alt]="operator.name" /></span>
        }
      </span>
      <span class="idem-pay-strip-note">{{ t.note }}</span>
    </p>
  `,
})
export class PayStripComponent {
  readonly lang = input<string | null>(null);
  protected readonly operators = PAYMENT_OPERATORS;
  protected readonly texts = computed(() => payTexts(pageLang(this.lang()), null));
}
