import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PaySectionComponent, PayStripComponent, PromoPriceComponent, PromotionsStore } from '@idem/shared-promotions/angular';
import { environment } from '../../../environments/environment';
import { LanguageService } from '../../core/language.service';
import { Illustration } from '../../shared/components/illustration';
import { DisplayTitle } from '../landing/components/display-title';
import { LandingFooter } from '../landing/components/landing-footer';
import { LandingHeader } from '../landing/components/landing-header';
import { Wrap } from '../landing/components/wrap';

/** Une offre de la grille : où lire son prix sur l'API, et le prix de secours. */
interface Offer {
  key: 'visual' | 'creator' | 'video';
  source: string;
  fallbackXaf: number;
  recommended?: boolean;
}

const OFFERS: Offer[] = [
  { key: 'visual', source: 'ivision.export_visual', fallbackXaf: 100 },
  { key: 'creator', source: 'pass.createur', fallbackXaf: 2000, recommended: true },
  { key: 'video', source: 'ivision.export_video', fallbackXaf: 300 },
];

/** Ce que couvre iVision Créateur chaque mois (usage loyal, voir `offer.model.ts`). */
const CREATOR_VISUALS = 60;
const CREATOR_VIDEOS = 6;

/**
 * Les tarifs d'iVision. Même logique que les autres pages de prix d'IDEM (recherche en psychologie
 * des prix, voir la landing) :
 *  - 0 F pour créer, dit en premier (effet du prix zéro) ;
 *  - trois offres, la recommandée au centre (iVision Créateur), face à sa valeur à l'unité
 *    (ancrage) et ramenée au jour ;
 *  - le paiement en mobile money, sans carte ni abonnement obligatoire (section commune) ;
 *  - les garanties avant le paiement.
 * Les prix viennent de l'API IDEM (grille réglée dans le panel) ; la bêta les barre.
 */
@Component({
  selector: 'iv-pricing',
  imports: [
    RouterLink,
    TranslateModule,
    PaySectionComponent,
    PayStripComponent,
    PromoPriceComponent,
    Illustration,
    DisplayTitle,
    LandingHeader,
    LandingFooter,
    Wrap,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pricing.html',
  styleUrl: './pricing.css',
})
export class PricingPage {
  private readonly store = inject(PromotionsStore);
  protected readonly language = inject(LanguageService);
  protected readonly offers = OFFERS;
  protected readonly buyCreatorUrl = `${environment.services.dashboard.url}/account/plans?buy=pass-createur`;

  private readonly visualXaf = computed(() => this.store.offerPrice('ivision.export_visual', 100));
  private readonly videoXaf = computed(() => this.store.offerPrice('ivision.export_video', 300));
  protected readonly creatorXaf = computed(() => this.store.offerPrice('pass.createur', 2000));
  /** Ce que coûteraient à l'unité les exports couverts par le pass (l'ancre barrée). */
  protected readonly creatorWorthXaf = computed(() => CREATOR_VISUALS * this.visualXaf() + CREATOR_VIDEOS * this.videoXaf());
  protected readonly creatorPerDay = computed(() => Math.round(this.creatorXaf() / 30));
  /** Pendant une promotion qui rend l'offre gratuite, l'ancre et le prix au jour se taisent. */
  protected readonly creatorPromoted = computed(() => this.store.price('pass.createur', this.creatorXaf()).discountXaf > 0);

  protected readonly faq = ['free', 'mark', 'pay', 'stop', 'failed'] as const;
  protected readonly guarantees = ['free', 'failed', 'stop'] as const;

  protected amount(value: number): string {
    return value.toLocaleString(this.language.current() === 'en' ? 'en-US' : 'fr-FR');
  }
}
