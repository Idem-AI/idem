import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../../../shared/services/seo.service';
import { RouterLink } from '@angular/router';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './logos-showcase.html',
  styleUrl: './logos-showcase.css',
})
export class LogosShowcase implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly logos = signal<LogoExample[]>([
    {
      id: '1',
      brandName: 'TechFlow',
      industry: 'Technology',
      style: 'Modern Minimalist',
      colors: ['#1447e6', '#22d3ee'],
      description: 'Clean geometric design representing innovation and flow',
      logoUrl: '/assets/logos/techflow-logo.svg',
    },
    {
      id: '2',
      brandName: 'EcoGreen',
      industry: 'Environmental',
      style: 'Organic Natural',
      colors: ['#22c55e', '#16a34a'],
      description: 'Leaf-inspired design symbolizing sustainability',
      logoUrl: '/assets/logos/ecogreen-logo.svg',
    },
    {
      id: '3',
      brandName: 'HealthCare+',
      industry: 'Healthcare',
      style: 'Professional Trust',
      colors: ['#3b82f6', '#1e40af'],
      description: 'Medical cross with modern typography for reliability',
      logoUrl: '/assets/logos/healthcare-logo.svg',
    },
    {
      id: '4',
      brandName: 'CreativeStudio',
      industry: 'Design',
      style: 'Artistic Bold',
      colors: ['#d11ec0', '#9333ea'],
      description: 'Abstract brush stroke representing creativity',
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
      name: 'AI Logo Generation Examples',
      description: 'Showcase of AI-generated logos across different industries and styles',
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
          description: `${logo.style} style logo for ${logo.industry} industry`,
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
