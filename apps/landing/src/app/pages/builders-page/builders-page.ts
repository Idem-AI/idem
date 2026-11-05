import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUILDERS_PROGRAM, type BuilderShowcaseEntry } from '@idem/shared-models/builders/program';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';
import { BuildersArtComponent } from './builders-art';

interface Row {
  title: string;
  description: string;
}

type ShowcaseState = 'loading' | 'ready' | 'error';

const percent = (rate: number) => Math.round(rate * 100);
const francs = (amount: number) => amount.toLocaleString('fr-FR').replace(/\s/g, ' ');

/**
 * Idem Builders : le programme qui fait connaître les projets africains gérés
 * avec IDEM.
 *
 * Les chiffres viennent de `BUILDERS_PROGRAM` (`@idem/shared-models`), la même
 * source que l'API qui les applique et que la console qui les annonce : la
 * page ne peut pas promettre un autre montant que celui qui sera versé.
 *
 * La vitrine est lue **dans le navigateur**, comme le blog : un projet admis
 * ce matin n'attend pas la prochaine reconstruction du site.
 */
@Component({
  selector: 'app-builders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageArtComponent, BuildersArtComponent],
  templateUrl: './builders-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './builders-page.css'],
})
export class BuildersPage {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Sans compte, la console fait créer le compte puis revient sur la candidature. */
  protected readonly joinUrl = `${environment.services.dashboard.url}/builders`;

  protected readonly showcaseState = signal<ShowcaseState>('loading');
  protected readonly builders = signal<BuilderShowcaseEntry[]>([]);

  /** Les trois façons d'être « géré avec IDEM » : une seule suffit. */
  protected readonly ways: Row[] = [
    {
      title: $localize`:@@builders-page.way.deploy.title:Put it online with iDeploy`,
      description: $localize`:@@builders-page.way.deploy.description:Your website or app runs on IDEM hosting, published from iCode or from your own code.`,
    },
    {
      title: $localize`:@@builders-page.way.communication.title:Manage its marketing in IDEM`,
      description: $localize`:@@builders-page.way.communication.description:Your strategy, calendar, visuals or videos are prepared and published from IDEM.`,
    },
    {
      title: $localize`:@@builders-page.way.domain.title:Register its domain with IDEM`,
      description: $localize`:@@builders-page.way.domain.description:Its address on the web was bought and is renewed through IDEM.`,
    },
  ];

  /** Les avantages, chiffres compris : ils viennent de `BUILDERS_PROGRAM`. */
  protected readonly perks: Row[] = [
    {
      title: $localize`:@@builders-page.benefit.welcome.title:${francs(BUILDERS_PROGRAM.welcomeBonusXaf)}:amount: F when you are accepted`,
      description: $localize`:@@builders-page.benefit.welcome.body:Paid into your wallet once per account, for any IDEM service.`,
    },
    {
      title: $localize`:@@builders-page.benefit.topup.title:+${percent(BUILDERS_PROGRAM.topupBonusRate)}:percent:% on every top-up`,
      description: $localize`:@@builders-page.benefit.topup.body:Added on top of the tier bonus, for as long as you are a member.`,
    },
    {
      title: $localize`:@@builders-page.benefit.hosting.title:-${percent(BUILDERS_PROGRAM.hostingDiscountRate)}:percent:% on hosting`,
      description: $localize`:@@builders-page.benefit.hosting.body:The daily price of your iDeploy meters drops, for sites and apps alike.`,
    },
    {
      title: $localize`:@@builders-page.perk.showcase.title:A place in the showcase`,
      description: $localize`:@@builders-page.benefit.showcase.body:Your project on idem.africa/builders, with its country and a link to it.`,
    },
    {
      title: $localize`:@@builders-page.benefit.portrait.title:A feature by the team`,
      description: $localize`:@@builders-page.benefit.portrait.body:Selected projects are told on the IDEM blog and social channels, prepared with you.`,
    },
    {
      title: $localize`:@@builders-page.perk.badge.title:The Idem Builder badge`,
      description: $localize`:@@builders-page.benefit.badge.body:For your own site: it shows you belong and links back here.`,
    },
  ];

  /**
   * L'aperçu du portefeuille d'un membre : les écritures exactes que l'API
   * inscrit (bonus de bienvenue, bonus Builders sur une recharge de 10 000 F).
   */
  protected readonly ledger = {
    welcome: `+${francs(BUILDERS_PROGRAM.welcomeBonusXaf)} F`,
    topup: `+${francs(10_000)} F`,
    topupBonus: `+${francs(Math.round(10_000 * BUILDERS_PROGRAM.topupBonusRate))} F`,
    topupRate: percent(BUILDERS_PROGRAM.topupBonusRate),
  };

  protected readonly steps: Row[] = [
    {
      title: $localize`:@@builders-page.step.account.title:Sign in to IDEM`,
      description: $localize`:@@builders-page.step.account.description:Create your account if you do not have one yet. It is free.`,
    },
    {
      title: $localize`:@@builders-page.step.project.title:Pick your project`,
      description: $localize`:@@builders-page.step.project.description:IDEM shows you right away whether it is run with IDEM, and what to do if it is not yet.`,
    },
    {
      title: $localize`:@@builders-page.step.pitch.title:Tell us how it puts Africa forward`,
      description: $localize`:@@builders-page.step.pitch.description:The problem you solve, for whom, where. A few lines are enough; this is what the team reads.`,
    },
    {
      title: $localize`:@@builders-page.step.answer.title:Get the answer by email`,
      description: $localize`:@@builders-page.step.answer.description:A person from the team reviews every application, within ${BUILDERS_PROGRAM.reviewDays}:days: working days. Accepted, your benefits are active at once.`,
    },
  ];

  protected readonly questions: Row[] = [
    {
      title: $localize`:@@builders-page.faq.free.question:Does it cost anything?`,
      description: $localize`:@@builders-page.faq.free.answer:No. Joining is free and does not oblige you to buy anything. The benefits apply to what you already use.`,
    },
    {
      title: $localize`:@@builders-page.faq.several.question:Can I submit several projects?`,
      description: $localize`:@@builders-page.faq.several.answer:Yes, one application per project. The welcome bonus is paid once per account; the other benefits apply to the whole account.`,
    },
    {
      title: $localize`:@@builders-page.faq.refused.question:What if my application is not accepted?`,
      description: $localize`:@@builders-page.faq.refused.answer:You receive the reason by email. Once the project has changed, you can apply again.`,
    },
    {
      title: $localize`:@@builders-page.faq.leave.question:Can I leave the programme?`,
      description: $localize`:@@builders-page.faq.leave.answer:At any time, by writing to us. You can also ask to hide your project from the showcase and stay a member.`,
    },
  ];

  /** La vitrine vide : le premier projet admis l'ouvre. */
  protected readonly emptyFirst = $localize`:@@builders-page.showcase.emptyFirst:This list opens with you`;

  /** Ce que la vitrine dit d'elle-même : combien de projets, combien de pays. */
  protected readonly stats = computed(() => {
    const builders = this.builders();
    const countries = new Set(builders.map((b) => b.country?.trim()).filter((c): c is string => !!c));
    return { projects: builders.length, countries: countries.size };
  });

  protected readonly statsLabel = computed(() => {
    const { projects, countries } = this.stats();
    return countries > 0
      ? $localize`:@@builders-page.showcase.stats:${projects}:projects: projects · ${countries}:countries: countries`
      : $localize`:@@builders-page.showcase.statsNoCountry:${projects}:projects: projects`;
  });

  constructor() {
    // Pas d'appel au prérendu : la vitrine se charge chez le visiteur.
    if (this.isBrowser) this.loadShowcase();
  }

  protected loadShowcase(): void {
    this.showcaseState.set('loading');
    this.http
      .get<{ builders: BuilderShowcaseEntry[] }>(`${environment.services.api.url}/builders/showcase`)
      .subscribe({
        next: ({ builders }) => {
          this.builders.set(builders);
          this.showcaseState.set('ready');
        },
        error: () => this.showcaseState.set('error'),
      });
  }

  /** Les initiales, dans le médaillon du pagne de chaque projet. */
  protected initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
    return letters.toUpperCase();
  }

  /** L'adresse affichée sous le nom : le domaine seul, lisible. */
  protected host(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
