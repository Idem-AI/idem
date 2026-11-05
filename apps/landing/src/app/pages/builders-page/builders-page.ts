import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUILDERS_PROGRAM, type BuilderShowcaseEntry } from '@idem/shared-models/builders/program';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

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
  imports: [RouterLink, PageArtComponent],
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

  protected readonly perks: Row[] = [
    {
      title: $localize`:@@builders-page.perk.welcome.title:${francs(BUILDERS_PROGRAM.welcomeBonusXaf)}:amount: F in your wallet`,
      description: $localize`:@@builders-page.perk.welcome.description:Credited when you are accepted, once per account. Spend it on any IDEM service.`,
    },
    {
      title: $localize`:@@builders-page.perk.topup.title:+${percent(BUILDERS_PROGRAM.topupBonusRate)}:percent:% on every top-up`,
      description: $localize`:@@builders-page.perk.topup.description:Extra credit added to each wallet top-up, on top of the tier bonus, for as long as you are a member.`,
    },
    {
      title: $localize`:@@builders-page.perk.hosting.title:-${percent(BUILDERS_PROGRAM.hostingDiscountRate)}:percent:% on hosting`,
      description: $localize`:@@builders-page.perk.hosting.description:The daily iDeploy meters of your sites and apps cost less. Keeping a project online should not be what stops it.`,
    },
    {
      title: $localize`:@@builders-page.perk.showcase.title:A place in the showcase`,
      description: $localize`:@@builders-page.perk.showcase.description:Your project on this page, with its country and a link to it, in front of everyone who visits IDEM.`,
    },
    {
      title: $localize`:@@builders-page.perk.portrait.title:A story told by IDEM`,
      description: $localize`:@@builders-page.perk.portrait.description:The team regularly picks projects to feature on the IDEM blog and social channels, prepared with you.`,
    },
    {
      title: $localize`:@@builders-page.perk.badge.title:The Idem Builder badge`,
      description: $localize`:@@builders-page.perk.badge.description:A badge for your own site that says you are part of the programme and links back here.`,
    },
  ];

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

  /** L'adresse affichée sous le nom : le domaine seul, lisible. */
  protected host(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
