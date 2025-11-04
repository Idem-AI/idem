import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';
import { environment } from '../../../environments/environment';

interface LogoExample {
  id: string;
  brandName: string;
  industry: string;
  style: string;
  colors: string[];
  description: string;
  logoUrl: string;
}

@Component({
  selector: 'app-logos-showcase',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logos-showcase.html',
  styleUrl: './logos-showcase.css',
})
export class LogosShowcase implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);
  protected readonly dashboardUrl = environment.services.dashboard.url;
  // State properties
  protected readonly logos = signal<LogoExample[]>([
    {
      id: '1',
      brandName: 'TechFlow',
      industry: $localize`:@@logos-showcase.logos.techflow.industry:Technology`,
      style: $localize`:@@logos-showcase.logos.techflow.style:Modern Minimalist`,
      colors: ['#1447e6', '#22d3ee'],
      description: $localize`:@@logos-showcase.logos.techflow.description:Clean geometric design representing innovation and flow`,
      logoUrl: '/assets/logos/techflow-logo.svg',
    },
    {
      id: '2',
      brandName: 'EcoGreen',
      industry: $localize`:@@logos-showcase.logos.ecogreen.industry:Environmental`,
      style: $localize`:@@logos-showcase.logos.ecogreen.style:Organic Natural`,
      colors: ['#22c55e', '#16a34a'],
      description: $localize`:@@logos-showcase.logos.ecogreen.description:Leaf-inspired design symbolizing sustainability`,
      logoUrl: '/assets/logos/ecogreen-logo.svg',
    },
    {
      id: '3',
      brandName: 'HealthCare+',
      industry: $localize`:@@logos-showcase.logos.healthcare.industry:Healthcare`,
      style: $localize`:@@logos-showcase.logos.healthcare.style:Professional Trust`,
      colors: ['#3b82f6', '#1e40af'],
      description: $localize`:@@logos-showcase.logos.healthcare.description:Medical cross with modern typography for reliability`,
      logoUrl: '/assets/logos/healthcare-logo.svg',
    },
    {
      id: '4',
      brandName: 'CreativeStudio',
      industry: $localize`:@@logos-showcase.logos.creative.industry:Design`,
      style: $localize`:@@logos-showcase.logos.creative.style:Artistic Bold`,
      colors: ['#d11ec0', '#9333ea'],
      description: $localize`:@@logos-showcase.logos.creative.description:Abstract brush stroke representing creativity`,
      logoUrl: '/assets/logos/creative-logo.svg',
    },
  ]);

  ngOnInit(): void {
    this.setupSeoForLogosShowcase();
  }

  protected getColorGradient(colors: string[]): string {
    if (colors.length === 1) {
      return colors[0];
    }
    return `linear-gradient(135deg, ${colors.join(', ')})`;
  }

  protected getVisibleLogos(): LogoExample[] {
    // Return only first 4 logos for simplified showcase
    return this.logos().slice(0, 4);
  }

  private setupSeoForLogosShowcase(): void {
    // Add structured data for logo showcase
    const logosStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: $localize`:@@logos-showcase.seo.name:AI Logo Generation Examples`,
      description: $localize`:@@logos-showcase.seo.description:Showcase of AI-generated logos across different industries and styles`,
      creator: {
        '@type': 'Organization',
        name: 'Idem',
      },
      hasPart: this.logos().map((logo) => ({
        '@type': 'ImageObject',
        name: `${logo.brandName} Logo`,
        description: logo.description,
        url: `${this.seoService.domain}${logo.logoUrl}`,
        about: {
          '@type': 'Thing',
          name: logo.industry,
          description: $localize`:@@logos-showcase.seo.logoDescription:${logo.style}:raw: style logo for ${logo.industry}:raw: industry`,
        },
      })),
    };

    // Add structured data to page if not already present
    if (
      this.isBrowser() &&
      !document.querySelector('script[data-logos-showcase-structured-data]')
    ) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-logos-showcase-structured-data', 'true');
      script.textContent = JSON.stringify(logosStructuredData);
      document.head.appendChild(script);
    }
  }
}
