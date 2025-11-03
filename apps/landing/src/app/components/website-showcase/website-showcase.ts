import {
  Component,
  signal,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';

interface WebsiteExample {
  id: string;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  liveUrl: string;
  technologies: string[];
}

@Component({
  selector: 'app-website-showcase',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './website-showcase.html',
  styleUrl: './website-showcase.css',
})
export class WebsiteShowcase implements OnInit, OnDestroy {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly websites = signal<WebsiteExample[]>([
    {
      id: '1',
      title: 'TechFlow Solutions',
      category: 'SaaS Platform',
      description: 'Modern B2B software solution with clean design and powerful features',
      imageUrl: '/assets/showcase/website-1.jpg',
      liveUrl: 'https://techflow-demo.idem.africa',
      technologies: ['Angular', 'Node.js', 'PostgreSQL'],
    },
    {
      id: '2',
      title: 'EcoGreen Marketplace',
      category: 'E-commerce',
      description: 'Sustainable products marketplace with integrated payment system',
      imageUrl: '/assets/showcase/website-2.jpg',
      liveUrl: 'https://ecogreen-demo.idem.africa',
      technologies: ['React', 'Express', 'MongoDB'],
    },
    {
      id: '3',
      title: 'HealthCare Connect',
      category: 'Healthcare',
      description: 'Patient management system with telemedicine capabilities',
      imageUrl: '/assets/showcase/website-3.jpg',
      liveUrl: 'https://healthcare-demo.idem.africa',
      technologies: ['Vue.js', 'Laravel', 'MySQL'],
    },
    {
      id: '4',
      title: 'EduLearn Platform',
      category: 'Education',
      description: 'Interactive learning platform with video streaming and assessments',
      imageUrl: '/assets/showcase/website-4.jpg',
      liveUrl: 'https://edulearn-demo.idem.africa',
      technologies: ['Angular', 'NestJS', 'PostgreSQL'],
    },
    {
      id: '5',
      title: 'FinTech Dashboard',
      category: 'Finance',
      description: 'Real-time financial analytics and trading dashboard',
      imageUrl: '/assets/showcase/website-5.jpg',
      liveUrl: 'https://fintech-demo.idem.africa',
      technologies: ['React', 'FastAPI', 'Redis'],
    },
    {
      id: '6',
      title: 'Creative Portfolio',
      category: 'Portfolio',
      description: 'Artist portfolio with interactive galleries and booking system',
      imageUrl: '/assets/showcase/website-6.jpg',
      liveUrl: 'https://portfolio-demo.idem.africa',
      technologies: ['Next.js', 'Strapi', 'PostgreSQL'],
    },
  ]);

  protected readonly currentIndex = signal(0);
  protected readonly isMobile = signal(false);
  private intervalId?: number;

  ngOnInit(): void {
    this.setupSeoForWebsiteShowcase();
    this.checkScreenSize();
    this.startAutoScroll();
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private startAutoScroll(): void {
    this.intervalId = window.setInterval(() => {
      const websites = this.websites();
      const current = this.currentIndex();
      const next = (current + 1) % websites.length;
      this.currentIndex.set(next);
    }, 4000);
  }

  protected goToSlide(index: number): void {
    this.currentIndex.set(index);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isMobile.set(window.innerWidth < 640); // sm breakpoint
  }

  protected getVisibleWebsites(): WebsiteExample[] {
    const websites = this.websites();
    const current = this.currentIndex();
    const result: WebsiteExample[] = [];

    // Sur mobile, afficher seulement 1 élément, sinon 3
    const itemsToShow = this.isMobile() ? 1 : 3;

    for (let i = 0; i < itemsToShow; i++) {
      const index = (current + i) % websites.length;
      result.push(websites[index]);
    }

    return result;
  }

  protected getItemsPerSlide(): number {
    return this.isMobile() ? 1 : 3;
  }

  private setupSeoForWebsiteShowcase(): void {
    // Add structured data for website showcase
    const websiteShowcaseStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'AI-Generated Website Examples',
      description: "Showcase of websites created using Idem's AI-powered development platform",
      numberOfItems: this.websites().length,
      itemListElement: this.websites().map((website, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebSite',
          name: website.title,
          description: website.description,
          url: website.liveUrl,
          image: `${this.seoService.domain}${website.imageUrl}`,
          applicationCategory: website.category,
          programmingLanguage: website.technologies,
        },
      })),
    };

    // Add structured data to page if not already present
    if (
      this.isBrowser() &&
      !document.querySelector('script[data-website-showcase-structured-data]')
    ) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-website-showcase-structured-data', 'true');
      script.textContent = JSON.stringify(websiteShowcaseStructuredData);
      document.head.appendChild(script);
    }
  }
}
