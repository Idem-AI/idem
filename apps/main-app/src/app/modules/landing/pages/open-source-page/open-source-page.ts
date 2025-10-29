import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../../shared/services/seo.service';

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
      title: 'Full Source Code Access',
      description: 'Complete transparency with access to all source code under Apache 2.0 license.',
      benefits: [
        'Audit security and privacy',
        'Customize to your needs',
        'Learn from the codebase',
        'Contribute improvements',
      ],
    },
    {
      icon: 'pi-shield',
      title: 'Data Sovereignty',
      description: 'Your data stays in Africa with full control over storage and processing.',
      benefits: [
        'African cloud infrastructure',
        'GDPR and local compliance',
        'On-premise deployment option',
        'No vendor lock-in',
      ],
    },
    {
      icon: 'pi-users',
      title: 'Community Driven',
      description: 'Built by the community, for the community with transparent governance.',
      benefits: [
        'Open roadmap and decisions',
        'Community contributions welcome',
        'Regular updates and releases',
        'Active Discord community',
      ],
    },
    {
      icon: 'pi-lock-open',
      title: 'No Vendor Lock-in',
      description: 'Freedom to self-host, modify, and migrate without restrictions.',
      benefits: [
        'Export all your data anytime',
        'Self-host on your infrastructure',
        'Switch providers easily',
        'Full API access',
      ],
    },
  ];

  protected readonly licenseDetails: LicenseDetail[] = [
    {
      title: 'Commercial Use',
      description: 'Use IDEM for commercial purposes without restrictions',
      icon: 'pi-briefcase',
    },
    {
      title: 'Modification',
      description: 'Modify the source code to fit your specific needs',
      icon: 'pi-wrench',
    },
    {
      title: 'Distribution',
      description: 'Distribute your modified or unmodified versions',
      icon: 'pi-share-alt',
    },
    {
      title: 'Patent Grant',
      description: 'Protection against patent claims from contributors',
      icon: 'pi-verified',
    },
  ];

  protected readonly stats = [
    { value: '100%', label: 'Open Source', description: 'Apache 2.0 License' },
    { value: '0', label: 'Vendor Lock-in', description: 'Full data portability' },
    { value: 'Africa', label: 'Data Location', description: 'Sovereign infrastructure' },
    { value: 'Active', label: 'Community', description: 'Growing ecosystem' },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = 'Open Source & Data Sovereignty | IDEM - African AI Platform';
    const description =
      'IDEM is 100% open source under Apache 2.0 license with full data sovereignty. Your data stays in Africa with complete transparency, no vendor lock-in, and community-driven development.';

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          'open source AI, Apache 2.0 license, data sovereignty, African cloud, no vendor lock-in, self-hosted AI, transparent AI, community driven, open source platform, data privacy Africa, sovereign technology, African tech independence',
      },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${this.seoService.domain}/open-source` },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/open-source');
  }
}
