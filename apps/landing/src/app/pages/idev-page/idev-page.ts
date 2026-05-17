import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-idev-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './idev-page.html',
  styleUrl: './idev-page.css',
})
export class IdevPage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  protected readonly idevUrl = environment.services.idev.url;
  protected readonly ideployUrl = environment.services.ideploy.url;
  protected readonly dashboardUrl = environment.services.dashboard.url;

  readonly steps = [
    {
      number: '01',
      title: $localize`:@@idev.step1.title:Describe Your Idea`,
      description: $localize`:@@idev.step1.description:Tell IDEV what you want to build. Describe your app in plain language — no technical expertise required.`,
    },
    {
      number: '02',
      title: $localize`:@@idev.step2.title:AI Generates Code`,
      description: $localize`:@@idev.step2.description:Our AI agents analyze your idea and generate a complete, production-ready application with frontend, backend, and database.`,
    },
    {
      number: '03',
      title: $localize`:@@idev.step3.title:Iterate & Deploy`,
      description: $localize`:@@idev.step3.description:Preview your app in real-time, make adjustments through conversation, and deploy instantly with iDeploy.`,
    },
  ];

  readonly features = [
    {
      title: $localize`:@@idev.feature1.title:Full-Stack Generation`,
      description: $localize`:@@idev.feature1.description:Complete React/Next.js applications with API routes, database models, and authentication.`,
      icon: 'code',
    },
    {
      title: $localize`:@@idev.feature2.title:Real-Time Preview`,
      description: $localize`:@@idev.feature2.description:See your application come to life as the AI builds it, with instant hot-reload preview.`,
      icon: 'eye',
    },
    {
      title: $localize`:@@idev.feature3.title:AI-Driven Iteration`,
      description: $localize`:@@idev.feature3.description:Refine your app through natural language. Simply describe changes and the AI applies them.`,
      icon: 'sparkle',
    },
    {
      title: $localize`:@@idev.feature4.title:Modern Tech Stack`,
      description: $localize`:@@idev.feature4.description:Built with industry-standard technologies: React, Next.js, TypeScript, Tailwind CSS, and more.`,
      icon: 'stack',
    },
    {
      title: $localize`:@@idev.feature5.title:Export & Own`,
      description: $localize`:@@idev.feature5.description:Export your complete source code. You own everything — no vendor lock-in, no restrictions.`,
      icon: 'download',
    },
    {
      title: $localize`:@@idev.feature6.title:iDeploy Integration`,
      description: $localize`:@@idev.feature6.description:Seamlessly deploy your generated application with one click through the iDeploy platform.`,
      icon: 'cloud',
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
    this.addStructuredData();
  }

  private setupSeo(): void {
    this.seoService.setupPageSeo({
      title: $localize`:@@idev.seo.title:IDEV — AI App Generator & Code Builder by Idem`,
      description: $localize`:@@idev.seo.description:Transformer votre idée en application SaaS ou mobile avec IDEV. Le générateur d'applications intelligent de l'écosystème Idem. Code React/Next.js propre, souveraineté numérique et déploiement instantané.`,
      path: '/idev',
      keywords: 'generateur de code IA, AI app generator, build SaaS with AI, code generation, React builder, Next.js generator, software development automation, Idem, IDEV, African tech innovation, AI startup tools',
      ogImage: `${this.seoService.domain}/assets/seo/og-image.webp`,
    });
  }

  private addStructuredData(): void {
    if (!this.isBrowser()) return;
    if (document.querySelector('script[data-idev-structured-data]')) return;

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'IDEV',
      alternateName: 'IDEV by Idem',
      description: 'AI-powered application generator. Transform your idea into a fully functional web application with full-stack code generation, real-time preview, and AI-driven iteration.',
      url: `${this.seoService.domain}/idev`,
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
        'Full-stack code generation',
        'Real-time AI preview',
        'React & Next.js support',
        'AI-driven iteration',
        'Source code export',
        'iDeploy integration',
      ],
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-idev-structured-data', 'true');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }
}
