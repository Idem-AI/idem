import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

// Import services
import { SeoService } from '../../shared/services/seo.service';

// Import components
import { Hero } from '../../components/hero/hero';
import { OpenSourceSovereigntyComponent } from '../../components/open-source-sovereignty/open-source-sovereignty';
import { MultiAgentArchitectureComponent } from '../../components/multi-agent-architecture/multi-agent-architecture';
import { Features } from '../../components/features/features';

import { DeploymentScreenshots } from '../../components/deployment-screenshots/deployment-screenshots';
import { AfricanMarketComponent } from '../../components/african-market/african-market';
import { Cta } from '../../components/cta/cta';
import { VideoTrailer } from "../../components/video-trailer/video-trailer";
import { EcosystemShowcaseComponent } from '../../components/ecosystem-showcase/ecosystem-showcase';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    Hero,
    OpenSourceSovereigntyComponent,
    MultiAgentArchitectureComponent,
    Features,
    DeploymentScreenshots,
    AfricanMarketComponent,
    EcosystemShowcaseComponent,
    Cta,
    VideoTrailer
],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties

  // Lifecycle methods
  ngOnInit(): void {
    this.setupSeo();
  }

  // SEO setup
  private setupSeo(): void {
    const title = $localize`:@@home.seo.title:Idem: The Open Source African AI that creates companies | AI-powered business creation tool`;
    const description = $localize`:@@home.seo.description:Transform your ideas into complete businesses with Idem's Open Source AI platform. Create professional brands, generate business plans, build websites, and deploy applications on servers in Africa.`;

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content: $localize`:@@home.seo.keywords:AI business creation, African startup, business creation tool, African AI business, AI entrepreneurship assistant, African sovereign platform, specialized AI agents, AI business plan, AI logo creation, AI application development, Cameroon tech, pan-African innovation, digital sovereignty, tech entrepreneurship Africa, African startup tools, African servers, African hosting, open source`,
      },
      { name: 'author', content: $localize`:@@home.seo.author:Idem Team` },
      { name: 'robots', content: 'index, follow' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#6366f1' },
      { name: 'application-name', content: $localize`:@@home.seo.applicationName:Idem` },
      {
        name: 'apple-mobile-web-app-title',
        content: $localize`:@@home.seo.appleMobileWebAppTitle:Idem`,
      },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'msapplication-TileColor', content: '#6366f1' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@IdemAfrica' },
      { name: 'twitter:creator', content: '@IdemAfrica' },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      {
        property: 'og:description',
        content: $localize`:@@home.seo.ogDescription:Revolutionary Open Source AI platform that builds your complete business: strategy, brand, product, finances, website, and deployment on servers in Africa. Designed for Africa.`,
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: this.seoService.domain },
      { property: 'og:site_name', content: 'Idem' },
      { property: 'og:locale', content: 'en_US' },
      {
        property: 'og:image',
        content: `${this.seoService.domain}/assets/seo/og-image.webp`,
      },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:type', content: 'image/jpeg' },
      {
        property: 'og:image:alt',
        content: $localize`:@@home.seo.ogImageAlt:Idem - The Open Source African AI that creates companies and deploys on servers in Africa`,
      },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/');

    // Add structured data for the main website
    this.addStructuredData();
  }

  private addStructuredData(): void {
    if (!this.isBrowser()) return;

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Idem',
      description: $localize`:@@home.structured.description:Open Source AI-powered platform for complete business creation and instant deployment on servers in Africa.`,
      url: this.seoService.domain,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        description: $localize`:@@home.structured.offerDescription:Free tier available with premium features`,
      },
      creator: {
        '@type': 'Organization',
        name: 'Idem',
        url: this.seoService.domain,
        logo: `${this.seoService.domain}/assets/images/logo.png`,
        sameAs: ['https://twitter.com/IdemAfrica', 'https://linkedin.com/company/idem-africa'],
      },
      featureList: [
        $localize`:@@home.structured.feature1:AI Brand Creation`,
        $localize`:@@home.structured.feature2:Logo Design Generation`,
        $localize`:@@home.structured.feature3:Business Plan Creation`,
        $localize`:@@home.structured.feature4:UML Diagram Generation`,
        $localize`:@@home.structured.feature5:Website Building`,
        $localize`:@@home.structured.feature6:Instant App Deployment`,
        $localize`:@@home.structured.feature7:Technical Architecture Design`,
        $localize`:@@home.structured.feature8:Brand Identity Development`,
      ],
      screenshot: `${this.seoService.domain}/assets/images/app-screenshot.webp`,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '150',
        bestRating: '5',
        worstRating: '1',
      },
    };

    // Check if structured data already exists
    const existingScript = document.querySelector('script[data-home-structured-data]');
    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-home-structured-data', 'true');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }
}
