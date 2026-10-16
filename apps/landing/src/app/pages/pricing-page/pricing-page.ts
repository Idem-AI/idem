import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '../../../environments/environment';

interface PriceRow {
  label: string;
  price: string;
  note?: string;
}

interface OfferCard {
  name: string;
  price: string;
  period?: string;
  annual?: string;
  text: string;
  highlighted?: boolean;
}

/**
 * Les prix publics — modèle « Créer, Garder, Faire tourner, Grandir ».
 *
 * Source des montants : `apps/api/api/models/offer.model.ts` (l'API facture, cette page affiche).
 * Un seul portefeuille, rechargé en mobile money ; chaque service garde sa propre unité (livrable,
 * jour de compteur, export, simulation) et des packs les réunissent.
 */
@Component({
  selector: 'app-pricing-page',
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingPage {
  protected readonly signupUrl = `${environment.services.dashboard.url}/login`;
  protected readonly appgenUrl = environment.services.idev.url;
  protected readonly ideployUrl = environment.services.ideploy.url;

  protected readonly steps = [
    { title: $localize`:@@pricing-page.steps.create.title:Create`, price: $localize`:@@pricing-page.steps.create.price:Free`, text: $localize`:@@pricing-page.steps.create.text:Business plan, logo, pitch deck, statutes, website: everything in draft, with no time limit.` },
    { title: $localize`:@@pricing-page.steps.keep.title:Keep`, price: $localize`:@@pricing-page.steps.keep.price:From 500 F`, text: $localize`:@@pricing-page.steps.keep.text:Unlock the final version of what you use. The whole Business Kit never costs more than 2,500 F per project.` },
    { title: $localize`:@@pricing-page.steps.run.title:Run`, price: $localize`:@@pricing-page.steps.run.price:From 10 F/day`, text: $localize`:@@pricing-page.steps.run.text:Your site online, your monthly content, your app: paid by the day or by the piece, capped every month.` },
    { title: $localize`:@@pricing-page.steps.grow.title:Grow`, price: $localize`:@@pricing-page.steps.grow.price:4% per sale`, text: $localize`:@@pricing-page.steps.grow.text:Sell online with mobile money: IDEM takes a small commission only when you get paid.` },
  ];

  protected readonly deliverables: PriceRow[] = [
    { label: $localize`:@@pricing-page.d.logo:Logo + full brand guidelines`, price: '1 500 F' },
    { label: $localize`:@@pricing-page.d.bp:Business plan with sourced market data`, price: '2 000 F' },
    { label: $localize`:@@pricing-page.d.deck:Pitch deck`, price: '1 000 F' },
    { label: $localize`:@@pricing-page.d.legal:OHADA legal kit`, price: '1 500 F' },
    { label: $localize`:@@pricing-page.d.forecast:3-year financial forecast`, price: '1 000 F' },
    { label: $localize`:@@pricing-page.d.cards:Business cards`, price: '500 F' },
  ];

  protected readonly communication: PriceRow[] = [
    { label: $localize`:@@pricing-page.comm.flyer:Flyer / post visual`, price: '100 F' },
    { label: $localize`:@@pricing-page.comm.carousel:Carousel (up to 10 slides)`, price: '200 F' },
    { label: $localize`:@@pricing-page.comm.video:Motion design video (stock footage, voice-over)`, price: '300 F' },
    { label: $localize`:@@pricing-page.comm.clip:AI-filmed shot (5 s)`, price: '+1 000 F' },
    { label: $localize`:@@pricing-page.comm.calendar:Monthly editorial calendar`, price: '500 F' },
    { label: $localize`:@@pricing-page.comm.strategy:Communication strategy`, price: '1 000 F' },
  ];

  protected readonly passes: OfferCard[] = [
    { name: $localize`:@@pricing-page.passes.croissance.name:IDEM Growth`, price: '3 000 F', annual: '30 000', text: $localize`:@@pricing-page.passes.croissance.text:Unlimited communication (fair use), unlimited edits on every deliverable, showcase site always on, 20 iCode changes per month, one simulation per quarter.`, highlighted: true },
    { name: $localize`:@@pricing-page.passes.entreprise.name:IDEM Business`, price: '7 500 F', annual: '75 000', text: $localize`:@@pricing-page.passes.entreprise.text:Everything in Growth, plus the iDeploy Application meter, iVision Creator and a domain included with the yearly plan.` },
    { name: $localize`:@@pricing-page.passes.createur.name:iVision Creator`, price: '2 000 F', annual: '20 000', text: $localize`:@@pricing-page.passes.createur.text:Every iVision HD export included (fair use: 60 visuals, 6 videos per month).` },
  ];

  protected readonly icode: PriceRow[] = [
    { label: $localize`:@@pricing-page.icode.generate:Generate your app and watch it run`, price: $localize`:@@pricing-page.steps.create.price:Free` },
    { label: $localize`:@@pricing-page.icode.pass:Project Pass — code, GitHub, one-click deploy, 30 changes`, price: '1 000 F', note: $localize`:@@pricing-page.icode.once:once per project` },
    { label: $localize`:@@pricing-page.icode.change:One change`, price: '25 F' },
    { label: $localize`:@@pricing-page.icode.pack:Pack of 100 changes`, price: '2 000 F' },
    { label: $localize`:@@pricing-page.icode.premium:Change with the most powerful model`, price: '75 F' },
  ];

  protected readonly meters: PriceRow[] = [
    { label: $localize`:@@pricing-page.ideploy.veille:Standby — site on yourproject.idem.africa, woken up on visit`, price: $localize`:@@pricing-page.ideploy.free:free` },
    { label: $localize`:@@pricing-page.ideploy.vitrine:Showcase — site always on`, price: $localize`:@@pricing-page.ideploy.perDay:${'10'}:INTERPOLATION: F/day` },
    { label: $localize`:@@pricing-page.ideploy.application:Application + database`, price: $localize`:@@pricing-page.ideploy.perDay:${'50'}:INTERPOLATION: F/day` },
    { label: $localize`:@@pricing-page.ideploy.applicationPlus:Application+ — 2 GB, daily backups`, price: $localize`:@@pricing-page.ideploy.perDay:${'150'}:INTERPOLATION: F/day` },
    { label: $localize`:@@pricing-page.ideploy.boutique:Shop — showcase + mobile money payments`, price: $localize`:@@pricing-page.ideploy.perSale:4% per sale` },
  ];

  protected readonly ivision: PriceRow[] = [
    { label: $localize`:@@pricing-page.ivision.free:Visuals and videos marked “Made with iVision”`, price: $localize`:@@pricing-page.steps.create.price:Free` },
    { label: $localize`:@@pricing-page.ivision.visual:HD export without the mark: visual`, price: '100 F' },
    { label: $localize`:@@pricing-page.ivision.video:HD export without the mark: video`, price: '300 F' },
    { label: $localize`:@@pricing-page.ivision.clip:AI-filmed shot (5 s)`, price: '+1 000 F' },
    { label: $localize`:@@pricing-page.ivision.createur:iVision Creator: everything included`, price: '2 000 F', note: $localize`:@@pricing-page.perMonth:/month` },
  ];

  protected readonly simulations: PriceRow[] = [
    { label: $localize`:@@pricing-page.sim.run:Full simulation (from an IDEM project)`, price: '1 500 F' },
    { label: $localize`:@@pricing-page.sim.runPublic:Full simulation (imported business plan)`, price: '2 500 F' },
    { label: $localize`:@@pricing-page.sim.report:Report for the bank`, price: '2 000 F' },
    { label: $localize`:@@pricing-page.sim.rerun:New run (within 90 days)`, price: '500 F' },
  ];

  protected readonly packs: OfferCard[] = [
    { name: $localize`:@@pricing-page.packs.lancement.name:Launch Pack`, price: '5 000 F', text: $localize`:@@pricing-page.packs.lancement.text:Business Kit + iCode Project Pass (30 changes) + 3 months of showcase site always on.`, highlighted: true },
    { name: $localize`:@@pricing-page.packs.domaine.name:Launch Pack + domain`, price: '9 900 F', text: $localize`:@@pricing-page.packs.domaine.text:The Launch Pack and a .africa domain for one year, at cost.` },
    { name: $localize`:@@pricing-page.packs.plusieurs.name:Together`, price: '20 000 F', text: $localize`:@@pricing-page.packs.plusieurs.text:5 Launch Packs to give away (the 5th is free): association, tontine, cooperative.` },
  ];

  protected readonly faq = [
    { q: $localize`:@@pricing-page.faq.q1:Why pay when ChatGPT is free?`, a: $localize`:@@pricing-page.faq.a1:You do not pay to generate: drafts are free. You pay for a finished, sourced deliverable, laid out and ready for the bank, adapted to OHADA law and your country, and kept in one place with your brand.` },
    { q: $localize`:@@pricing-page.faq.q2:Is there a subscription?`, a: $localize`:@@pricing-page.faq.a2:No. The monthly plans are optional, and your pay-as-you-go purchases stop at their price: you can never pay more than the plan.` },
    { q: $localize`:@@pricing-page.faq.q3:What happens if my wallet is empty?`, a: $localize`:@@pricing-page.faq.a3:Your drafts stay available. A paid iDeploy application falls asleep after a reminder email; top up and it wakes up. Nothing is deleted.` },
  ];

  protected readonly perYear = (amount: string) => $localize`:@@pricing-page.perYear:or ${amount}:INTERPOLATION: F/year — 2 months free`;
}
