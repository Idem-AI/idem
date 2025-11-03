import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';

interface Feature {
  icon: string;
  title: string;
  description: string;
  benefits: string[];
}

interface LicenseDetail {
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-open-source-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './open-source-page.html',
  styleUrl: './open-source-page.css',
})
export class OpenSourcePage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  protected readonly features: Feature[] = [
    {
      icon: 'pi-code',
      title: $localize`:@@open-source-page.features.sourceCode.title:Full Source Code Access`,
      description: $localize`:@@open-source-page.features.sourceCode.description:Complete transparency with access to all source code under Apache 2.0 license.`,
      benefits: [
        $localize`:@@open-source-page.features.sourceCode.benefit1:Audit security and privacy`,
        $localize`:@@open-source-page.features.sourceCode.benefit2:Customize to your needs`,
        $localize`:@@open-source-page.features.sourceCode.benefit3:Learn from the codebase`,
        $localize`:@@open-source-page.features.sourceCode.benefit4:Contribute improvements`,
      ],
    },
    {
      icon: 'pi-shield',
      title: $localize`:@@open-source-page.features.sovereignty.title:Data Sovereignty`,
      description: $localize`:@@open-source-page.features.sovereignty.description:Your data stays in Africa with full control over storage and processing.`,
      benefits: [
        $localize`:@@open-source-page.features.sovereignty.benefit1:African cloud infrastructure`,
        $localize`:@@open-source-page.features.sovereignty.benefit2:GDPR and local compliance`,
        $localize`:@@open-source-page.features.sovereignty.benefit3:On-premise deployment option`,
        $localize`:@@open-source-page.features.sovereignty.benefit4:No vendor lock-in`,
      ],
    },
    {
      icon: 'pi-users',
      title: $localize`:@@open-source-page.features.community.title:Community Driven`,
      description: $localize`:@@open-source-page.features.community.description:Built by the community, for the community with transparent governance.`,
      benefits: [
        $localize`:@@open-source-page.features.community.benefit1:Open roadmap and decisions`,
        $localize`:@@open-source-page.features.community.benefit2:Community contributions welcome`,
        $localize`:@@open-source-page.features.community.benefit3:Regular updates and releases`,
        $localize`:@@open-source-page.features.community.benefit4:Active Discord community`,
      ],
    },
    {
      icon: 'pi-lock-open',
      title: $localize`:@@open-source-page.features.noLockIn.title:No Vendor Lock-in`,
      description: $localize`:@@open-source-page.features.noLockIn.description:Freedom to self-host, modify, and migrate without restrictions.`,
      benefits: [
        $localize`:@@open-source-page.features.noLockIn.benefit1:Export all your data anytime`,
        $localize`:@@open-source-page.features.noLockIn.benefit2:Self-host on your infrastructure`,
        $localize`:@@open-source-page.features.noLockIn.benefit3:Switch providers easily`,
        $localize`:@@open-source-page.features.noLockIn.benefit4:Full API access`,
      ],
    },
  ];

  protected readonly licenseDetails: LicenseDetail[] = [
    {
      title: $localize`:@@open-source-page.license.commercial.title:Commercial Use`,
      description: $localize`:@@open-source-page.license.commercial.description:Use IDEM for commercial purposes without restrictions`,
      icon: 'pi-briefcase',
    },
    {
      title: $localize`:@@open-source-page.license.modification.title:Modification`,
      description: $localize`:@@open-source-page.license.modification.description:Modify the source code to fit your specific needs`,
      icon: 'pi-wrench',
    },
    {
      title: $localize`:@@open-source-page.license.distribution.title:Distribution`,
      description: $localize`:@@open-source-page.license.distribution.description:Distribute your modified or unmodified versions`,
      icon: 'pi-share-alt',
    },
    {
      title: $localize`:@@open-source-page.license.patent.title:Patent Grant`,
      description: $localize`:@@open-source-page.license.patent.description:Protection against patent claims from contributors`,
      icon: 'pi-verified',
    },
  ];

  protected readonly stats = [
    {
      value: '100%',
      label: $localize`:@@open-source-page.stats.openSource.label:Open Source`,
      description: $localize`:@@open-source-page.stats.openSource.description:Apache 2.0 License`,
    },
    {
      value: '0',
      label: $localize`:@@open-source-page.stats.noLockIn.label:Vendor Lock-in`,
      description: $localize`:@@open-source-page.stats.noLockIn.description:Full data portability`,
    },
    {
      value: 'Africa',
      label: $localize`:@@open-source-page.stats.dataLocation.label:Data Location`,
      description: $localize`:@@open-source-page.stats.dataLocation.description:Sovereign infrastructure`,
    },
    {
      value: 'Active',
      label: $localize`:@@open-source-page.stats.community.label:Community`,
      description: $localize`:@@open-source-page.stats.community.description:Growing ecosystem`,
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = $localize`:@@open-source-page.seo.title:Open Source & Data Sovereignty | IDEM - African AI Platform`;
    const description = $localize`:@@open-source-page.seo.description:IDEM is 100% open source under Apache 2.0 license with full data sovereignty. Your data stays in Africa with complete transparency, no vendor lock-in, and community-driven development.`;

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content: $localize`:@@open-source-page.seo.keywords:open source AI, Apache 2.0 license, data sovereignty, African cloud, no vendor lock-in, self-hosted AI, transparent AI, community driven, open source platform, data privacy Africa, sovereign technology, African tech independence`,
      },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: $localize`:@@open-source-page.seo.ogType:website` },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${this.seoService.domain}/open-source` },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/open-source');
  }
}
