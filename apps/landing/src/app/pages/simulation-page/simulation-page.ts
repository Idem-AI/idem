import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { SeoService } from '../../shared/services/seo.service';
import { SimulationCta } from './components/simulation-cta/simulation-cta';
import { SimulationEntry } from './components/simulation-entry/simulation-entry';
import { SimulationEvidence } from './components/simulation-evidence/simulation-evidence';
import { SimulationFactorWall } from './components/simulation-factor-wall/simulation-factor-wall';
import { SimulationHero } from './components/simulation-hero/simulation-hero';
import { SimulationHonesty } from './components/simulation-honesty/simulation-honesty';
import { SimulationLoop } from './components/simulation-loop/simulation-loop';
import { SimulationPipeline } from './components/simulation-pipeline/simulation-pipeline';
import { SimulationReadout } from './components/simulation-readout/simulation-readout';
import { SimulationReport } from './components/simulation-report/simulation-report';
import { SimulationSectors } from './components/simulation-sectors/simulation-sectors';
import { SimulationStressTests } from './components/simulation-stress-tests/simulation-stress-tests';

/**
 * Shell of the IDEM Simulator page. It owns the ambient backdrop, the SEO tags
 * and the structured data; every section of the argument is its own component
 * under `./components`.
 */
@Component({
  selector: 'app-simulation-page',
  standalone: true,
  imports: [
    SimulationHero,
    SimulationFactorWall,
    SimulationPipeline,
    SimulationSectors,
    SimulationStressTests,
    SimulationReadout,
    SimulationEvidence,
    SimulationReport,
    SimulationLoop,
    SimulationEntry,
    SimulationHonesty,
    SimulationCta,
  ],
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
          description: $localize`:@@simulation.schema.description:Business viability simulator. IDEM researches the factors that can influence a project, runs scenarios and stress tests, finds where the model breaks, and produces a detailed report together with the conditions viability depends on.`,
          url: `${this.seoService.domain}/simulation`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web Browser',
          offers: {
            '@type': 'Offer',
            category: 'Paid',
            availability: 'https://schema.org/InStock',
          },
          featureList: [
            $localize`:@@simulation.schema.feature1:Sector-aware factor discovery`,
            $localize`:@@simulation.schema.feature2:Baseline, favourable and adverse scenarios`,
            $localize`:@@simulation.schema.feature3:Stress tests and extreme scenarios`,
            $localize`:@@simulation.schema.feature4:Viability index with a confidence level`,
            $localize`:@@simulation.schema.feature5:Sensitivity analysis`,
            $localize`:@@simulation.schema.feature6:Conditions viability depends on`,
            $localize`:@@simulation.schema.feature7:Prioritised recommendations`,
            $localize`:@@simulation.schema.feature8:Re-simulation and version comparison`,
          ],
          author: { '@type': 'Organization', name: 'Idem', url: this.seoService.domain },
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: $localize`:@@simulation.faq.q1.question:Does IDEM Simulator predict whether my business will succeed?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: $localize`:@@simulation.faq.q1.answer:No. The results are estimates based on the data, assumptions and scenarios available at the time of analysis. A high index guarantees neither viability nor profitability, and a low index does not mean the project is impossible.`,
              },
            },
            {
              '@type': 'Question',
              name: $localize`:@@simulation.faq.q2.question:Do I need to have built my project in IDEM to run a simulation?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: $localize`:@@simulation.faq.q2.answer:No. You can import an existing business plan as PDF, DOCX or plain text: IDEM extracts the activity, market, business model, prices and costs. Projects already built in IDEM get a reduced price, because the deliverables are already available.`,
              },
            },
            {
              '@type': 'Question',
              name: $localize`:@@simulation.faq.q3.question:What does the simulated viability index measure?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: $localize`:@@simulation.faq.q3.answer:It measures how robust the model is across the scenarios that were run: how well it keeps holding as the factors deteriorate. It is always shown together with a confidence level and the list of main uncertainties.`,
              },
            },
            {
              '@type': 'Question',
              name: $localize`:@@simulation.faq.q4.question:Is simulation included in IDEM?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: $localize`:@@simulation.faq.q4.answer:No, it is billed separately because it spends external research, several agents and compute. The amount is shown and confirmed before the run starts. The full report can be bought with the simulation or later.`,
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
