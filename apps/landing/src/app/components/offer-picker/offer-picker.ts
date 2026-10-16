import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { OfferIllustrationComponent, OfferIllustrationKind } from '../../shared/components/offer-illustration/offer-illustration';

interface Offer {
  id: string;
  need: string;
  name: string;
  price: number;
  cadence: string;
  anchor: string;
  bullets: string[];
  cta: string;
  href: string;
  note?: string;
  art: OfferIllustrationKind;
  recommended?: boolean;
}

/**
 * « De quoi avez-vous besoin ? » : les quatre offres, choisies par BESOIN plutôt que par
 * produit, de la gratuite au forfait du mois. Même bloc sur la home et sur la page Tarifs.
 * Chaque carte a son bouton : la gratuite et le Kit ouvrent un projet (on paie en gardant),
 * les autres ouvrent l'achat dans la console (`/account/plans?buy=…`), connexion d'abord.
 *
 * Montants : `apps/api/api/models/offer.model.ts`.
 */
@Component({
  selector: 'app-offer-picker',
  imports: [RouterLink, OfferIllustrationComponent],
  templateUrl: './offer-picker.html',
  styleUrl: './offer-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferPickerComponent {
  /** Sur la home : une phrase d'introduction et le lien vers tous les prix. */
  readonly summary = input(false);

  private readonly console = environment.services.dashboard.url;
  private readonly startUrl = `${this.console}/create-project`;
  private readonly buy = (code: string) => `${this.console}/account/plans?buy=${code}`;

  protected readonly offers: Offer[] = [
    { id: 'free', need: $localize`:@@offer-picker.free.need:Try without paying`, name: $localize`:@@offer-picker.free.name:Free`, price: 0, cadence: $localize`:@@offer-picker.free.cadence:forever`, anchor: $localize`:@@offer-picker.free.anchor:No bank card, no time limit`, bullets: [$localize`:@@offer-picker.free.b1:Drafts of all your documents: business plan, logo, deck`, $localize`:@@offer-picker.free.b2:Your app generated and running in the browser`, $localize`:@@offer-picker.free.b3:Your website online on Standby`], cta: $localize`:@@offer-picker.free.cta:Get started`, href: this.startUrl, art: 'sprout' },
    { id: 'kit', need: $localize`:@@offer-picker.kit.need:My business documents`, name: $localize`:@@offer-picker.kit.name:Business Kit`, price: 2500, cadence: $localize`:@@offer-picker.offers.once:one-time payment`, anchor: $localize`:@@offer-picker.kit.anchor:Instead of 500,000 F at a consultant`, bullets: [$localize`:@@offer-picker.kit.b1:Business plan with sourced market data`, $localize`:@@offer-picker.kit.b2:Logo and brand guidelines`, $localize`:@@offer-picker.kit.b3:Pitch deck, OHADA statutes, 3-year forecast, business cards`], cta: $localize`:@@offer-picker.kit.cta:Create my project`, href: this.startUrl, art: 'kit', note: $localize`:@@offer-picker.kit.how:You pay when you keep the final version.` },
    { id: 'launch', need: $localize`:@@offer-picker.launch.need:Launch my business online`, name: $localize`:@@offer-picker.launch.name:Launch Pack`, price: 5000, cadence: $localize`:@@offer-picker.offers.once:one-time payment`, anchor: $localize`:@@offer-picker.launch.anchor:Worth 9,400 F bought one by one`, bullets: [$localize`:@@offer-picker.launch.b1:The whole Business Kit`, $localize`:@@offer-picker.launch.b2:Your website or app, with its code (iCode Project Pass)`, $localize`:@@offer-picker.launch.b3:3 months of website online`], cta: $localize`:@@offer-picker.launch.cta:Get the pack`, href: this.buy('pack-lancement'), art: 'launch', recommended: true },
    { id: 'growth', need: $localize`:@@offer-picker.growth.need:Communicate every month`, name: $localize`:@@offer-picker.growth.name:IDEM Growth`, price: 3000, cadence: $localize`:@@offer-picker.offers.month:per month`, anchor: $localize`:@@offer-picker.growth.anchor:That is 100 F a day`, bullets: [$localize`:@@offer-picker.growth.b1:Visuals and videos for your networks, unlimited (fair use)`, $localize`:@@offer-picker.growth.b2:Approve and publish from WhatsApp`, $localize`:@@offer-picker.growth.b3:Your website always online, 20 app changes a month`], cta: $localize`:@@offer-picker.growth.cta:Activate the plan`, href: this.buy('pass-croissance'), art: 'drum' },
  ];

  protected formatPrice(value: number): string {
    return value.toLocaleString('fr-FR').replace(/\s/g, '\u202f');
  }
}
