import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { OfferPickerComponent } from '../../components/offer-picker/offer-picker';
import { OfferIllustrationComponent } from '../../shared/components/offer-illustration/offer-illustration';
import { PromoTextComponent, PromotionsStore } from '@idem/shared-promotions/angular';
import { LivePhrase, livePhrase, livePhraseValue } from '../../shared/live-phrases';
import { offerPriceXaf } from '@idem/shared-promotions';

interface PriceRow {
  label: string;
  price: string;
  /** Article des promotions et prix de référence en F CFA : le prix se barre pendant une promotion. */
  item?: string;
  xaf?: number;
  /** Où lire le prix à jour sur l'API (sinon l'article) ; `xaf` n'est qu'un prix de secours. */
  source?: string;
}

interface ServiceTab {
  id: string;
  label: string;
  note: string;
  /** Le montant de `note` se recalcule depuis les prix de l'API. */
  noteLive?: LivePhrase;
  rows: PriceRow[];
  href: string;
}

/**
 * Refonte du 11/11/2026, appuyée sur la recherche en psychologie des prix :
 *  - **héros « au juste prix »** : la gratuité d'abord, puis les plus petits montants réels (une
 *    version finale dès 500 F, une modification 25 F, « le prix d'un SMS ») — l'ancre basse qu'on
 *    retient (ancrage, Tversky & Kahneman) et la logique « au détail » des marchés (économie du
 *    sachet : acheter la quantité voulue, au jour) ;
 *  - **le détail par service annonce « dès X F »** et liste les prix du moins cher au plus cher : le
 *    premier prix lu sert de référence (effet d'ordre, Suk, Lee & Lichtenstein 2012) ;
 *  - **les garanties** (plafond du Kit, génération ratée remboursée, sans abonnement, rien n'est
 *    supprimé) lèvent la peur de payer pour rien (aversion à la perte).
 *
 * Les tarifs publics. Une seule action principale (commencer gratuitement), trois offres choisies
 * par BESOIN plutôt que par produit, et le détail des prix révélé à la demande, service par
 * service. Chaque offre affichée a son bouton de souscription : il ouvre la console sur l'achat
 * (`/account/plans?buy=…`), en passant par la connexion si besoin (le garde ramène ici après).
 *
 * Montants : lus sur l'API (`/billing/offers`, la grille réglée dans le panel admin, page « Prix ») ;
 * ceux écrits ici ne servent que de secours si l'API ne répond pas.
 */
@Component({
  selector: 'app-pricing-page',
  imports: [OfferPickerComponent, OfferIllustrationComponent, PromoTextComponent],
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingPage {
  private readonly console = environment.services.dashboard.url;
  protected readonly startUrl = `${this.console}/create-project`;
  private readonly buy = (code: string) => `${this.console}/account/plans?buy=${code}`;


  private readonly urls: Record<string, string> = {
    dashboard: this.startUrl,
    appgen: environment.services.idev.url,
    ideploy: environment.services.ideploy.url,
    ivision: (environment.services as { ivision?: { url: string } }).ivision?.url ?? this.startUrl,
    simulation: (environment.services as { simulation?: { url: string } }).simulation?.url ?? this.startUrl,
  };

  protected readonly services: ServiceTab[] = [
    { id: 'idem', label: $localize`:@@pricing-page.detail.idem:Documents`, note: $localize`:@@pricing-page.detail.idemNote:Drafts are free. Once your purchases on a project reach 2,500 F, the rest of the Kit is unlocked.`, noteLive: 'kitCap', rows: [{ label: $localize`:@@pricing-page.row.logo:Logo and brand guidelines`, price: '1 500 F', item: 'deliverable.logo_brand', xaf: 1500 }, { label: $localize`:@@pricing-page.row.bp:Business plan`, price: '2 000 F', item: 'deliverable.business_plan', xaf: 2000 }, { label: $localize`:@@pricing-page.row.deck:Pitch deck`, price: '1 000 F', item: 'deliverable.pitch_deck', xaf: 1000 }, { label: $localize`:@@pricing-page.row.legal:OHADA legal kit`, price: '1 500 F', item: 'deliverable.legal_kit', xaf: 1500 }, { label: $localize`:@@pricing-page.row.forecast:3-year forecast`, price: '1 000 F', item: 'deliverable.financial_forecast', xaf: 1000 }, { label: $localize`:@@pricing-page.row.cards:Business cards`, price: '500 F', item: 'deliverable.business_card', xaf: 500 }, { label: $localize`:@@pricing-page.row.kitcap:The whole Kit, at most`, price: '2 500 F', item: 'deliverable.kit', xaf: 2500 }], href: this.urls['dashboard'] },
    { id: 'comm', label: $localize`:@@pricing-page.detail.comm:Communication`, note: $localize`:@@pricing-page.detail.commNote:Your purchases of the month stop at 3,000 F: beyond that, IDEM Growth is yours until month end.`, noteLive: 'growthMonth', rows: [{ label: $localize`:@@pricing-page.row.flyer:Visual for a post`, price: '100 F', item: 'communication.flyer', xaf: 100 }, { label: $localize`:@@pricing-page.row.carousel:Carousel (up to 10 slides)`, price: '200 F', item: 'communication.carousel', xaf: 200 }, { label: $localize`:@@pricing-page.row.video:Motion design video`, price: '300 F', item: 'communication.motion_video', xaf: 300 }, { label: $localize`:@@pricing-page.row.clip:AI-filmed shot (5 s)`, price: '1 000 F', item: 'communication.ai_clip', xaf: 1000 }, { label: $localize`:@@pricing-page.row.calendar:Monthly editorial calendar`, price: '500 F', item: 'communication.editorial_calendar', xaf: 500 }, { label: $localize`:@@pricing-page.row.strategy:Communication strategy`, price: '1 000 F', item: 'communication.communication_strategy', xaf: 1000 }], href: this.urls['dashboard'] },
    { id: 'icode', label: $localize`:@@pricing-page.detail.icode:Website & app`, note: $localize`:@@pricing-page.detail.icodeNote:Generating your app and watching it run is free.`, rows: [{ label: $localize`:@@pricing-page.row.generate:Generate your app`, price: $localize`:@@pricing-page.free:Free` }, { label: $localize`:@@pricing-page.row.pass:Project Pass: code, GitHub, deploy, 30 changes`, price: '1 000 F', item: 'icode.project_pass', xaf: 1000 }, { label: $localize`:@@pricing-page.row.change:One change`, price: '25 F', item: 'icode.modification', xaf: 25 }, { label: $localize`:@@pricing-page.row.pack100:100 changes`, price: '2 000 F', item: 'icode.pack_100', xaf: 2000 }], href: this.urls['appgen'] },
    { id: 'ideploy', label: $localize`:@@pricing-page.detail.ideploy:Hosting`, note: $localize`:@@pricing-page.detail.ideployNote:Paid by the day from your wallet. No subscription; an unpaid app falls asleep, it is never deleted.`, rows: [{ label: $localize`:@@pricing-page.row.veille:Standby: online, woken up on visit`, price: $localize`:@@pricing-page.free:Free` }, { label: $localize`:@@pricing-page.row.vitrine:Showcase: website always on`, price: $localize`:@@pricing-page.perDay:${'10'}:INTERPOLATION: F a day`, item: 'ideploy.meter', xaf: 10, source: 'meter:vitrine' }, { label: $localize`:@@pricing-page.row.application:Application with database`, price: $localize`:@@pricing-page.perDay:${'50'}:INTERPOLATION: F a day`, item: 'ideploy.meter', xaf: 50, source: 'meter:application' }, { label: $localize`:@@pricing-page.row.shop:Shop with mobile money payments`, price: $localize`:@@pricing-page.row.sale:4% per sale` }, { label: $localize`:@@pricing-page.row.domain:.africa domain, first year`, price: '6 500 F', item: 'idomain.domain', xaf: 6500, source: 'domain:africa' }], href: this.urls['ideploy'] },
    { id: 'ivision', label: $localize`:@@pricing-page.detail.ivision:Visuals`, note: $localize`:@@pricing-page.detail.ivisionNote:Creating is free and marked “Made with iVision”. You pay for the HD file without the mark.`, rows: [{ label: $localize`:@@pricing-page.row.vcreate:Create a visual or video`, price: $localize`:@@pricing-page.free:Free` }, { label: $localize`:@@pricing-page.row.vexport:HD visual without the mark`, price: '100 F', item: 'ivision.export_visual', xaf: 100 }, { label: $localize`:@@pricing-page.row.vvideo:HD video without the mark`, price: '300 F', item: 'ivision.export_video', xaf: 300 }, { label: $localize`:@@pricing-page.row.vcreator:iVision Creator: every export`, price: $localize`:@@pricing-page.perMonth:${'2 000'}:INTERPOLATION: F a month`, item: 'pass.createur', xaf: 2000 }], href: this.urls['ivision'] },
    { id: 'sim', label: $localize`:@@pricing-page.detail.sim:Simulation`, note: $localize`:@@pricing-page.detail.simNote:A free first analysis, then a full test of your business before you launch.`, rows: [{ label: $localize`:@@pricing-page.row.spre:First analysis`, price: $localize`:@@pricing-page.free:Free` }, { label: $localize`:@@pricing-page.row.srun:Full simulation`, price: '1 500 F', item: 'isimulate.run', xaf: 1500 }, { label: $localize`:@@pricing-page.row.sreport:Report for your bank`, price: '2 000 F', item: 'isimulate.report', xaf: 2000 }], href: this.urls['simulation'] },
  ];
  private readonly store = inject(PromotionsStore);
  private amount(value: number): string {
    return value.toLocaleString(typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? 'en-US' : 'fr-FR');
  }

  /** Les plus petits montants réels, lus sur l'API : la version finale la moins chère, une modification. */
  protected heroDescription(): string {
    const offers = this.store.offers();
    const final = this.amount(livePhraseValue(offers, 'minFinal') ?? 500);
    const change = this.amount(offerPriceXaf(offers, 'icode.modification') ?? 25);
    return $localize`:@@pricing-page.hero.lead:Everything is created for free. You pay only to keep a result: a finished document from ${final}:FINAL: F, a change to your website ${change}:CHANGE: F, the price of an SMS.`;
  }

  /** Prix d'une ligne, tel que l'API le sert (sinon le prix de secours) ; `0` pour une ligne gratuite. */
  private rowXaf(row: PriceRow): number {
    if (!row.xaf) return 0;
    return this.store.offerPrice(row.source ?? row.item ?? null, row.xaf);
  }

  /** Lignes d'un service, de la moins chère à la plus chère (les gratuites d'abord). */
  protected sortedRows(tab: ServiceTab): PriceRow[] {
    return [...tab.rows].sort((a, b) => this.rowXaf(a) - this.rowXaf(b));
  }

  /** « dès 100 F » sous le nom de l'onglet : le plus petit prix payant du service. */
  protected fromLabel(tab: ServiceTab): string {
    const paid = tab.rows.map((row) => this.rowXaf(row)).filter((value) => value > 0);
    if (paid.length === 0) return $localize`:@@pricing-page.tab.free:free`;
    return $localize`:@@pricing-page.tab.from:from ${this.amount(Math.min(...paid))}:AMOUNT: F`;
  }

  /** Ce qui protège l'acheteur (aversion à la perte) : quatre garanties, montants lus sur l'API. */
  protected guarantees(): { title: string; text: string }[] {
    const kit = this.amount(livePhraseValue(this.store.offers(), 'kitCap') ?? 2500);
    return [
      { title: $localize`:@@pricing-page.guarantee.cap.title:Never more than the Kit`, text: $localize`:@@pricing-page.guarantee.cap.text:On a project, your purchases stop at ${kit}:AMOUNT: F: beyond that, the whole Business Kit is unlocked.` },
      { title: $localize`:@@pricing-page.guarantee.refund.title:A failed generation is not charged`, text: $localize`:@@pricing-page.guarantee.refund.text:If a generation fails, the amount goes back to your wallet automatically.` },
      { title: $localize`:@@pricing-page.guarantee.free.title:No subscription required`, text: $localize`:@@pricing-page.guarantee.free.text:Pay as you go. Plans are optional, without commitment, and your monthly purchases stop at their price.` },
      { title: $localize`:@@pricing-page.guarantee.keep.title:Nothing is deleted`, text: $localize`:@@pricing-page.guarantee.keep.text:An empty wallet only puts your website to sleep. Your drafts and documents stay yours.` },
    ];
  }

  protected noteOf(tab: ServiceTab): string {
    return tab.noteLive ? livePhrase(tab.note, this.store.offers(), tab.noteLive) : tab.note;
  }

  protected readonly activeService = signal('idem');
  protected readonly service = computed(() => this.services.find((s) => s.id === this.activeService()) ?? this.services[0]);

  protected readonly payMethods = ['MTN MoMo', 'Orange Money', 'Airtel Money', 'M-Pesa', 'Moov Money', 'Wave'];

  protected readonly moreOffers = [
    { label: $localize`:@@pricing-page.more.entreprise:IDEM Business: everything in Growth, hosting of your app and iVision Creator`, price: $localize`:@@pricing-page.perMonth:${'7 500'}:INTERPOLATION: F a month`, href: this.buy('pass-entreprise'), item: 'pass.entreprise', xaf: 7500 },
    { label: $localize`:@@pricing-page.more.createur:iVision Creator: every HD export of visuals and videos`, price: $localize`:@@pricing-page.perMonth:${'2 000'}:INTERPOLATION: F a month`, href: this.buy('pass-createur'), item: 'pass.createur', xaf: 2000 },
    { label: $localize`:@@pricing-page.more.domaine:Launch Pack with a .africa domain for one year`, price: '9 900 F', href: this.buy('pack-lancement_domaine'), item: 'pack.lancement_domaine', xaf: 9900 },
    { label: $localize`:@@pricing-page.more.plusieurs:Together: 5 Launch Packs for an association or a tontine (the 5th is free)`, price: '20 000 F', href: this.buy('pack-a_plusieurs'), item: 'pack.a_plusieurs', xaf: 20000 },
  ];

  protected readonly faq = [
    { q: $localize`:@@pricing-page.faq.q1:Why pay when ChatGPT is free?`, a: $localize`:@@pricing-page.faq.a1:You do not pay to generate: drafts are free. You pay for a finished document, sourced, laid out and ready for the bank, adapted to OHADA law and your country.` },
    { q: $localize`:@@pricing-page.faq.q2:Is there a subscription?`, a: $localize`:@@pricing-page.faq.a2:No. Plans are optional and your pay-as-you-go purchases stop at their price: you never pay more than the plan.` },
    { q: $localize`:@@pricing-page.faq.q3:Can I pay without a bank card?`, a: $localize`:@@pricing-page.faq.a3:Yes. Everything is paid by mobile money, or with an IDEM code bought in cash from an agent.` },
    { q: $localize`:@@pricing-page.faq.q4:What if a generation fails?`, a: $localize`:@@pricing-page.faq.a4:You are not charged: the amount goes back to your wallet automatically.` },
    { q: $localize`:@@pricing-page.faq.q5:What if my wallet is empty?`, a: $localize`:@@pricing-page.faq.a5:Your drafts stay. A paid website falls asleep after a reminder e-mail and wakes up when you top up. Nothing is deleted.` },
  ];

  /** Prix d'IDEM Croissance (3 000 F) dans la monnaie de chaque pays : grille de `pricing.config.json`. */
  protected readonly countries = [
    { code: 'XAF', name: 'Zone CFA', price: '3 000 F CFA' },
    { code: 'KEN', name: 'Kenya', price: '650 KES' },
    { code: 'NGA', name: 'Nigeria', price: '4 900 NGN' },
    { code: 'GHA', name: 'Ghana', price: '45 GHS' },
    { code: 'RWA', name: 'Rwanda', price: '6 500 RWF' },
    { code: 'UGA', name: 'Uganda', price: '15 000 UGX' },
    { code: 'TZA', name: 'Tanzania', price: '9 500 TZS' },
    { code: 'ETH', name: 'Ethiopia', price: '590 ETB' },
    { code: 'COD', name: 'RD Congo', price: '8 050 CDF' },
    { code: 'ZMB', name: 'Zambia', price: '75 ZMW' },
    { code: 'MOZ', name: 'Mozambique', price: '220 MZN' },
    { code: 'MWI', name: 'Malawi', price: '6 000 MWK' },
    { code: 'SLE', name: 'Sierra Leone', price: '80 SLE' },
    { code: 'LSO', name: 'Lesotho', price: '59 LSL' },
  ];
  protected readonly country = signal('XAF');
  protected readonly referenceText = computed(() => {
    const price = this.countries.find((c) => c.code === this.country())?.price ?? this.countries[0].price;
    return $localize`:@@pricing-page.pay.reference:IDEM Growth costs ${price}:INTERPOLATION: a month in your country.`;
  });

  /** Flèches gauche/droite entre les onglets (motif ARIA « tabs »). */
  protected onTabKey(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = this.services[(index + step + this.services.length) % this.services.length];
    this.activeService.set(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }
}
