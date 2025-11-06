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
      title: $localize`:@@brand-charter.elements.colors.title:Color Palette`,
      description: $localize`:@@brand-charter.elements.colors.description:Colors that reflect your brand personality`,
      icon: 'pi-palette',
      examples: [
        $localize`:@@brand-charter.elements.colors.example1:Primary Colors`,
        $localize`:@@brand-charter.elements.colors.example2:Secondary Colors`,
        $localize`:@@brand-charter.elements.colors.example3:Accent Colors`,
      ],
    },
    {
      id: 'typography',
      title: $localize`:@@brand-charter.elements.typography.title:Typography`,
      description: $localize`:@@brand-charter.elements.typography.description:Font families for consistent communication`,
      icon: 'pi-font',
      examples: [
        $localize`:@@brand-charter.elements.typography.example1:Headings Font`,
        $localize`:@@brand-charter.elements.typography.example2:Body Text Font`,
        $localize`:@@brand-charter.elements.typography.example3:Display Font`,
      ],
    },
    {
      id: 'logo',
      title: $localize`:@@brand-charter.elements.logo.title:Logo Variations`,
      description: $localize`:@@brand-charter.elements.logo.description:Logo formats for different use cases`,
      icon: 'pi-star',
      examples: [
        $localize`:@@brand-charter.elements.logo.example1:Primary Logo`,
        $localize`:@@brand-charter.elements.logo.example2:Secondary Mark`,
        $localize`:@@brand-charter.elements.logo.example3:Icon Version`,
      ],
    },
    {
      id: 'imagery',
      title: $localize`:@@brand-charter.elements.imagery.title:Visual Style`,
      description: $localize`:@@brand-charter.elements.imagery.description:Visual elements that support your brand`,
      icon: 'pi-image',
      examples: [
        $localize`:@@brand-charter.elements.imagery.example1:Photography Style`,
        $localize`:@@brand-charter.elements.imagery.example2:Illustration Style`,
        $localize`:@@brand-charter.elements.imagery.example3:Icon Style`,
      ],
    },
  ]);

  protected readonly brandShowcases = signal<BrandShowcase[]>([
    {
      id: '1',
      brandName: 'TechFlow Solutions',
      industry: $localize`:@@brand-charter.showcases.techflow.industry:Technology`,
      primaryColor: '#1447e6',
      secondaryColor: '#22d3ee',
      fontFamily: 'Inter',
      logoStyle: $localize`:@@brand-charter.showcases.techflow.logoStyle:Modern Geometric`,
      description: $localize`:@@brand-charter.showcases.techflow.description:Professional B2B SaaS brand identity`,
    },
    {
      id: '2',
      brandName: 'EcoGreen Marketplace',
      industry: $localize`:@@brand-charter.showcases.ecogreen.industry:Environmental`,
      primaryColor: '#22c55e',
      secondaryColor: '#16a34a',
      fontFamily: 'Poppins',
      logoStyle: $localize`:@@brand-charter.showcases.ecogreen.logoStyle:Organic Natural`,
      description: $localize`:@@brand-charter.showcases.ecogreen.description:Eco-friendly brand for green products`,
    },
    {
      id: '3',
      brandName: 'CreativeStudio',
      industry: $localize`:@@brand-charter.showcases.creative.industry:Design Agency`,
      primaryColor: '#d11ec0',
      secondaryColor: '#9333ea',
      fontFamily: 'Montserrat',
      logoStyle: $localize`:@@brand-charter.showcases.creative.logoStyle:Artistic Bold`,
      description: $localize`:@@brand-charter.showcases.creative.description:Creative brand for design agency`,
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
      name: $localize`:@@brand-charter.seo.serviceName:AI Brand Identity Creation`,
      description: $localize`:@@brand-charter.seo.serviceDescription:Comprehensive brand charter creation including color palettes, typography, logos, and visual style guidelines`,
      provider: {
        '@type': 'Organization',
        name: 'Idem',
      },
      serviceType: $localize`:@@brand-charter.seo.serviceType:Brand Design Service`,
      areaServed: $localize`:@@brand-charter.seo.areaServed:Worldwide`,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: $localize`:@@brand-charter.seo.offerCatalogName:Brand Elements`,
        itemListElement: this.brandElements().map((element) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: element.title,
            description: element.description,
            category: $localize`:@@brand-charter.seo.category:Brand Design`,
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
          description: $localize`:@@brand-charter.seo.workExample.description:Brand identity for ${showcase.industry}:raw:industry`,
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
