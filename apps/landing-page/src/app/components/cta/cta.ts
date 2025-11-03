import {
  Component,
  HostBinding,
  ElementRef,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';

@Component({
  selector: 'app-cta',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cta.html',
  styleUrl: './cta.css',
})
export class Cta implements OnInit, AfterViewInit, OnDestroy {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly elementRef = inject(ElementRef);
  private readonly seoService = inject(SeoService);

  // Apply animation class binding
  @HostBinding('class.animate-in')
  protected readonly animateIn = signal(false);

  // State properties
  protected observer: IntersectionObserver | null = null;

  ngOnInit(): void {
    this.setupSeoForCtaSection();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser()) {
      this.setupIntersectionObserver();
      this.initHoverEffects();
    }
  }

  ngOnDestroy(): void {
    this.destroyIntersectionObserver();
  }

  private initHoverEffects(): void {
    // Add any additional hover effect initializations if needed
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Trigger animation when component becomes visible
            this.animateIn.set(true);
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    // Observe the CTA section
    const ctaSection = this.elementRef.nativeElement.querySelector('.cta-section');
    if (ctaSection) {
      this.observer.observe(ctaSection);
    } else {
      // If no specific section, observe the component itself
      this.observer.observe(this.elementRef.nativeElement);
    }
  }

  private setupSeoForCtaSection(): void {
    // Add structured data for CTA section
    const ctaStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebPageElement',
      name: 'Call to Action',
      description: 'Get started with Idem platform for AI-powered brand creation and deployment',
      potentialAction: {
        '@type': 'Action',
        name: 'Sign Up',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${this.seoService.domain}/auth/login`,
          actionPlatform: [
            'http://schema.org/DesktopWebPlatform',
            'http://schema.org/MobileWebPlatform',
          ],
        },
      },
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-cta-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-cta-structured-data', 'true');
      script.textContent = JSON.stringify(ctaStructuredData);
      document.head.appendChild(script);
    }
  }

  private destroyIntersectionObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
