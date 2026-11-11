import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { PAYMENT_OPERATORS } from '../operators';
import { COWRIES_SVG, PAY_CSS, pageLang, payTexts } from '../pay-section';
import { PromotionsStore } from './promotions.store';

/**
 * « Payez avec votre téléphone » : la section du paiement, IDENTIQUE sur toutes les landings
 * (même balisage et même feuille de style que `<PaySection>` côté React, voir `pay-section.ts`).
 *
 *   <idem-pay-section [ctaHref]="startUrl" />
 */
@Component({
  selector: 'idem-pay-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [PAY_CSS, ':host { display: block; }'],
  template: `
    @let t = texts();
    <section class="idem-pay" aria-labelledby="idem-pay-title">
      <div class="idem-pay-top">
        <div>
          <h2 class="idem-pay-title" id="idem-pay-title">{{ t.title[0] }}<span class="idem-pay-wave">{{ t.title[1] }}</span>{{ t.title[2] }}</h2>
          <p class="idem-pay-lead">{{ t.lead }}</p>
          <ul class="idem-pay-promises">
            @for (promise of t.promises; track promise) {
              <li><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>{{ promise }}</li>
            }
          </ul>
        </div>
        <div class="idem-pay-art" aria-hidden="true" [innerHTML]="art"></div>
      </div>

      <div class="idem-pay-ops">
        <p class="idem-pay-ops-title">{{ t.operatorsTitle }}</p>
        <ul class="idem-pay-ops-grid">
          @for (operator of operators; track operator.id; let first = $first) {
            <li class="idem-pay-op" [class.idem-pay-op-first]="first" [style.background]="operator.tile ?? null">
              <img [src]="operator.logo" [alt]="operator.name" loading="lazy" decoding="async" />
            </li>
          }
        </ul>
      </div>

      <ol class="idem-pay-steps">
        @for (step of t.steps; track step.title; let i = $index) {
          <li class="idem-pay-step">
            <span class="idem-pay-step-num" aria-hidden="true">{{ i + 1 }}</span>
            <p class="idem-pay-step-title">{{ step.title }}</p>
            <p class="idem-pay-step-text">{{ step.text }}</p>
          </li>
        }
      </ol>

      @if (ctaHref()) {
        <div class="idem-pay-foot">
          <a class="idem-pay-cta" [href]="ctaHref()">{{ t.cta }}</a>
          <p>{{ t.ctaNote }}</p>
        </div>
      }
    </section>
  `,
})
export class PaySectionComponent {
  private readonly store = inject(PromotionsStore);
  /** Langue forcée (sinon celle de la page). */
  readonly lang = input<string | null>(null);
  /** Lien du bouton « Commencer gratuitement » ; sans lien, pas de bouton. */
  readonly ctaHref = input<string | null>(null);

  protected readonly operators = PAYMENT_OPERATORS;
  protected readonly art = inject(DomSanitizer).bypassSecurityTrustHtml(COWRIES_SVG);
  protected readonly texts = computed(() => payTexts(pageLang(this.lang()), this.store.offers()));
}
