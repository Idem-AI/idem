import {
  Component,
  HostBinding,
  HostListener,
  ElementRef,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  OnInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css',
})
export class Pricing implements OnInit, AfterViewInit, OnDestroy {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly elementRef = inject(ElementRef);
  private readonly seoService = inject(SeoService);

  // Apply host class for animation timing
  @HostBinding('class.animate-in')
  protected readonly animateIn = signal(false);

  // State properties
  protected mouseX = signal(0);
  protected mouseY = signal(0);
  protected observer: IntersectionObserver | null = null;

  ngOnInit(): void {
    this.setupSeoForPricingSection();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser()) {
      this.initAnimations();
      this.setupSpotlightEffect();
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy(): void {
    this.destroyIntersectionObserver();
  }

  @HostListener('mousemove', ['$event'])
  protected handleMouseMove(event: MouseEvent): void {
    if (this.isBrowser()) {
      this.mouseX.set(event.clientX);
      this.mouseY.set(event.clientY);
      this.updateSpotlightEffect(event);
    }
  }

  private initAnimations(): void {
    // Delay animation entrance effect
    setTimeout(() => {
      this.animateIn.set(true);
    }, 300);
  }

  private setupSpotlightEffect(): void {
    // Add spotlight elements to each pricing card
    const pricingCards = this.elementRef.nativeElement.querySelectorAll('.pricing-card');

    pricingCards.forEach((card: Element) => {
      if (!card.querySelector('.pricing-spotlight')) {
        const spotlight = document.createElement('div');
        spotlight.classList.add('pricing-spotlight');
        card.insertBefore(spotlight, card.firstChild);
      }
    });
  }

  private updateSpotlightEffect(event: MouseEvent): void {
    // Update spotlight position based on mouse movement
    const spotlights = document.querySelectorAll('.pricing-spotlight');

    spotlights.forEach((spotlightEl) => {
      const el = spotlightEl as HTMLElement;
      const parent = el.parentElement;

      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Only update if mouse is over the card
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        el.style.setProperty('--x', `${x}`);
        el.style.setProperty('--y', `${y}`);
      }
    });
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Add animation class when section becomes visible
            this.animateIn.set(true);
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 },
    );

    const pricingSection = this.elementRef.nativeElement.querySelector('.pricing-section');
    if (pricingSection) {
      this.observer.observe(pricingSection);
    }
  }

  private setupSeoForPricingSection(): void {
    // Add structured data for pricing section
    const pricingStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Idem Platform',
      description: 'AI-powered platform for instant brand creation and application deployment',
      brand: {
        '@type': 'Brand',
        name: 'Idem',
      },
      offers: [
        {
          '@type': 'Offer',
          name: 'Free Plan',
          description: 'Get started with basic features',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          validFrom: new Date().toISOString(),
          priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          '@type': 'Offer',
          name: 'Pro Plan',
          description: 'Advanced features for professionals',
          price: '29',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          validFrom: new Date().toISOString(),
          priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-pricing-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-pricing-structured-data', 'true');
      script.textContent = JSON.stringify(pricingStructuredData);
      document.head.appendChild(script);
    }
  }

  private destroyIntersectionObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
