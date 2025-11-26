import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';

interface Solution {
  title: string;
  description: string;
  icon: string;
  features: string[];
  image?: string;
}

@Component({
  selector: 'app-solutions-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './solutions-page.html',
  styleUrl: './solutions-page.css',
})
export class SolutionsPage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  protected readonly solutions: Solution[] = [
    {
      title: $localize`:@@solutions-page.solutions.website.title:Website Generation`,
      description: $localize`:@@solutions-page.solutions.website.description:Create professional, responsive websites with modern design and optimized code`,
      icon: 'pi-globe',
      features: [
        $localize`:@@solutions-page.solutions.website.feature1:Modern responsive design`,
        $localize`:@@solutions-page.solutions.website.feature2:SEO optimized`,
        $localize`:@@solutions-page.solutions.website.feature3:Fast loading times`,
        $localize`:@@solutions-page.solutions.website.feature4:Mobile-first approach`,
        $localize`:@@solutions-page.solutions.website.feature5:Customizable templates`,
        $localize`:@@solutions-page.solutions.website.feature6:Production-ready code`,
      ],
    },
    {
      title: $localize`:@@solutions-page.solutions.logo.title:Logo & Brand Identity`,
      description: $localize`:@@solutions-page.solutions.logo.description:Generate unique logos and complete brand identity packages`,
      icon: 'pi-palette',
      features: [
        $localize`:@@solutions-page.solutions.logo.feature1:Custom logo designs`,
        $localize`:@@solutions-page.solutions.logo.feature2:Multiple variations`,
        $localize`:@@solutions-page.solutions.logo.feature3:Color palette generation`,
        $localize`:@@solutions-page.solutions.logo.feature4:Typography selection`,
        $localize`:@@solutions-page.solutions.logo.feature5:Brand guidelines`,
        $localize`:@@solutions-page.solutions.logo.feature6:Vector formats (SVG, PNG)`,
      ],
    },
    {
      title: $localize`:@@solutions-page.solutions.businessPlan.title:Business Plans`,
      description: $localize`:@@solutions-page.solutions.businessPlan.description:Comprehensive business plans with market research and financial projections`,
      icon: 'pi-chart-line',
      features: [
        $localize`:@@solutions-page.solutions.businessPlan.feature1:Executive summary`,
        $localize`:@@solutions-page.solutions.businessPlan.feature2:Market analysis`,
        $localize`:@@solutions-page.solutions.businessPlan.feature3:Financial projections`,
        $localize`:@@solutions-page.solutions.businessPlan.feature4:Competitive analysis`,
        $localize`:@@solutions-page.solutions.businessPlan.feature5:Go-to-market strategy`,
        $localize`:@@solutions-page.solutions.businessPlan.feature6:Risk assessment`,
      ],
    },
    {
      title: $localize`:@@solutions-page.solutions.brandCharter.title:Brand Charter`,
      description: $localize`:@@solutions-page.solutions.brandCharter.description:Complete brand guidelines and visual identity documentation`,
      icon: 'pi-book',
      features: [
        $localize`:@@solutions-page.solutions.brandCharter.feature1:Brand positioning`,
        $localize`:@@solutions-page.solutions.brandCharter.feature2:Visual guidelines`,
        $localize`:@@solutions-page.solutions.brandCharter.feature3:Tone of voice`,
        $localize`:@@solutions-page.solutions.brandCharter.feature4:Usage examples`,
        $localize`:@@solutions-page.solutions.brandCharter.feature5:Do and don'ts`,
        $localize`:@@solutions-page.solutions.brandCharter.feature6:Brand story`,
      ],
    },
    {
      title: $localize`:@@solutions-page.solutions.architecture.title:Technical Architecture`,
      description: $localize`:@@solutions-page.solutions.architecture.description:System architecture diagrams and technical documentation`,
      icon: 'pi-sitemap',
      features: [
        $localize`:@@solutions-page.solutions.architecture.feature1:Architecture diagrams`,
        $localize`:@@solutions-page.solutions.architecture.feature2:Tech stack recommendations`,
        $localize`:@@solutions-page.solutions.architecture.feature3:Database schema`,
        $localize`:@@solutions-page.solutions.architecture.feature4:API documentation`,
        $localize`:@@solutions-page.solutions.architecture.feature5:Security considerations`,
        $localize`:@@solutions-page.solutions.architecture.feature6:Scalability planning`,
      ],
    },
    {
      title: $localize`:@@solutions-page.solutions.deployment.title:Deployment Ready`,
      description: $localize`:@@solutions-page.solutions.deployment.description:Deploy your projects to production with one click`,
      icon: 'pi-cloud-upload',
      features: [
        $localize`:@@solutions-page.solutions.deployment.feature1:Automated deployment`,
        $localize`:@@solutions-page.solutions.deployment.feature2:Custom domains`,
        $localize`:@@solutions-page.solutions.deployment.feature3:SSL certificates`,
        $localize`:@@solutions-page.solutions.deployment.feature4:CDN integration`,
        $localize`:@@solutions-page.solutions.deployment.feature5:Performance optimization`,
        $localize`:@@solutions-page.solutions.deployment.feature6:Monitoring included`,
      ],
    },
  ];

  protected readonly stats = [
    { value: '6+', label: $localize`:@@solutions-page.stats.solutions:Solutions` },
    { value: '1000+', label: $localize`:@@solutions-page.stats.projects:Projects Created` },
    { value: '99%', label: $localize`:@@solutions-page.stats.successRate:Success Rate` },
    { value: '24/7', label: $localize`:@@solutions-page.stats.available:Available` },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = $localize`:@@solutions-page.seo.title:AI Solutions | IDEM - Complete Project Generation Platform`;
    const description = $localize`:@@solutions-page.seo.description:IDEM offers complete AI solutions: website generation, logo design, business plans, brand charters, technical architecture, and deployment. Everything you need to launch your project.`;

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content: $localize`:@@solutions-page.seo.keywords:AI website generator, logo generator, business plan AI, brand identity, technical architecture, automated deployment, project generation, startup tools, entrepreneur solutions`,
      },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${this.seoService.domain}/solutions` },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/solutions');
  }
}
