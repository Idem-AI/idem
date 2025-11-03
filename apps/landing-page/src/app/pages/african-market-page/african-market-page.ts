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
      region: 'Central Africa (Cameroon)',
      flag: '🇨🇲',
      status: 'Live Now - Our Home Base',
      description:
        'Cameroon is our founding market and the birthplace of IDEM. We understand the local ecosystem, regulatory environment, and entrepreneurial challenges firsthand.',
      color: '#10b981',
      countries: ['Cameroon', 'Gabon', 'Congo', 'Central African Republic'],
      opportunities: [
        'Growing tech ecosystem in Douala and Yaoundé',
        'Bilingual market (French/English)',
        'Strategic gateway to Central Africa',
        'Increasing digital adoption',
        'Government support for tech innovation',
      ],
      challenges: [
        'Infrastructure limitations',
        'Access to funding',
        'Digital payment adoption',
        'Internet connectivity in rural areas',
      ],
      timeline: 'Active since 2024',
    },
    {
      region: 'West Africa',
      flag: '🌍',
      status: 'Expanding - Q2 2025',
      description:
        "West Africa represents Africa's largest tech market with Nigeria leading the continent in startup funding and Ghana emerging as a fintech hub.",
      color: '#3b82f6',
      countries: ['Nigeria', 'Ghana', 'Senegal', "Côte d'Ivoire", 'Benin', 'Togo', 'Mali'],
      opportunities: [
        'Largest tech ecosystem in Africa (Nigeria)',
        'Strong fintech and e-commerce sectors',
        'High mobile penetration rates',
        'Vibrant startup communities',
        'Growing venture capital interest',
        'ECOWAS regional integration',
      ],
      challenges: [
        'Currency volatility',
        'Regulatory complexity across countries',
        'Infrastructure gaps',
        'Payment fragmentation',
      ],
      timeline: 'Launch planned Q2 2025',
    },
    {
      region: 'East Africa',
      flag: '🦁',
      status: 'Coming Soon - Q3 2025',
      description:
        'East Africa is known for mobile money innovation (M-Pesa) and a strong culture of entrepreneurship, particularly in Kenya and Rwanda.',
      color: '#f59e0b',
      countries: ['Kenya', 'Rwanda', 'Tanzania', 'Uganda', 'Ethiopia'],
      opportunities: [
        'Mobile money leadership (M-Pesa)',
        'Strong government support for tech',
        'Regional integration (EAC)',
        'Growing BPO sector',
        'Young, tech-savvy population',
        'Innovation hubs in Nairobi and Kigali',
      ],
      challenges: [
        'Political instability in some regions',
        'Infrastructure development needs',
        'Access to capital',
        'Skills gap in advanced tech',
      ],
      timeline: 'Launch planned Q3 2025',
    },
    {
      region: 'Southern Africa',
      flag: '🇿🇦',
      status: 'Roadmap - 2026',
      description:
        'Southern Africa, led by South Africa, offers the most mature tech ecosystem on the continent with strong infrastructure and established markets.',
      color: '#8b5cf6',
      countries: ['South Africa', 'Botswana', 'Namibia', 'Zimbabwe', 'Zambia'],
      opportunities: [
        'Most developed tech infrastructure',
        'Established venture capital ecosystem',
        'Strong financial services sector',
        'High internet penetration',
        'Skilled workforce',
        'SADC regional market',
      ],
      challenges: [
        'High competition from international players',
        'Economic challenges',
        'Load shedding (power cuts)',
        'Skills emigration',
      ],
      timeline: 'Launch planned 2026',
    },
  ];

  protected readonly stats: AfricanStat[] = [
    {
      value: '1.4B',
      label: 'Population',
      description: 'Youngest population globally (median age: 19)',
      trend: 'Growing to 2.5B by 2050',
    },
    {
      value: '700M+',
      label: 'Internet Users',
      description: 'Fastest growing internet market',
      trend: '+10% annual growth',
    },
    {
      value: '$180B',
      label: 'Digital Economy',
      description: 'By 2025, up from $115B in 2020',
      trend: '+5.2% annual growth',
    },
    {
      value: '5,200+',
      label: 'Tech Startups',
      description: 'Active startups across the continent',
      trend: '+3x since 2020',
    },
    {
      value: '$6.5B',
      label: 'VC Funding (2023)',
      description: 'Despite global downturn',
      trend: 'Resilient growth',
    },
    {
      value: '44M',
      label: 'SMEs',
      description: 'Small and medium enterprises',
      trend: '80% of employment',
    },
  ];

  protected readonly whyAfrica = [
    {
      icon: 'pi-chart-line',
      title: 'Fastest Growing Digital Market',
      description:
        'Africa has the fastest-growing internet user base globally, with mobile-first adoption driving digital transformation across all sectors.',
      stats: ['700M+ internet users', '10% annual growth', '80%+ mobile access'],
    },
    {
      icon: 'pi-users',
      title: 'Young, Tech-Savvy Population',
      description:
        'With a median age of 19, Africa has the youngest population globally. This demographic dividend creates massive opportunities for digital innovation.',
      stats: ['Median age: 19 years', '60% under 25', '200M youth entering workforce by 2035'],
    },
    {
      icon: 'pi-mobile',
      title: 'Mobile-First Innovation',
      description:
        'Africa pioneered mobile money (M-Pesa) and continues to lead in mobile-first solutions, leapfrogging traditional infrastructure.',
      stats: [
        '$700B mobile money transactions',
        '500M+ mobile money accounts',
        'Global leadership',
      ],
    },
    {
      icon: 'pi-briefcase',
      title: 'Entrepreneurial Spirit',
      description:
        'Africa has the highest rate of entrepreneurship globally, with necessity and opportunity driving innovation across the continent.',
      stats: ['22% entrepreneurship rate', 'Highest globally', '44M SMEs'],
    },
  ];

  protected readonly idemAdvantages = [
    {
      icon: 'pi-map-marker',
      title: 'Built in Africa, for Africa',
      description:
        'IDEM is founded and headquartered in Cameroon. We understand African markets, cultures, regulations, and challenges because we live them every day.',
      benefits: [
        'Local team with deep market knowledge',
        'Culturally relevant solutions',
        'Understanding of regulatory environments',
        'Aligned with African business practices',
      ],
    },
    {
      icon: 'pi-dollar',
      title: 'Pricing Designed for African Budgets',
      description:
        'Our pricing is 60-80% cheaper than international alternatives, with a freemium model that lets entrepreneurs start for free.',
      benefits: [
        'Free tier with 10 credits',
        'Starter plan at $15/month',
        'No hidden fees',
        'Pay-as-you-grow model',
      ],
    },
    {
      icon: 'pi-shield',
      title: 'Data Sovereignty & Local Infrastructure',
      description:
        'Your data stays in Africa. We deploy on African cloud infrastructure and support on-premise deployment for complete control.',
      benefits: [
        'African data centers',
        'Compliance with local regulations',
        'Low latency across the continent',
        'On-premise deployment options',
      ],
    },
    {
      icon: 'pi-globe',
      title: 'Pan-African Language & Cultural Support',
      description:
        'IDEM supports multiple African languages and generates culturally relevant content that resonates with local audiences.',
      benefits: [
        'French, English, Portuguese support',
        'African language roadmap',
        'Culturally adapted business plans',
        'Local market research',
      ],
    },
    {
      icon: 'pi-code',
      title: 'Open Source for African Tech Sovereignty',
      description:
        'Apache 2.0 license means African developers can audit, customize, and contribute to the platform, building tech sovereignty.',
      benefits: [
        'Full source code access',
        'No vendor lock-in',
        'Community-driven development',
        'African developer ecosystem',
      ],
    },
    {
      icon: 'pi-users',
      title: 'Supporting African Entrepreneurship',
      description:
        'IDEM is committed to democratizing tech entrepreneurship across Africa, making world-class tools accessible to every African entrepreneur.',
      benefits: [
        'Free educational resources',
        'Community support',
        'Startup-friendly pricing',
        'Pan-African network',
      ],
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title =
      'IDEM Africa - Pan-African AI Platform | Built in Cameroon for African Entrepreneurs';
    const description =
      "IDEM is Africa's first sovereign open source AI platform, built in Cameroon for pan-African tech entrepreneurship. Affordable, culturally relevant, and designed for African markets. Expanding across Central, West, East, and Southern Africa.";

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          'African AI platform, Cameroon tech startup, pan-African technology, African entrepreneurship, African tech ecosystem, West Africa startups, East Africa innovation, Southern Africa tech, Central Africa digital, African digital economy, mobile-first Africa, African tech sovereignty, Francophone Africa tech, African startup tools, affordable AI Africa, African cloud infrastructure, African developers, tech entrepreneurship Africa, African innovation, digital transformation Africa',
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
      description: "Africa's first sovereign open source AI platform for tech entrepreneurship",
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
      slogan: 'African, you too can build',
      knowsAbout: [
        'African tech entrepreneurship',
        'Pan-African digital economy',
        'African startup ecosystem',
        'Mobile-first innovation',
        'African digital transformation',
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
