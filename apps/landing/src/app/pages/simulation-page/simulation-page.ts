import { CommonModule, DOCUMENT, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import { SeoService } from '../../shared/services/seo.service';

interface FactorColumn {
  id: string;
  sector: string;
  note: string;
  /** Path data for the card glyph. Photos would misdescribe these sectors. */
  icon: string;
  factors: string[];
}

interface HeroStat {
  value: string;
  label: string;
}

interface PipelineStep {
  id: string;
  title: string;
  body: string;
}

interface Offer {
  id: string;
  name: string;
  body: string;
  highlight: boolean;
}

@Component({
  selector: 'app-simulation-page',
  standalone: true,
  imports: [CommonModule, RouterLink, NgOptimizedImage],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationPage implements OnInit {
  private readonly seoService = inject(SeoService);
  /**
   * Injected so the JSON-LD is written during prerendering as well. Crawlers
   * that do not execute JavaScript still need the FAQ and application markup
   * in the static HTML.
   */
  private readonly document = inject(DOCUMENT);

  protected readonly simulationUrl = environment.services.simulation.url;
  protected readonly dashboardUrl = environment.services.dashboard.url;

  /**
   * The point of the section: a business is not five variables, and a page
   * that lists five variables is lying about the problem.
   */
  readonly factorWall = [
    $localize`:@@simulation.factorWall.1:real demand`,
    $localize`:@@simulation.factorWall.2:customer behaviour`,
    $localize`:@@simulation.factorWall.3:pricing`,
    $localize`:@@simulation.factorWall.4:competition`,
    $localize`:@@simulation.factorWall.5:costs`,
    $localize`:@@simulation.factorWall.6:acquisition`,
    $localize`:@@simulation.factorWall.7:retention`,
    $localize`:@@simulation.factorWall.8:funding`,
    $localize`:@@simulation.factorWall.9:regulation`,
    $localize`:@@simulation.factorWall.10:seasonality`,
    $localize`:@@simulation.factorWall.11:operating capacity`,
    $localize`:@@simulation.factorWall.12:staffing`,
    $localize`:@@simulation.factorWall.13:technology`,
    $localize`:@@simulation.factorWall.14:dependencies`,
    $localize`:@@simulation.factorWall.15:economic climate`,
    $localize`:@@simulation.factorWall.16:local environment`,
    $localize`:@@simulation.factorWall.17:purchasing power`,
    $localize`:@@simulation.factorWall.18:infrastructure`,
    $localize`:@@simulation.factorWall.19:payment methods`,
    $localize`:@@simulation.factorWall.20:supply chain`,
  ];

  /** The three numbers the hero leads with, kept next to the fan. */
  readonly heroStats: HeroStat[] = [
    {
      value: $localize`:@@simulation.hero.stat1.value:60+`,
      label: $localize`:@@simulation.hero.stat1.label:factors researched per project`,
    },
    {
      value: $localize`:@@simulation.hero.stat2.value:3`,
      label: $localize`:@@simulation.hero.stat2.label:scenarios, plus stress tests`,
    },
    {
      value: $localize`:@@simulation.hero.stat3.value:5`,
      label: $localize`:@@simulation.hero.stat3.label:analysis stages, sources included`,
    },
  ];

  readonly pipeline: PipelineStep[] = [
    {
      id: 'read',
      title: $localize`:@@simulation.pipeline.read.title:Reading the project`,
      body: $localize`:@@simulation.pipeline.read.body:IDEM builds a structured picture of your project, separating what it knows from what it has to research, what stays uncertain, and what is missing.`,
    },
    {
      id: 'discover',
      title: $localize`:@@simulation.pipeline.discover.title:Factor discovery`,
      body: $localize`:@@simulation.pipeline.discover.body:Agents look for the factors that can actually move this particular business, then rank them as critical, important, secondary or uncertain.`,
    },
    {
      id: 'research',
      title: $localize`:@@simulation.pipeline.research.title:Data research`,
      body: $localize`:@@simulation.pipeline.research.body:Prices, density, costs, regulation, seasonality: every external value arrives with its source, its date and how much confidence it carries.`,
    },
    {
      id: 'simulate',
      title: $localize`:@@simulation.pipeline.simulate.title:Simulation`,
      body: $localize`:@@simulation.pipeline.simulate.body:The engine combines factors and runs baseline, favourable and adverse scenarios, stress tests, and rare compound shocks.`,
    },
    {
      id: 'analyse',
      title: $localize`:@@simulation.pipeline.analyse.title:Analysis`,
      body: $localize`:@@simulation.pipeline.analyse.body:Viability index, robustness, confidence level, breaking points, the conditions viability depends on, and recommendations ranked by priority.`,
    },
  ];

  /**
   * Two sectors whose factor lists share almost nothing. The contrast is the
   * argument: a fixed list of twenty variables would fit neither.
   */
  readonly sectorFactors: FactorColumn[] = [
    {
      id: 'delivery',
      icon: 'M4 16h1a2 2 0 1 0 4 0h6a2 2 0 1 0 4 0h1v-4l-3-4h-3V6H4z',
      sector: $localize`:@@simulation.sectors.delivery.name:Urban delivery`,
      note: $localize`:@@simulation.sectors.delivery.note:Douala, B2C, commission per trip`,
      factors: [
        $localize`:@@simulation.sectors.delivery.f1:urban density`,
        $localize`:@@simulation.sectors.delivery.f2:fuel price`,
        $localize`:@@simulation.sectors.delivery.f3:courier cost`,
        $localize`:@@simulation.sectors.delivery.f4:road conditions`,
        $localize`:@@simulation.sectors.delivery.f5:payment methods`,
        $localize`:@@simulation.sectors.delivery.f6:acquisition cost`,
        $localize`:@@simulation.sectors.delivery.f7:retention rate`,
        $localize`:@@simulation.sectors.delivery.f8:courier employment status`,
      ],
    },
    {
      id: 'farming',
      icon: 'M12 21V11m0 0c0-3.5 2.5-6.5 7-7 0 4.5-3 7.5-7 7Zm0 4c0-3-2-5.5-6-6 0 3.5 2.5 6 6 6Z',
      sector: $localize`:@@simulation.sectors.farming.name:Farming`,
      note: $localize`:@@simulation.sectors.farming.note:Western Cameroon, short supply chain, B2B`,
      factors: [
        $localize`:@@simulation.sectors.farming.f1:rainy season`,
        $localize`:@@simulation.sectors.farming.f2:yield per hectare`,
        $localize`:@@simulation.sectors.farming.f3:input prices`,
        $localize`:@@simulation.sectors.farming.f4:cold chain`,
        $localize`:@@simulation.sectors.farming.f5:post-harvest losses`,
        $localize`:@@simulation.sectors.farming.f6:transport cost`,
        $localize`:@@simulation.sectors.farming.f7:storage capacity`,
        $localize`:@@simulation.sectors.farming.f8:commodity prices`,
      ],
    },
  ];

  readonly stressTests = [
    $localize`:@@simulation.stress.q1:What happens if your main competitor cuts prices by 30%?`,
    $localize`:@@simulation.stress.q2:What happens if your acquisition cost rises by 40%?`,
    $localize`:@@simulation.stress.q3:What happens if you grow half as fast as planned?`,
    $localize`:@@simulation.stress.q4:What happens if your funding lands six months late?`,
    $localize`:@@simulation.stress.q5:What happens if a new regulation comes into force?`,
  ];

  readonly reportSections = [
    $localize`:@@simulation.report.s1:Executive summary and verdict`,
    $localize`:@@simulation.report.s2:Project profile`,
    $localize`:@@simulation.report.s3:Factors analysed and ranked`,
    $localize`:@@simulation.report.s4:Scenarios, stress tests and extreme cases`,
    $localize`:@@simulation.report.s5:Simulated financial results`,
    $localize`:@@simulation.report.s6:Sensitivity analysis`,
    $localize`:@@simulation.report.s7:Conditions viability depends on`,
    $localize`:@@simulation.report.s8:Prioritised recommendations`,
    $localize`:@@simulation.report.s9:Data, assumptions and sources`,
    $localize`:@@simulation.report.s10:What to validate in the real world`,
  ];

  readonly loopSteps = [
    $localize`:@@simulation.loop.step1:Build`,
    $localize`:@@simulation.loop.step2:Simulate`,
    $localize`:@@simulation.loop.step3:Identify`,
    $localize`:@@simulation.loop.step4:Improve`,
    $localize`:@@simulation.loop.step5:Simulate again`,
  ];

  readonly offers: Offer[] = [
    {
      id: 'run',
      name: $localize`:@@simulation.offers.run.name:Simulation`,
      body: $localize`:@@simulation.offers.run.body:The scenarios, the deciding factors, the major risks and the viability index.`,
      highlight: false,
    },
    {
      id: 'pack',
      name: $localize`:@@simulation.offers.pack.name:Simulation + report`,
      body: $localize`:@@simulation.offers.pack.body:The simulation and its full report, cheaper than buying both separately.`,
      highlight: true,
    },
    {
      id: 'report',
      name: $localize`:@@simulation.offers.report.name:Full report`,
      body: $localize`:@@simulation.offers.report.body:The detailed analysis and recommendations, for a simulation you already ran.`,
      highlight: false,
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
    this.addStructuredData();
  }

  private setupSeo(): void {
    this.seoService.setupPageSeo({
      title: $localize`:@@simulation.seo.title:IDEM Simulator — Test your business before you launch it`,
      description: $localize`:@@simulation.seo.description:Simulate the viability of your project before you invest. IDEM researches the factors that influence your business, runs scenarios and stress tests, finds where your model breaks, and delivers a detailed report with the conditions success depends on. Import your business plan or start from an IDEM project.`,
      path: '/simulation',
      keywords: $localize`:@@simulation.seo.keywords:business simulator, test business viability, business plan simulation, startup stress test, startup risk analysis, AI feasibility study, viability index, business simulation Africa, validate a business idea, IDEM Simulator`,
      ogImage: `${this.seoService.domain}/assets/seo/og-image.webp`,
    });
  }

  private addStructuredData(): void {
    if (this.document.querySelector('script[data-simulation-structured-data]')) return;

    const structuredData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: 'IDEM Simulator',
          alternateName: 'IDEM Simulation',
          description:
            'Business viability simulator. IDEM researches the factors that can influence a project, runs scenarios and stress tests, finds where the model breaks, and produces a detailed report together with the conditions viability depends on.',
          url: `${this.seoService.domain}/simulation`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web Browser',
          offers: {
            '@type': 'Offer',
            category: 'Paid',
            availability: 'https://schema.org/InStock',
          },
          featureList: [
            'Sector-aware factor discovery',
            'Baseline, favourable and adverse scenarios',
            'Stress tests and extreme scenarios',
            'Viability index with a confidence level',
            'Sensitivity analysis',
            'Conditions viability depends on',
            'Prioritised recommendations',
            'Re-simulation and version comparison',
          ],
          author: { '@type': 'Organization', name: 'Idem', url: this.seoService.domain },
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Does IDEM Simulator predict whether my business will succeed?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'No. The results are estimates based on the data, assumptions and scenarios available at the time of analysis. A high index guarantees neither viability nor profitability, and a low index does not mean the project is impossible.',
              },
            },
            {
              '@type': 'Question',
              name: 'Do I need to have built my project in IDEM to run a simulation?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'No. You can import an existing business plan as PDF, DOCX or plain text: IDEM extracts the activity, market, business model, prices and costs. Projects already built in IDEM get a reduced price, because the deliverables are already available.',
              },
            },
            {
              '@type': 'Question',
              name: 'What does the simulated viability index measure?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'It measures how robust the model is across the scenarios that were run: how well it keeps holding as the factors deteriorate. It is always shown together with a confidence level and the list of main uncertainties.',
              },
            },
            {
              '@type': 'Question',
              name: 'Is simulation included in IDEM?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'No, it is billed separately because it spends external research, several agents and compute. The amount is shown and confirmed before the run starts. The full report can be bought with the simulation or later.',
              },
            },
          ],
        },
      ],
    };

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-simulation-structured-data', 'true');
    script.textContent = JSON.stringify(structuredData);
    this.document.head.appendChild(script);
  }
}
