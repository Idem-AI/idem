import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { OfferIllustrationComponent, OfferIllustrationKind } from '../../shared/components/offer-illustration/offer-illustration';
import { PromoBannerComponent, PromoPriceComponent, PromotionsStore } from '@idem/shared-promotions/angular';
import { offerPriceXaf } from '@idem/shared-promotions';
import { livePhraseValue } from '../../shared/live-phrases';

/** Une offre payante, telle qu'on la montre. */
interface Offer {
  id: 'kit' | 'launch' | 'growth';
  need: string;
  name: string;
  /** Article des promotions et source du prix sur l'API. */
  item: string;
  /** Prix de secours (l'API fait foi). */
  fallbackXaf: number;
  /** Ce que vaut l'offre achetée en morceaux (prix d'ancrage), calculé sur l'API. */
  anchor?: 'kitSum' | 'launchWorth';
  /** Prix au jour (forfait du mois) : le montant au jour est mis en avant. */
  perDay?: boolean;
  cadence: string;
  bullets: string[];
  cta: string;
  href: string;
  note?: string;
  art: OfferIllustrationKind;
  recommended?: boolean;
}

/** Une offre affichée : prix réels, ancrage et économie calculés. */
interface OfferView extends Offer {
  priceXaf: number;
  anchorXaf: number | null;
  savingXaf: number | null;
  dayXaf: number | null;
  /** Une promotion barre déjà le prix : l'ancrage s'efface pour ne pas barrer deux fois. */
  promoted: boolean;
}

/**
 * « De quoi avez-vous besoin ? » — le même bloc sur l'accueil et la page Tarifs.
 *
 * Construit sur ce que la recherche en psychologie des prix montre de plus solide :
 *  - **la gratuité d'abord** (effet du prix zéro, Shampanier, Mazar & Ariely 2007) : une bande
 *    d'entrée « tout se crée gratuitement » rassure sans concurrencer les offres payantes ;
 *  - **trois offres, la recommandée au centre** (effet de compromis, Simonson 1989 ; surcharge de
 *    choix, Iyengar & Lepper 2000) : le Pack Lancement entre le Kit et le forfait ;
 *  - **un leurre qui fait valoir le pack** (domination asymétrique, Ariely) : le Kit seul coûte la
 *    moitié du Pack, qui contient le Kit, le Pass Projet et 3 mois de site ;
 *  - **un prix d'ancrage barré et l'économie en francs** (ancrage ; « règle des 100 » de Berger :
 *    au-delà de 100, l'écart en valeur absolue paraît plus grand qu'un pourcentage) ;
 *  - **le prix au jour pour le forfait** (« pennies-a-day », Gourville 1998) : 100 F par jour ;
 *  - **l'unité de prix discrète** (Yang & Kimes, Cornell : sans symbole monétaire on dépense
 *    plus) : le nombre en grand, « F » en petit.
 *
 * Tous les montants viennent de l'API (grille réglée dans le panel) ; ceux écrits ici ne servent
 * que de secours.
 */
@Component({
  selector: 'app-offer-picker',
  imports: [RouterLink, OfferIllustrationComponent, PromoPriceComponent, PromoBannerComponent],
  templateUrl: './offer-picker.html',
  styleUrl: './offer-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferPickerComponent {
  /** Sur la home : une phrase d'introduction et le lien vers tous les prix. */
  readonly summary = input(false);

  private readonly store = inject(PromotionsStore);
  private readonly console = environment.services.dashboard.url;
  protected readonly startUrl = `${this.console}/create-project`;
  private readonly buy = (code: string) => `${this.console}/account/plans?buy=${code}`;

  private readonly offers: Offer[] = [
    {
      id: 'kit',
      need: $localize`:@@offer-picker.kit.need:My business documents`,
      name: $localize`:@@offer-picker.kit.name:Business Kit`,
      item: 'deliverable.kit',
      fallbackXaf: 2500,
      anchor: 'kitSum',
      cadence: $localize`:@@offer-picker.kit.cadence:once, for the whole project`,
      bullets: [
        $localize`:@@offer-picker.kit.b1:Business plan with sourced market data`,
        $localize`:@@offer-picker.kit.b2:Logo and brand guidelines`,
        $localize`:@@offer-picker.kit.b3:Pitch deck, OHADA statutes, 3-year forecast, business cards`,
      ],
      cta: $localize`:@@offer-picker.kit.cta:Create my project`,
      href: this.startUrl,
      art: 'kit',
      note: $localize`:@@offer-picker.kit.how:You pay when you keep the final version.`,
    },
    {
      id: 'launch',
      need: $localize`:@@offer-picker.launch.need:Launch my business online`,
      name: $localize`:@@offer-picker.launch.name:Launch Pack`,
      item: 'pack.lancement',
      fallbackXaf: 5000,
      anchor: 'launchWorth',
      cadence: $localize`:@@offer-picker.launch.cadence:once, everything included`,
      bullets: [
        $localize`:@@offer-picker.launch.b1:The whole Business Kit`,
        $localize`:@@offer-picker.launch.b2:Your website or app, with its code (iCode Project Pass)`,
        $localize`:@@offer-picker.launch.b3:3 months of website online`,
      ],
      cta: $localize`:@@offer-picker.launch.cta:Get the pack`,
      href: this.buy('pack-lancement'),
      art: 'launch',
      recommended: true,
    },
    {
      id: 'growth',
      need: $localize`:@@offer-picker.growth.need:Communicate every month`,
      name: $localize`:@@offer-picker.growth.name:IDEM Growth`,
      item: 'pass.croissance',
      fallbackXaf: 3000,
      perDay: true,
      cadence: $localize`:@@offer-picker.growth.cadence:no commitment, stop whenever you want`,
      bullets: [
        $localize`:@@offer-picker.growth.b1:Visuals and videos for your networks, unlimited (fair use)`,
        $localize`:@@offer-picker.growth.b2:Approve and publish from WhatsApp`,
        $localize`:@@offer-picker.growth.b3:Your website always online, 20 app changes a month`,
      ],
      cta: $localize`:@@offer-picker.growth.cta:Activate the plan`,
      href: this.buy('pass-croissance'),
      art: 'drum',
    },
  ];

  protected readonly cards = computed<OfferView[]>(() => {
    const offers = this.store.offers();
    return this.offers.map((offer) => {
      const priceXaf = offerPriceXaf(offers, offer.item) ?? offer.fallbackXaf;
      const anchorXaf =
        offer.anchor === 'kitSum'
          ? (offers?.kit?.sumXaf ?? 7500)
          : offer.anchor === 'launchWorth'
            ? (livePhraseValue(offers, 'launchWorth') ?? 9400)
            : null;
      const savingXaf = anchorXaf !== null && anchorXaf > priceXaf ? anchorXaf - priceXaf : null;
      return {
        ...offer,
        priceXaf,
        anchorXaf: savingXaf ? anchorXaf : null,
        savingXaf,
        dayXaf: offer.perDay ? Math.round(priceXaf / 30) : null,
        promoted: this.store.price(offer.item, priceXaf).discountXaf > 0,
      };
    });
  });

  /** La version finale la moins chère, pour la bande « gratuit ». */
  protected readonly minFinal = computed(() => livePhraseValue(this.store.offers(), 'minFinal') ?? 500);

  protected amount(value: number): string {
    return value.toLocaleString(typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? 'en-US' : 'fr-FR');
  }

  protected saving(value: number): string {
    return $localize`:@@offer-picker.saving:You save ${this.amount(value)}:AMOUNT: F`;
  }

  protected perDayLabel(): string {
    return $localize`:@@offer-picker.perDay:a day`;
  }

  protected perMonth(value: number): string {
    return $localize`:@@offer-picker.perMonth:that is ${this.amount(value)}:AMOUNT: F a month`;
  }

  protected anchorLabel(value: number): string {
    return $localize`:@@offer-picker.anchor:${this.amount(value)}:AMOUNT: F bought one by one`;
  }

  protected freeText(): string {
    return $localize`:@@offer-picker.free.strip:Drafts of all your documents, your app running in the browser, your website online on Standby. You only pay to keep a final version, from ${this.amount(this.minFinal())}:AMOUNT: F.`;
  }
}
