import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';
import { Team } from '../../components/team/team';

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
      title: $localize`:@@about-page.values.sovereignty.title:Souveraineté Africaine`,
      description: $localize`:@@about-page.values.sovereignty.description:Chaque décision est évaluée selon son impact sur la mission de démocratiser l'entrepreneuriat et de renforcer la souveraineté numérique africaine.`,
      icon: 'sovereignty',
    },
    {
      title: $localize`:@@about-page.values.discipline.title:Discipline`,
      description: $localize`:@@about-page.values.discipline.description:Rigueur dans l'exécution, excellence technique, code review systématique, respect des processus et des engagements.`,
      icon: 'discipline',
    },
    {
      title: $localize`:@@about-page.values.passion.title:Passion`,
      description: $localize`:@@about-page.values.passion.description:Engagement total envers la mission, énergie contagieuse, fierté du travail accompli, enthousiasme pour l'innovation technologique africaine.`,
      icon: 'passion',
    },
    {
      title: $localize`:@@about-page.values.patience.title:Patience`,
      description: $localize`:@@about-page.values.patience.description:Construction solide sur le long terme, apprentissage continu, acceptation des échecs comme opportunités, croissance durable plutôt que raccourcis.`,
      icon: 'patience',
    },
    {
      title: $localize`:@@about-page.values.perseverance.title:Persévérance`,
      description: $localize`:@@about-page.values.perseverance.description:Détermination face aux obstacles, résilience dans l'adversité, engagement inébranlable envers la vision, refus d'abandonner malgré les défis.`,
      icon: 'perseverance',
    },
  ];

  protected readonly milestones: Milestone[] = [
    {
      year: '2025',
      title: $localize`:@@about-page.milestones.foundation.title:Foundation`,
      description: $localize`:@@about-page.milestones.foundation.description:IDEM founded in Cameroon with a vision to democratize AI for African entrepreneurs`,
    },
    {
      year: '2027',
      title: $localize`:@@about-page.milestones.mvp.title:MVP Launch`,
      description: $localize`:@@about-page.milestones.mvp.description:First version released with core features: logo generation, business plans, and website builder`,
    },
    {
      year: '2028',
      title: $localize`:@@about-page.milestones.openSource.title:Open Source`,
      description: $localize`:@@about-page.milestones.openSource.description:Full codebase released under Apache 2.0 license, becoming Africa's first sovereign AI platform`,
    },
    {
      year: '2029',
      title: $localize`:@@about-page.milestones.expansion.title:Pan-African Expansion`,
      description: $localize`:@@about-page.milestones.expansion.description:Expanding infrastructure across Africa with local data centers and partnerships`,
    },
  ];

  protected readonly stats = [
    { value: '2025', label: $localize`:@@about-page.stats.founded:Founded` },
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
