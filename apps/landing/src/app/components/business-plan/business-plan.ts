import { Component, signal, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';

interface BusinessPlanSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  keyPoints: string[];
}

interface BusinessPlanExample {
  id: string;
  companyName: string;
  industry: string;
  stage: string;
  revenue: string;
  description: string;
  highlights: string[];
  color: string;
}

@Component({
  selector: 'app-business-plan',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './business-plan.html',
  styleUrl: './business-plan.css',
})
export class BusinessPlan implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly activeTab = signal<string>('overview');
  protected readonly selectedExample = signal<number>(0);
  protected readonly showAll = signal<boolean>(false);
  protected readonly showAllSections = signal<boolean>(false);
  private intervalId?: number;

  protected readonly planSections = signal<BusinessPlanSection[]>([
    {
      id: 'executive',
      title: 'Executive Summary',
      description: 'Compelling overview of your business concept, mission, and key success factors',
      icon: 'pi-crown',
      keyPoints: ['Business Concept', 'Mission Statement', 'Success Factors', 'Financial Summary'],
    },
    {
      id: 'market',
      title: 'Market Analysis',
      description: 'In-depth research of your target market, competition, and industry trends',
      icon: 'pi-chart-line',
      keyPoints: ['Market Size', 'Target Audience', 'Competitive Analysis', 'Market Trends'],
    },
    {
      id: 'strategy',
      title: 'Business Strategy',
      description: 'AI fitness app with personalized workouts, approach to market entry',
      icon: 'pi-sitemap',
      keyPoints: [
        'Value Proposition',
        'Business Model',
        'Go-to-Market Strategy',
        'Competitive Advantage',
      ],
    },
    {
      id: 'operations',
      title: 'Operations Plan',
      description: 'Detailed operational structure, processes, and resource requirements',
      icon: 'pi-cog',
      keyPoints: [
        'Operational Structure',
        'Key Processes',
        'Resource Requirements',
        'Quality Control',
      ],
    },
    {
      id: 'marketing',
      title: 'Marketing Strategy',
      description: 'Comprehensive marketing and sales approach to reach your target customers',
      icon: 'pi-megaphone',
      keyPoints: ['Marketing Mix', 'Sales Strategy', 'Customer Acquisition', 'Brand Positioning'],
    },
    {
      id: 'financial',
      title: 'Financial Projections',
      description: 'Detailed financial forecasts, funding requirements, and return projections',
      icon: 'pi-dollar',
      keyPoints: ['Revenue Projections', 'Cost Structure', 'Funding Requirements', 'ROI Analysis'],
    },
  ]);

  protected readonly businessExamples = signal<BusinessPlanExample[]>([
    {
      id: '1',
      companyName: 'TechFlow Solutions',
      industry: 'SaaS Technology',
      stage: 'Startup',
      revenue: '$500K ARR Target',
      description: 'AI fitness app with personalized workouts',
      highlights: [
        '5-year revenue projection: $50M',
        'Target market: 500M+ mobile users',
        'AI-powered personalization',
      ],
      color: '#1447e6',
    },
    {
      id: '2',
      companyName: 'EcoGreen Marketplace',
      industry: 'E-commerce',
      stage: 'Growth',
      revenue: '$2M ARR Current',
      description: 'Sustainable products marketplace',
      highlights: [
        '5-year revenue projection: $25M',
        'Target market: 10M+ eco-consumers',
        'Verified sustainability focus',
      ],
      color: '#22c55e',
    },
    {
      id: '3',
      companyName: 'HealthCare Connect',
      industry: 'Healthcare',
      stage: 'Scale-up',
      revenue: '$10M ARR Current',
      description: 'Telemedicine platform for underserved communities',
      highlights: [
        '5-year revenue projection: $100M',
        'Target market: 50M+ patients',
        'Rural healthcare focus',
      ],
      color: '#3b82f6',
    },
  ]);

  ngOnInit(): void {
    this.setupSeoForBusinessPlanSection();
    this.startAutoRotation();
  }

  private startAutoRotation(): void {
    this.intervalId = window.setInterval(() => {
      const examples = this.businessExamples();
      const current = this.selectedExample();
      const next = (current + 1) % examples.length;
      this.selectedExample.set(next);
    }, 5000);
  }

  protected selectExample(index: number): void {
    this.selectedExample.set(index);
  }

  protected toggleShowAll(): void {
    this.showAll.set(!this.showAll());
  }

  protected getVisibleExamples(): BusinessPlanExample[] {
    const examples = this.businessExamples();
    return this.showAll() ? examples : examples.slice(0, 2);
  }

  protected toggleShowAllSections(): void {
    this.showAllSections.set(!this.showAllSections());
  }

  protected getVisibleSections(): BusinessPlanSection[] {
    const sections = this.planSections();
    return this.showAllSections() ? sections : sections.slice(0, 3);
  }

  private setupSeoForBusinessPlanSection(): void {
    // Add structured data for business plan section
    const businessPlanStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'AI Business Plan Generation',
      description:
        'Comprehensive business plan creation with AI-powered market analysis, financial projections, and strategic planning',
      provider: {
        '@type': 'Organization',
        name: 'Idem',
      },
      serviceType: 'Business Planning Software',
      areaServed: 'Worldwide',
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Business Plan Components',
        itemListElement: this.planSections().map((section, index) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: section.title,
            description: section.description,
          },
        })),
      },
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-business-plan-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-business-plan-structured-data', 'true');
      script.textContent = JSON.stringify(businessPlanStructuredData);
      document.head.appendChild(script);
    }
  }

  protected getCurrentExample(): BusinessPlanExample {
    return this.businessExamples()[this.selectedExample()];
  }
}
