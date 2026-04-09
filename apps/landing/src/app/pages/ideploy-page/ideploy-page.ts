import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ideploy-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ideploy-page.html',
  styleUrl: './ideploy-page.css',
})
export class IdeployPage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  protected readonly idevUrl = environment.services.idev.url;
  protected readonly ideployUrl = environment.services.ideploy.url;
  protected readonly dashboardUrl = environment.services.dashboard.url;

  readonly deployMethods = [
    {
      id: 'quick',
      title: $localize`:@@ideploy.method1.title:Quick Deploy`,
      description: $localize`:@@ideploy.method1.description:Zero configuration. Get a live URL in under 90 seconds with automatic SSL and CDN.`,
      badge: $localize`:@@ideploy.method1.badge:Fastest`,
      stats: [
        { label: $localize`:@@ideploy.method1.stat1:Config Time`, value: '0s' },
        { label: $localize`:@@ideploy.method1.stat2:Deploy Time`, value: '< 2min' },
      ],
    },
    {
      id: 'vps',
      title: $localize`:@@ideploy.method2.title:VPS Deployment`,
      description: $localize`:@@ideploy.method2.description:Deploy on IDEM servers or your own VPS with Docker Swarm high availability and full monitoring.`,
      badge: $localize`:@@ideploy.method2.badge:Full Control`,
      stats: [
        { label: $localize`:@@ideploy.method2.stat1:Uptime`, value: '99.9%' },
        { label: $localize`:@@ideploy.method2.stat2:HA`, value: 'Docker Swarm' },
      ],
    },
    {
      id: 'cloud',
      title: $localize`:@@ideploy.method3.title:Cloud Deploy`,
      description: $localize`:@@ideploy.method3.description:AI-powered deployment on AWS, GCP, or Azure with automatic resource provisioning and cost optimization.`,
      badge: $localize`:@@ideploy.method3.badge:AI-Optimized`,
      stats: [
        { label: $localize`:@@ideploy.method3.stat1:Cost Savings`, value: '~35%' },
        { label: $localize`:@@ideploy.method3.stat2:Providers`, value: '3+' },
      ],
    },
  ];

  readonly features = [
    {
      title: $localize`:@@ideploy.feature1.title:One-Click Deploy`,
      description: $localize`:@@ideploy.feature1.description:Push your application live with a single click. No configuration, no DevOps expertise required.`,
    },
    {
      title: $localize`:@@ideploy.feature2.title:Custom Domains & SSL`,
      description: $localize`:@@ideploy.feature2.description:Connect your own domain with automatic SSL certificate provisioning and renewal.`,
    },
    {
      title: $localize`:@@ideploy.feature3.title:Full Monitoring`,
      description: $localize`:@@ideploy.feature3.description:Real-time logs, resource usage, uptime monitoring, and instant alerts when something goes wrong.`,
    },
    {
      title: $localize`:@@ideploy.feature4.title:Auto Scaling`,
      description: $localize`:@@ideploy.feature4.description:Automatic resource scaling based on traffic. Your app handles peak load without manual intervention.`,
    },
    {
      title: $localize`:@@ideploy.feature5.title:Multiple Environments`,
      description: $localize`:@@ideploy.feature5.description:Staging, preview, and production environments with easy promotion between stages.`,
    },
    {
      title: $localize`:@@ideploy.feature6.title:IDEV Integration`,
      description: $localize`:@@ideploy.feature6.description:Seamlessly deploy applications built with IDEV. The perfect end-to-end workflow.`,
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
    this.addStructuredData();
  }

  private setupSeo(): void {
    this.seoService.setupPageSeo({
      title: $localize`:@@ideploy.seo.title:iDeploy — Sovereign Cloud & One-Click App Deployment by Idem`,
      description: $localize`:@@ideploy.seo.description:Le service de déploiement souverain d'Idem. Déployez vos apps sur VPS ou Cloud en un clic. Alternative africaine aux solutions occidentales avec auto-scaling et monitoring intégré. Zéro DevOps requis.`,
      path: '/ideploy',
      keywords: 'cloud souverain Afrique, sovereign hosting, deploy app on VPS, docker swarm automation, one-click deployment, self-hosted cloud, Idem, iDeploy, alternative Heroku, DevOps as a service',
      ogImage: `${this.seoService.domain}/assets/seo/og-image.webp`,
    });
  }

  private addStructuredData(): void {
    if (!this.isBrowser()) return;
    if (document.querySelector('script[data-ideploy-structured-data]')) return;

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'iDeploy',
      alternateName: 'iDeploy by Idem',
      description: 'Simplified application deployment platform. One-click deployment to any cloud, VPS, or custom infrastructure with automatic SSL, monitoring, and cost optimization.',
      url: `${this.seoService.domain}/ideploy`,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web Browser',
      softwareVersion: '1.0',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      author: {
        '@type': 'Organization',
        name: 'Idem',
        url: this.seoService.domain,
      },
      featureList: [
        'One-click deployment',
        'Custom domains & SSL',
        'VPS & Cloud support',
        'Docker Swarm HA',
        'Full monitoring & logs',
        'AI cost optimization',
      ],
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-ideploy-structured-data', 'true');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }
}
