import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';
import { Team } from '../../components/team/team';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image: string;
}

interface Value {
  title: string;
  description: string;
  icon: string;
}

interface Milestone {
  year: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, RouterLink, Team],
  templateUrl: './about-page.html',
  styleUrl: './about-page.css',
})
export class AboutPage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  protected readonly values: Value[] = [
    {
      title: 'African First',
      description:
        'Built in Cameroon for Africa. Every decision prioritizes African entrepreneurs and their unique needs.',
      icon: 'pi-flag',
    },
    {
      title: 'Open Source',
      description:
        'Complete transparency with Apache 2.0 license. No vendor lock-in, full control over your data.',
      icon: 'pi-code',
    },
    {
      title: 'Innovation',
      description:
        'Pushing boundaries with multi-agent AI architecture and cutting-edge technology.',
      icon: 'pi-bolt',
    },
    {
      title: 'Community',
      description:
        'Building together with African developers, entrepreneurs, and tech enthusiasts.',
      icon: 'pi-users',
    },
  ];

  protected readonly milestones: Milestone[] = [
    {
      year: '2024',
      title: 'Foundation',
      description:
        'IDEM founded in Cameroon with a vision to democratize AI for African entrepreneurs',
    },
    {
      year: '2024',
      title: 'MVP Launch',
      description:
        'First version released with core features: logo generation, business plans, and website builder',
    },
    {
      year: '2024',
      title: 'Open Source',
      description:
        "Full codebase released under Apache 2.0 license, becoming Africa's first sovereign AI platform",
    },
    {
      year: '2025',
      title: 'Pan-African Expansion',
      description:
        'Expanding infrastructure across Africa with local data centers and partnerships',
    },
  ];

  protected readonly stats = [
    { value: '2024', label: 'Founded' },
    { value: '1000+', label: 'Projects Created' },
    { value: '15+', label: 'African Countries' },
    { value: '100%', label: 'Open Source' },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = "About IDEM | Africa's First Sovereign AI Platform";
    const description =
      "IDEM is Africa's first sovereign open source AI platform, founded in Cameroon. We democratize tech entrepreneurship by making world-class AI tools accessible and affordable for African entrepreneurs.";

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          'IDEM company, African AI startup, Cameroon tech, sovereign AI platform, African entrepreneurs, open source AI, tech innovation Africa, AI for Africa',
      },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${this.seoService.domain}/about` },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/about');
  }
}
