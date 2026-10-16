import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Team } from '../../components/team/team';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

interface Commitment {
  /** Le chiffre qui rend l'engagement vérifiable. */
  figure: string;
  title: string;
  description: string;
}

interface Value {
  title: string;
  description: string;
}

interface Milestone {
  year: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Team, PageArtComponent],
  templateUrl: './about-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './about-page.css'],
})
export class AboutPage {
  /** Trois engagements, chacun porté par un chiffre qu'on peut vérifier. */
  protected readonly commitments: Commitment[] = [
    {
      figure: '0 F',
      title: $localize`:@@about-page.commitments.free.title:Start without paying`,
      description: $localize`:@@about-page.commitments.free.description:Describe your project, see every deliverable, pay only for what you keep. No card asked for.`,
    },
    {
      figure: '3–5×',
      title: $localize`:@@about-page.commitments.price.title:Priced for the continent`,
      description: $localize`:@@about-page.commitments.price.description:Three to five times below the international platforms, billed in CFA francs, paid by Mobile Money.`,
    },
    {
      figure: 'Apache 2.0',
      title: $localize`:@@about-page.commitments.open.title:Readable, forkable, yours`,
      description: $localize`:@@about-page.commitments.open.description:The whole codebase is public, under Apache 2.0 with the Commons Clause. Audit it, run it on your own machine, deliver client work with it. Reselling IDEM itself is the one thing it rules out.`,
    },
  ];

  protected readonly values: Value[] = [
    {
      title: $localize`:@@about-page.values.sovereignty.title:African sovereignty`,
      description: $localize`:@@about-page.values.sovereignty.description:Every technical choice is weighed against one question: who keeps control of the code and the data.`,
    },
    {
      title: $localize`:@@about-page.values.discipline.title:Discipline`,
      description: $localize`:@@about-page.values.discipline.description:We ship what works. A feature that cannot be explained in one sentence is not finished.`,
    },
    {
      title: $localize`:@@about-page.values.passion.title:Passion`,
      description: $localize`:@@about-page.values.passion.description:We build for the entrepreneurs we grew up around, and we use the platform for our own company.`,
    },
    {
      title: $localize`:@@about-page.values.patience.title:Patience`,
      description: $localize`:@@about-page.values.patience.description:Infrastructure takes years. We would rather be solid in five years than loud this quarter.`,
    },
    {
      title: $localize`:@@about-page.values.perseverance.title:Perseverance`,
      description: $localize`:@@about-page.values.perseverance.description:Power cuts, payment rails, bandwidth. The obstacles are known, and none of them is a reason to stop.`,
    },
  ];

  protected readonly milestones: Milestone[] = [
    {
      year: '2025',
      title: $localize`:@@about-page.milestones.foundation.title:IDEM is founded in Douala`,
      description: $localize`:@@about-page.milestones.foundation.description:Two co-founders, one question: why does a Cameroonian entrepreneur pay four times more for the same tooling?`,
    },
    {
      year: '2027',
      title: $localize`:@@about-page.milestones.mvp.title:First public version`,
      description: $localize`:@@about-page.milestones.mvp.description:Brand identity, business plan, website and go-live, generated end to end from a single description.`,
    },
    {
      year: '2028',
      title: $localize`:@@about-page.milestones.openSource.title:The codebase goes public`,
      description: $localize`:@@about-page.milestones.openSource.description:Everything released under Apache 2.0, with self-hosting documented so nobody depends on us to keep running.`,
    },
    {
      year: '2029',
      title: $localize`:@@about-page.milestones.expansion.title:Hosting on the continent`,
      description: $localize`:@@about-page.milestones.expansion.description:Data centres and payment partners country by country, so latency and currency stop being obstacles.`,
    },
  ];
}
