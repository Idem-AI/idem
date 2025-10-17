import { Component, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../../../shared/services/seo.service';
import { RouterLink } from '@angular/router';

interface CtaFeature {
  id: string;
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-cta-section',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cta-section.html',
  styleUrl: './cta-section.css',
})
export class CtaSection implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly features = signal<CtaFeature[]>([
    {
      id: 'launch-minutes',
      icon: 'pi-bolt',
      title: 'Launch in Minutes',
      description: 'From idea to deployed application in under 10 minutes',
    },
    {
      id: 'enterprise-ready',
      icon: 'pi-shield',
      title: 'Enterprise Ready',
      description: 'Production-grade security and scalability built-in',
    },
    {
      id: 'free-forever',
      icon: 'pi-heart',
      title: 'Free Forever',
      description: 'Core features always free, no hidden costs or limits',
    },
  ]);

  protected readonly isHovered = signal<boolean>(false);

  ngOnInit(): void {
    this.setupSeoForCtaSectionComponent();
  }

  protected onGetStarted(): void {
    // Navigate to registration or main app
    window.location.href = '/register';
  }

  protected onWatchDemo(): void {
    // Scroll to video section or open demo modal
    const videoSection = document.querySelector('app-video-trailer');
    if (videoSection) {
      videoSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  protected onMouseEnter(): void {
    this.isHovered.set(true);
  }

  protected onMouseLeave(): void {
    this.isHovered.set(false);
  }

  private setupSeoForCtaSectionComponent(): void {
    // Add structured data for CTA section features
    const ctaSectionStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebPageElement',
      name: 'Platform Benefits',
      description: 'Key benefits of using Idem platform for rapid application development',
      mainEntity: {
        '@type': 'ItemList',
        name: 'Platform Features',
        itemListElement: this.features().map((feature, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Thing',
            name: feature.title,
            description: feature.description,
          },
        })),
      },
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-cta-section-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-cta-section-structured-data', 'true');
      script.textContent = JSON.stringify(ctaSectionStructuredData);
      document.head.appendChild(script);
    }
  }
}
