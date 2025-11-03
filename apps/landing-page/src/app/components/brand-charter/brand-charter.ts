import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';

interface BrandElement {
  id: string;
  title: string;
  description: string;
  icon: string;
  examples: string[];
}

interface BrandShowcase {
  id: string;
  brandName: string;
  industry: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoStyle: string;
  description: string;
}

@Component({
  selector: 'app-brand-charter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './brand-charter.html',
  styleUrl: './brand-charter.css',
})
export class BrandCharter implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly activeTab = signal<string>('elements');
  protected readonly showAll = signal<boolean>(false);
  protected readonly showAllElements = signal<boolean>(false);

  protected readonly brandElements = signal<BrandElement[]>([
    {
      id: 'colors',
      title: 'Color Palette',
      description: 'Colors that reflect your brand personality',
      icon: 'pi-palette',
      examples: ['Primary Colors', 'Secondary Colors', 'Accent Colors'],
    },
    {
      id: 'typography',
      title: 'Typography',
      description: 'Font families for consistent communication',
      icon: 'pi-font',
      examples: ['Headings Font', 'Body Text Font', 'Display Font'],
    },
    {
      id: 'logo',
      title: 'Logo Variations',
      description: 'Logo formats for different use cases',
      icon: 'pi-star',
      examples: ['Primary Logo', 'Secondary Mark', 'Icon Version'],
    },
    {
      id: 'imagery',
      title: 'Visual Style',
      description: 'Visual elements that support your brand',
      icon: 'pi-image',
      examples: ['Photography Style', 'Illustration Style', 'Icon Style'],
    },
  ]);

  protected readonly brandShowcases = signal<BrandShowcase[]>([
    {
      id: '1',
      brandName: 'TechFlow Solutions',
      industry: 'Technology',
      primaryColor: '#1447e6',
      secondaryColor: '#22d3ee',
      fontFamily: 'Inter',
      logoStyle: 'Modern Geometric',
      description: 'Professional B2B SaaS brand identity',
    },
    {
      id: '2',
      brandName: 'EcoGreen Marketplace',
      industry: 'Environmental',
      primaryColor: '#22c55e',
      secondaryColor: '#16a34a',
      fontFamily: 'Poppins',
      logoStyle: 'Organic Natural',
      description: 'Eco-friendly brand for green products',
    },
    {
      id: '3',
      brandName: 'CreativeStudio',
      industry: 'Design Agency',
      primaryColor: '#d11ec0',
      secondaryColor: '#9333ea',
      fontFamily: 'Montserrat',
      logoStyle: 'Artistic Bold',
      description: 'Creative brand for design agency',
    },
  ]);

  ngOnInit(): void {
    this.setupSeoForBrandCharter();
  }

  protected setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }

  protected toggleShowAll(): void {
    this.showAll.set(!this.showAll());
  }

  protected getVisibleShowcases(): BrandShowcase[] {
    const showcases = this.brandShowcases();
    return this.showAll() ? showcases : showcases.slice(0, 2);
  }

  protected toggleShowAllElements(): void {
    this.showAllElements.set(!this.showAllElements());
  }

  protected getVisibleElements(): BrandElement[] {
    const elements = this.brandElements();
    return this.showAllElements() ? elements : elements.slice(0, 2);
  }

  protected getColorContrast(color: string): string {
    // Simple color contrast calculation
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  private setupSeoForBrandCharter(): void {
    // Add structured data for brand charter
    const brandCharterStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'AI Brand Identity Creation',
      description:
        'Comprehensive brand charter creation including color palettes, typography, logos, and visual style guidelines',
      provider: {
        '@type': 'Organization',
        name: 'Idem',
      },
      serviceType: 'Brand Design Service',
      areaServed: 'Worldwide',
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Brand Elements',
        itemListElement: this.brandElements().map((element, index) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: element.title,
            description: element.description,
            category: 'Brand Design',
          },
        })),
      },
      workExample: this.brandShowcases().map((showcase) => ({
        '@type': 'CreativeWork',
        name: `${showcase.brandName} Brand Identity`,
        description: showcase.description,
        about: {
          '@type': 'Thing',
          name: showcase.industry,
          description: `Brand identity for ${showcase.industry} industry`,
        },
      })),
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-brand-charter-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-brand-charter-structured-data', 'true');
      script.textContent = JSON.stringify(brandCharterStructuredData);
      document.head.appendChild(script);
    }
  }
}
