import { Component, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../../../shared/services/seo.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected mouseX = signal(0);
  protected mouseY = signal(0);
  protected scrollY = signal(0);
  protected isInViewport = signal(true);
  protected spotlightX = signal(0);
  protected spotlightY = signal(0);

  ngOnInit(): void {
    this.setupSeoForHeroSection();
  }

  private setupSeoForHeroSection(): void {
    // Add structured data for the hero section
    const heroStructuredData = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Idem",
      "applicationCategory": "BusinessApplication",
      "description": "AI-powered platform for instant brand creation and application deployment",
      "operatingSystem": "Web Browser",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Organization",
        "name": "Idem Team"
      }
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-hero-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-hero-structured-data', 'true');
      script.textContent = JSON.stringify(heroStructuredData);
      document.head.appendChild(script);
    }
  }
}
