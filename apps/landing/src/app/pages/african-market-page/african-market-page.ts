import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';
import { Team } from '../../components/team/team';

interface MarketRegion {
  region: string;
  flag: string;
  status: string;
  description: string;
  color: string;
  countries: string[];
  opportunities: string[];
  challenges: string[];
  timeline: string;
}

interface AfricanStat {
  value: string;
  label: string;
  description: string;
  trend: string;
}

@Component({
  selector: 'app-african-market-page',
  standalone: true,
  imports: [CommonModule, RouterLink, Team],
  templateUrl: './african-market-page.html',
  styleUrl: './african-market-page.css',
})
export class AfricanMarketPage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  protected readonly regions: MarketRegion[] = [
    {
      region: $localize`:@@african-market-page.regions.central.region:Central Africa (Cameroon)`,
      flag: '🇨🇲',
      status: $localize`:@@african-market-page.regions.central.status:Live Now - Our Home Base`,
      description: $localize`:@@african-market-page.regions.central.description:Cameroon is our founding market and the birthplace of IDEM. We understand the local ecosystem, regulatory environment, and entrepreneurial challenges firsthand.`,
      color: '#10b981',
      countries: [
        $localize`:@@african-market-page.regions.central.country1:Cameroon`,
        $localize`:@@african-market-page.regions.central.country2:Gabon`,
        $localize`:@@african-market-page.regions.central.country3:Congo`,
        $localize`:@@african-market-page.regions.central.country4:Central African Republic`,
      ],
      opportunities: [
        $localize`:@@african-market-page.regions.central.opportunity1:Growing tech ecosystem in Douala and Yaoundé`,
        $localize`:@@african-market-page.regions.central.opportunity2:Bilingual market (French/English)`,
        $localize`:@@african-market-page.regions.central.opportunity3:Strategic gateway to Central Africa`,
        $localize`:@@african-market-page.regions.central.opportunity4:Increasing digital adoption`,
        $localize`:@@african-market-page.regions.central.opportunity5:Government support for tech innovation`,
      ],
      challenges: [
        $localize`:@@african-market-page.regions.central.challenge1:Infrastructure limitations`,
        $localize`:@@african-market-page.regions.central.challenge2:Access to funding`,
        $localize`:@@african-market-page.regions.central.challenge3:Digital payment adoption`,
        $localize`:@@african-market-page.regions.central.challenge4:Internet connectivity in rural areas`,
      ],
      timeline: $localize`:@@african-market-page.regions.central.timeline:Active since 2024`,
    },
    {
      region: $localize`:@@african-market-page.regions.west.region:West Africa`,
      flag: '🌍',
      status: $localize`:@@african-market-page.regions.west.status:Expanding - Q2 2025`,
      description: $localize`:@@african-market-page.regions.west.description:West Africa represents Africa's largest tech market with Nigeria leading the continent in startup funding and Ghana emerging as a fintech hub.`,
      color: '#3b82f6',
      countries: [
        $localize`:@@african-market-page.regions.west.country1:Nigeria`,
        $localize`:@@african-market-page.regions.west.country2:Ghana`,
        $localize`:@@african-market-page.regions.west.country3:Senegal`,
        $localize`:@@african-market-page.regions.west.country4:Côte d'Ivoire`,
        $localize`:@@african-market-page.regions.west.country5:Benin`,
        $localize`:@@african-market-page.regions.west.country6:Togo`,
        $localize`:@@african-market-page.regions.west.country7:Mali`,
      ],
      opportunities: [
        $localize`:@@african-market-page.regions.west.opportunity1:Largest tech ecosystem in Africa (Nigeria)`,
        $localize`:@@african-market-page.regions.west.opportunity2:Strong fintech and e-commerce sectors`,
        $localize`:@@african-market-page.regions.west.opportunity3:High mobile penetration rates`,
        $localize`:@@african-market-page.regions.west.opportunity4:Vibrant startup communities`,
        $localize`:@@african-market-page.regions.west.opportunity5:Growing venture capital interest`,
        $localize`:@@african-market-page.regions.west.opportunity6:ECOWAS regional integration`,
      ],
      challenges: [
        $localize`:@@african-market-page.regions.west.challenge1:Currency volatility`,
        $localize`:@@african-market-page.regions.west.challenge2:Regulatory complexity across countries`,
        $localize`:@@african-market-page.regions.west.challenge3:Infrastructure gaps`,
        $localize`:@@african-market-page.regions.west.challenge4:Payment fragmentation`,
      ],
      timeline: $localize`:@@african-market-page.regions.west.timeline:Launch planned Q2 2025`,
    },
    {
      region: $localize`:@@african-market-page.regions.east.region:East Africa`,
      flag: '🦁',
      status: $localize`:@@african-market-page.regions.east.status:Coming Soon - Q3 2025`,
      description: $localize`:@@african-market-page.regions.east.description:East Africa is known for mobile money innovation (M-Pesa) and a strong culture of entrepreneurship, particularly in Kenya and Rwanda.`,
      color: '#f59e0b',
      countries: [
        $localize`:@@african-market-page.regions.east.country1:Kenya`,
        $localize`:@@african-market-page.regions.east.country2:Rwanda`,
        $localize`:@@african-market-page.regions.east.country3:Tanzania`,
        $localize`:@@african-market-page.regions.east.country4:Uganda`,
        $localize`:@@african-market-page.regions.east.country5:Ethiopia`,
      ],
      opportunities: [
        $localize`:@@african-market-page.regions.east.opportunity1:Mobile money leadership (M-Pesa)`,
        $localize`:@@african-market-page.regions.east.opportunity2:Strong government support for tech`,
        $localize`:@@african-market-page.regions.east.opportunity3:Regional integration (EAC)`,
        $localize`:@@african-market-page.regions.east.opportunity4:Growing BPO sector`,
        $localize`:@@african-market-page.regions.east.opportunity5:Young, tech-savvy population`,
        $localize`:@@african-market-page.regions.east.opportunity6:Innovation hubs in Nairobi and Kigali`,
      ],
      challenges: [
        $localize`:@@african-market-page.regions.east.challenge1:Political instability in some regions`,
        $localize`:@@african-market-page.regions.east.challenge2:Infrastructure development needs`,
        $localize`:@@african-market-page.regions.east.challenge3:Access to capital`,
        $localize`:@@african-market-page.regions.east.challenge4:Skills gap in advanced tech`,
      ],
      timeline: $localize`:@@african-market-page.regions.east.timeline:Launch planned Q3 2025`,
    },
    {
      region: $localize`:@@african-market-page.regions.south.region:Southern Africa`,
      flag: '🇿🇦',
      status: $localize`:@@african-market-page.regions.south.status:Roadmap - 2026`,
      description: $localize`:@@african-market-page.regions.south.description:Southern Africa, led by South Africa, offers the most mature tech ecosystem on the continent with strong infrastructure and established markets.`,
      color: '#8b5cf6',
      countries: [
        $localize`:@@african-market-page.regions.south.country1:South Africa`,
        $localize`:@@african-market-page.regions.south.country2:Botswana`,
        $localize`:@@african-market-page.regions.south.country3:Namibia`,
        $localize`:@@african-market-page.regions.south.country4:Zimbabwe`,
        $localize`:@@african-market-page.regions.south.country5:Zambia`,
      ],
      opportunities: [
        $localize`:@@african-market-page.regions.south.opportunity1:Most developed tech infrastructure`,
        $localize`:@@african-market-page.regions.south.opportunity2:Established venture capital ecosystem`,
        $localize`:@@african-market-page.regions.south.opportunity3:Strong financial services sector`,
        $localize`:@@african-market-page.regions.south.opportunity4:High internet penetration`,
        $localize`:@@african-market-page.regions.south.opportunity5:Skilled workforce`,
        $localize`:@@african-market-page.regions.south.opportunity6:SADC regional market`,
      ],
      challenges: [
        $localize`:@@african-market-page.regions.south.challenge1:High competition from international players`,
        $localize`:@@african-market-page.regions.south.challenge2:Economic challenges`,
        $localize`:@@african-market-page.regions.south.challenge3:Load shedding (power cuts)`,
        $localize`:@@african-market-page.regions.south.challenge4:Skills emigration`,
      ],
      timeline: $localize`:@@african-market-page.regions.south.timeline:Launch planned 2026`,
    },
  ];

  protected readonly stats: AfricanStat[] = [
    {
      value: '1.4B',
      label: $localize`:@@african-market-page.stats.population.label:Population`,
      description: $localize`:@@african-market-page.stats.population.description:Youngest population globally (median age: 19)`,
      trend: $localize`:@@african-market-page.stats.population.trend:Growing to 2.5B by 2050`,
    },
    {
      value: '700M+',
      label: $localize`:@@african-market-page.stats.internet.label:Internet Users`,
      description: $localize`:@@african-market-page.stats.internet.description:Fastest growing internet market`,
      trend: $localize`:@@african-market-page.stats.internet.trend:+10% annual growth`,
    },
    {
      value: '$180B',
      label: $localize`:@@african-market-page.stats.economy.label:Digital Economy`,
      description: $localize`:@@african-market-page.stats.economy.description:By 2025, up from $115B in 2020`,
      trend: $localize`:@@african-market-page.stats.economy.trend:+5.2% annual growth`,
    },
    {
      value: '5,200+',
      label: $localize`:@@african-market-page.stats.startups.label:Tech Startups`,
      description: $localize`:@@african-market-page.stats.startups.description:Active startups across the continent`,
      trend: $localize`:@@african-market-page.stats.startups.trend:+3x since 2020`,
    },
    {
      value: '$6.5B',
      label: $localize`:@@african-market-page.stats.funding.label:VC Funding (2023)`,
      description: $localize`:@@african-market-page.stats.funding.description:Despite global downturn`,
      trend: $localize`:@@african-market-page.stats.funding.trend:Resilient growth`,
    },
    {
      value: '44M',
      label: $localize`:@@african-market-page.stats.smes.label:SMEs`,
      description: $localize`:@@african-market-page.stats.smes.description:Small and medium enterprises`,
      trend: $localize`:@@african-market-page.stats.smes.trend:80% of employment`,
    },
  ];

  protected readonly whyAfrica = [
    {
      icon: 'pi-chart-line',
      title: $localize`:@@african-market-page.whyAfrica.market.title:Fastest Growing Digital Market`,
      description: $localize`:@@african-market-page.whyAfrica.market.description:Africa has the fastest-growing internet user base globally, with mobile-first adoption driving digital transformation across all sectors.`,
      stats: [
        $localize`:@@african-market-page.whyAfrica.market.stat1:700M+ internet users`,
        $localize`:@@african-market-page.whyAfrica.market.stat2:10% annual growth`,
        $localize`:@@african-market-page.whyAfrica.market.stat3:80%+ mobile access`,
      ],
    },
    {
      icon: 'pi-users',
      title: $localize`:@@african-market-page.whyAfrica.population.title:Young, Tech-Savvy Population`,
      description: $localize`:@@african-market-page.whyAfrica.population.description:With a median age of 19, Africa has the youngest population globally. This demographic dividend creates massive opportunities for digital innovation.`,
      stats: [
        $localize`:@@african-market-page.whyAfrica.population.stat1:Median age: 19 years`,
        $localize`:@@african-market-page.whyAfrica.population.stat2:60% under 25`,
        $localize`:@@african-market-page.whyAfrica.population.stat3:200M youth entering workforce by 2035`,
      ],
    },
    {
      icon: 'pi-mobile',
      title: $localize`:@@african-market-page.whyAfrica.mobile.title:Mobile-First Innovation`,
      description: $localize`:@@african-market-page.whyAfrica.mobile.description:Africa pioneered mobile money (M-Pesa) and continues to lead in mobile-first solutions, leapfrogging traditional infrastructure.`,
      stats: [
        $localize`:@@african-market-page.whyAfrica.mobile.stat1:$700B mobile money transactions`,
        $localize`:@@african-market-page.whyAfrica.mobile.stat2:500M+ mobile money accounts`,
        $localize`:@@african-market-page.whyAfrica.mobile.stat3:Global leadership`,
      ],
    },
    {
      icon: 'pi-briefcase',
      title: $localize`:@@african-market-page.whyAfrica.spirit.title:Entrepreneurial Spirit`,
      description: $localize`:@@african-market-page.whyAfrica.spirit.description:Africa has the highest rate of entrepreneurship globally, with necessity and opportunity driving innovation across the continent.`,
      stats: [
        $localize`:@@african-market-page.whyAfrica.spirit.stat1:22% entrepreneurship rate`,
        $localize`:@@african-market-page.whyAfrica.spirit.stat2:Highest globally`,
        $localize`:@@african-market-page.whyAfrica.spirit.stat3:44M SMEs`,
      ],
    },
  ];

  protected readonly idemAdvantages = [
    {
      icon: 'pi-map-marker',
      title: $localize`:@@african-market-page.advantages.builtForAfrica.title:Built in Africa, for Africa`,
      description: $localize`:@@african-market-page.advantages.builtForAfrica.description:IDEM is founded and headquartered in Cameroon. We understand African markets, cultures, regulations, and challenges because we live them every day.`,
      benefits: [
        $localize`:@@african-market-page.advantages.builtForAfrica.benefit1:Local team with deep market knowledge`,
        $localize`:@@african-market-page.advantages.builtForAfrica.benefit2:Culturally relevant solutions`,
        $localize`:@@african-market-page.advantages.builtForAfrica.benefit3:Understanding of regulatory environments`,
        $localize`:@@african-market-page.advantages.builtForAfrica.benefit4:Aligned with African business practices`,
      ],
    },
    {
      icon: 'pi-dollar',
      title: $localize`:@@african-market-page.advantages.pricing.title:Pricing Designed for African Budgets`,
      description: $localize`:@@african-market-page.advantages.pricing.description:Our pricing is 60-80% cheaper than international alternatives, with a freemium model that lets entrepreneurs start for free.`,
      benefits: [
        $localize`:@@african-market-page.advantages.pricing.benefit1:Free tier with 10 credits`,
        $localize`:@@african-market-page.advantages.pricing.benefit2:Starter plan at $15/month`,
        $localize`:@@african-market-page.advantages.pricing.benefit3:No hidden fees`,
        $localize`:@@african-market-page.advantages.pricing.benefit4:Pay-as-you-grow model`,
      ],
    },
    {
      icon: 'pi-shield',
      title: $localize`:@@african-market-page.advantages.sovereignty.title:Data Sovereignty & Local Infrastructure`,
      description: $localize`:@@african-market-page.advantages.sovereignty.description:Your data stays in Africa. We deploy on African cloud infrastructure and support on-premise deployment for complete control.`,
      benefits: [
        $localize`:@@african-market-page.advantages.sovereignty.benefit1:African data centers`,
        $localize`:@@african-market-page.advantages.sovereignty.benefit2:Compliance with local regulations`,
        $localize`:@@african-market-page.advantages.sovereignty.benefit3:Low latency across the continent`,
        $localize`:@@african-market-page.advantages.sovereignty.benefit4:On-premise deployment options`,
      ],
    },
    {
      icon: 'pi-globe',
      title: $localize`:@@african-market-page.advantages.language.title:Pan-African Language & Cultural Support`,
      description: $localize`:@@african-market-page.advantages.language.description:IDEM supports multiple African languages and generates culturally relevant content that resonates with local audiences.`,
      benefits: [
        $localize`:@@african-market-page.advantages.language.benefit1:French, English, Portuguese support`,
        $localize`:@@african-market-page.advantages.language.benefit2:African language roadmap`,
        $localize`:@@african-market-page.advantages.language.benefit3:Culturally adapted business plans`,
        $localize`:@@african-market-page.advantages.language.benefit4:Local market research`,
      ],
    },
    {
      icon: 'pi-code',
      title: $localize`:@@african-market-page.advantages.openSource.title:Open Source for African Tech Sovereignty`,
      description: $localize`:@@african-market-page.advantages.openSource.description:Apache 2.0 license means African developers can audit, customize, and contribute to the platform, building tech sovereignty.`,
      benefits: [
        $localize`:@@african-market-page.advantages.openSource.benefit1:Full source code access`,
        $localize`:@@african-market-page.advantages.openSource.benefit2:No vendor lock-in`,
        $localize`:@@african-market-page.advantages.openSource.benefit3:Community-driven development`,
        $localize`:@@african-market-page.advantages.openSource.benefit4:African developer ecosystem`,
      ],
    },
    {
      icon: 'pi-users',
      title: $localize`:@@african-market-page.advantages.support.title:Supporting African Entrepreneurship`,
      description: $localize`:@@african-market-page.advantages.support.description:IDEM is committed to democratizing tech entrepreneurship across Africa, making world-class tools accessible to every African entrepreneur.`,
      benefits: [
        $localize`:@@african-market-page.advantages.support.benefit1:Free educational resources`,
        $localize`:@@african-market-page.advantages.support.benefit2:Community support`,
        $localize`:@@african-market-page.advantages.support.benefit3:Startup-friendly pricing`,
        $localize`:@@african-market-page.advantages.support.benefit4:Pan-African network`,
      ],
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = $localize`:@@african-market-page.seo.title:IDEM Africa - Pan-African AI Platform | Built in Cameroon for African Entrepreneurs`;
    const description = $localize`:@@african-market-page.seo.description:IDEM is Africa's first sovereign open source AI platform, built in Cameroon for pan-African tech entrepreneurship. Affordable, culturally relevant, and designed for African markets. Expanding across Central, West, East, and Southern Africa.`;

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content: $localize`:@@african-market-page.seo.keywords:African AI platform, Cameroon tech startup, pan-African technology, African entrepreneurship, African tech ecosystem, West Africa startups, East Africa innovation, Southern Africa tech, Central Africa digital, African digital economy, mobile-first Africa, African tech sovereignty, Francophone Africa tech, African startup tools, affordable AI Africa, African cloud infrastructure, African developers, tech entrepreneurship Africa, African innovation, digital transformation Africa`,
      },
      { name: 'author', content: 'IDEM - Cameroon' },
      { name: 'geo.region', content: 'CM' },
      { name: 'geo.placename', content: 'Cameroon' },
      { name: 'geo.position', content: '3.848;11.502' },
      { name: 'ICBM', content: '3.848, 11.502' },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${this.seoService.domain}/african-market` },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:locale:alternate', content: 'fr_FR' },
      {
        property: 'og:image',
        content: `${this.seoService.domain}/assets/seo/african-market-og.jpg`,
      },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/african-market');

    this.addStructuredData();
  }

  private addStructuredData(): void {
    if (!this.isBrowser()) return;

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'IDEM',
      description: $localize`:@@african-market-page.seo.structured.description:Africa's first sovereign open source AI platform for tech entrepreneurship`,
      url: this.seoService.domain,
      logo: `${this.seoService.domain}/assets/images/logo.png`,
      foundingDate: '2024',
      foundingLocation: {
        '@type': 'Place',
        name: 'Cameroon',
        geo: {
          '@type': 'GeoCoordinates',
          latitude: '3.848',
          longitude: '11.502',
        },
      },
      areaServed: [
        {
          '@type': 'Country',
          name: 'Cameroon',
        },
        {
          '@type': 'GeoShape',
          name: 'Central Africa',
        },
        {
          '@type': 'GeoShape',
          name: 'West Africa',
        },
        {
          '@type': 'GeoShape',
          name: 'East Africa',
        },
        {
          '@type': 'GeoShape',
          name: 'Southern Africa',
        },
      ],
      slogan: $localize`:@@african-market-page.seo.structured.slogan:African, you too can build`,
      knowsAbout: [
        $localize`:@@african-market-page.seo.structured.knowsAbout1:African tech entrepreneurship`,
        $localize`:@@african-market-page.seo.structured.knowsAbout2:Pan-African digital economy`,
        $localize`:@@african-market-page.seo.structured.knowsAbout3:African startup ecosystem`,
        $localize`:@@african-market-page.seo.structured.knowsAbout4:Mobile-first innovation`,
        $localize`:@@african-market-page.seo.structured.knowsAbout5:African digital transformation`,
      ],
      founder: [
        {
          '@type': 'Person',
          name: 'Arolle Dubois Aguekeng',
          jobTitle: 'CEO & Co-Founder',
          nationality: 'Cameroonian',
        },
        {
          '@type': 'Person',
          name: 'Romuald Djeteje',
          jobTitle: 'CTO & Co-Founder',
          nationality: 'Cameroonian',
        },
      ],
    };

    const existingScript = document.querySelector('script[data-african-market-structured-data]');
    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-african-market-structured-data', 'true');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }
}
