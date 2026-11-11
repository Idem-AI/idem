import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PaySectionComponent, PayStripComponent, PromoPriceComponent, PromotionsStore } from '@idem/shared-promotions/angular';

import { LanguageService } from '@core/i18n/language.service';
import { Illustration } from '@shared/components/illustration/illustration';

/** Les trois offres que vend le simulateur (`simulation.service.ts#getPricing`). */
type OfferKey = 'run' | 'pack' | 'report';

/**
 * Les tarifs du simulateur, publics. Même logique que les autres pages de prix d'IDEM :
 *  - 0 F pour la première analyse, dit en premier (effet du prix zéro) ;
 *  - trois offres (simulation, simulation + rapport au centre, rapport seul), chacune face à son
 *    prix sans projet IDEM (ancrage) ;
 *  - le paiement en mobile money, sans carte ni abonnement (section commune à toutes les landings) ;
 *  - les garanties avant le paiement.
 * Illustration : la perche du piroguier qui sonde le fond avant d'avancer (`pole`).
 */
@Component({
  selector: 'sim-pricing-page',
  imports: [RouterLink, TranslatePipe, PaySectionComponent, PayStripComponent, PromoPriceComponent, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.css',
})
export class PricingPage {
  private readonly store = inject(PromotionsStore);
  protected readonly language = inject(LanguageService);

  /**
   * Les prix, lus sur l'API comme les débite `simulationPrice` : avec un projet IDEM (le prix
   * affiché) et sans (l'ancre barrée). Le pack vaut la simulation plus le rapport.
   */
  protected readonly offers = computed(() => {
    const run = this.store.offerPrice('isimulate.run', 1500);
    const runPublic = this.store.offerPrice('isimulate.run:public', 2500);
    const report = this.store.offerPrice('isimulate.report', 2000);
    const reportPublic = this.store.offerPrice('isimulate.report:public', 2000);
    const rows: { key: OfferKey; item: string; xaf: number; publicXaf: number; recommended: boolean }[] = [
      { key: 'run', item: 'isimulate.run', xaf: run, publicXaf: runPublic, recommended: false },
      { key: 'pack', item: 'isimulate.run', xaf: run + report, publicXaf: runPublic + reportPublic, recommended: true },
      { key: 'report', item: 'isimulate.report', xaf: report, publicXaf: reportPublic, recommended: false },
    ];
    return rows.map((row) => ({
      ...row,
      // Pendant une promotion (la bêta), le prix barré par la promotion suffit : pas de seconde ancre.
      anchor: this.store.price(row.item, row.xaf).discountXaf <= 0 && row.publicXaf > row.xaf,
    }));
  });

  protected readonly guarantees = ['free', 'failed', 'stop'] as const;
  protected readonly faq = ['free', 'project', 'report', 'pay', 'beta'] as const;

  protected amount(value: number): string {
    return value.toLocaleString(this.language.language() === 'en' ? 'en-US' : 'fr-FR');
  }
}
