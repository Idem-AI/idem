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
      title: $localize`:@@about-page.values.africanFirst.title:African First`,
      description: $localize`:@@about-page.values.africanFirst.description:Built in Cameroon for Africa. Every decision prioritizes African entrepreneurs and their unique needs.`,
      icon: 'pi-flag',
    },
    {
      title: $localize`:@@about-page.values.openSource.title:Open Source`,
      description: $localize`:@@about-page.values.openSource.description:Complete transparency with Apache 2.0 license. No vendor lock-in, full control over your data.`,
      icon: 'pi-code',
    },
    {
      title: $localize`:@@about-page.values.innovation.title:Innovation`,
      description: $localize`:@@about-page.values.innovation.description:Pushing boundaries with multi-agent AI architecture and cutting-edge technology.`,
      icon: 'pi-bolt',
    },
    {
      title: $localize`:@@about-page.values.community.title:Community`,
      description: $localize`:@@about-page.values.community.description:Building together with African developers, entrepreneurs, and tech enthusiasts.`,
      icon: 'pi-users',
    },
  ];

  protected readonly milestones: Milestone[] = [
    {
      year: '2024',
      title: $localize`:@@about-page.milestones.foundation.title:Foundation`,
      description: $localize`:@@about-page.milestones.foundation.description:IDEM founded in Cameroon with a vision to democratize AI for African entrepreneurs`,
    },
    {
      year: '2024',
      title: $localize`:@@about-page.milestones.mvp.title:MVP Launch`,
      description: $localize`:@@about-page.milestones.mvp.description:First version released with core features: logo generation, business plans, and website builder`,
    },
    {
      year: '2024',
      title: $localize`:@@about-page.milestones.openSource.title:Open Source`,
      description: $localize`:@@about-page.milestones.openSource.description:Full codebase released under Apache 2.0 license, becoming Africa's first sovereign AI platform`,
    },
    {
      year: '2025',
      title: $localize`:@@about-page.milestones.expansion.title:Pan-African Expansion`,
      description: $localize`:@@about-page.milestones.expansion.description:Expanding infrastructure across Africa with local data centers and partnerships`,
    },
  ];

  protected readonly stats = [
    { value: '2024', label: $localize`:@@about-page.stats.founded:Founded` },
    { value: '1000+', label: $localize`:@@about-page.stats.projects:Projects Created` },
    { value: '15+', label: $localize`:@@about-page.stats.countries:African Countries` },
    { value: '100%', label: $localize`:@@about-page.stats.openSource:Open Source` },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = $localize`:@@about-page.seo.title:About IDEM | Africa's First Sovereign AI Platform`;
    const description = $localize`:@@about-page.seo.description:IDEM is Africa's first sovereign open source AI platform, founded in Cameroon. We democratize tech entrepreneurship by making world-class AI tools accessible and affordable for African entrepreneurs.`;

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content: $localize`:@@about-page.seo.keywords:IDEM company, African AI startup, Cameroon tech, sovereign AI platform, African entrepreneurs, open source AI, tech innovation Africa, AI for Africa`,
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
