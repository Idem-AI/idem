import {
  Component,
  ElementRef,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ecosystem-showcase',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ecosystem-showcase.html',
  styleUrl: './ecosystem-showcase.css',
})
export class EcosystemShowcaseComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly elementRef = inject(ElementRef);
  private readonly seoService = inject(SeoService);

  protected readonly idevUrl = environment.services.idev.url;
  protected readonly ideployUrl = environment.services.ideploy.url;

  private observer: IntersectionObserver | null = null;
  protected isVisible = signal(false);

  readonly apps = [
    {
      id: 'idev',
      name: 'IDEV',
      tagline: $localize`:@@ecosystem.idev.tagline:AI-Powered App Generator`,
      description: $localize`:@@ecosystem.idev.description:Transform your idea into a fully functional application. Describe what you want, and IDEV generates the code, the interface, and the logic — powered by AI.`,
      route: '/idev',
      ctaLabel: $localize`:@@ecosystem.idev.cta:Discover IDEV`,
      accentColor: 'var(--color-primary)',
      features: [
        $localize`:@@ecosystem.idev.feature1:Full-stack code generation`,
        $localize`:@@ecosystem.idev.feature2:Real-time AI preview`,
        $localize`:@@ecosystem.idev.feature3:React, Next.js & more`,
      ],
    },
    {
      id: 'ideploy',
      name: 'iDeploy',
      tagline: $localize`:@@ecosystem.ideploy.tagline:Simplified Deployment`,
      description: $localize`:@@ecosystem.ideploy.description:Put your application into production simply. One-click deployment to any cloud, VPS, or custom infrastructure — zero DevOps required.`,
      route: '/ideploy',
      ctaLabel: $localize`:@@ecosystem.ideploy.cta:Deploy with iDeploy`,
      accentColor: 'var(--color-secondary)',
      features: [
        $localize`:@@ecosystem.ideploy.feature1:One-click deployment`,
        $localize`:@@ecosystem.ideploy.feature2:Custom domains & SSL`,
        $localize`:@@ecosystem.ideploy.feature3:VPS & Cloud support`,
      ],
    },
  ];

  ngOnInit(): void {
    this.addStructuredData();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser()) {
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.isVisible.set(true);
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    const section = this.elementRef.nativeElement.querySelector('.ecosystem-section');
    if (section) {
      this.observer.observe(section);
    }
  }

  private addStructuredData(): void {
    if (!this.isBrowser()) return;
    if (document.querySelector('script[data-ecosystem-structured-data]')) return;

    const structuredData = [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'IDEV',
        description: 'AI-powered application generator. Transform your idea into a fully functional web application with AI-driven code generation.',
        url: `${this.seoService.domain}/idev`,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        author: {
          '@type': 'Organization',
          name: 'Idem',
          url: this.seoService.domain,
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'iDeploy',
        description: 'Simplified application deployment platform. One-click deployment to any cloud, VPS, or custom infrastructure.',
        url: `${this.seoService.domain}/ideploy`,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        author: {
          '@type': 'Organization',
          name: 'Idem',
          url: this.seoService.domain,
        },
      },
    ];

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-ecosystem-structured-data', 'true');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }
}
