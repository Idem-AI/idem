import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../../../shared/services/seo.service';

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
      title: 'Website Generation',
      description: 'Create professional, responsive websites with modern design and optimized code',
      icon: 'pi-globe',
      features: [
        'Modern responsive design',
        'SEO optimized',
        'Fast loading times',
        'Mobile-first approach',
        'Customizable templates',
        'Production-ready code',
      ],
    },
    {
      title: 'Logo & Brand Identity',
      description: 'Generate unique logos and complete brand identity packages',
      icon: 'pi-palette',
      features: [
        'Custom logo designs',
        'Multiple variations',
        'Color palette generation',
        'Typography selection',
        'Brand guidelines',
        'Vector formats (SVG, PNG)',
      ],
    },
    {
      title: 'Business Plans',
      description: 'Comprehensive business plans with market research and financial projections',
      icon: 'pi-chart-line',
      features: [
        'Executive summary',
        'Market analysis',
        'Financial projections',
        'Competitive analysis',
        'Go-to-market strategy',
        'Risk assessment',
      ],
    },
    {
      title: 'Brand Charter',
      description: 'Complete brand guidelines and visual identity documentation',
      icon: 'pi-book',
      features: [
        'Brand positioning',
        'Visual guidelines',
        'Tone of voice',
        'Usage examples',
        "Do and don'ts",
        'Brand story',
      ],
    },
    {
      title: 'Technical Architecture',
      description: 'System architecture diagrams and technical documentation',
      icon: 'pi-sitemap',
      features: [
        'Architecture diagrams',
        'Tech stack recommendations',
        'Database schema',
        'API documentation',
        'Security considerations',
        'Scalability planning',
      ],
    },
    {
      title: 'Deployment Ready',
      description: 'Deploy your projects to production with one click',
      icon: 'pi-cloud-upload',
      features: [
        'Automated deployment',
        'Custom domains',
        'SSL certificates',
        'CDN integration',
        'Performance optimization',
        'Monitoring included',
      ],
    },
  ];

  protected readonly stats = [
    { value: '6+', label: 'Solutions' },
    { value: '1000+', label: 'Projects Created' },
    { value: '99%', label: 'Success Rate' },
    { value: '24/7', label: 'Available' },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = 'AI Solutions | IDEM - Complete Project Generation Platform';
    const description =
      'IDEM offers complete AI solutions: website generation, logo design, business plans, brand charters, technical architecture, and deployment. Everything you need to launch your project.';

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          'AI website generator, logo generator, business plan AI, brand identity, technical architecture, automated deployment, project generation, startup tools, entrepreneur solutions',
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
