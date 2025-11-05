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
      title: $localize`:@@business-plan.sections.executive.title:Executive Summary`,
      description: $localize`:@@business-plan.sections.executive.description:Compelling overview of your business concept, mission, and key success factors`,
      icon: 'pi-crown',
      keyPoints: [
        $localize`:@@business-plan.sections.executive.point1:Business Concept`,
        $localize`:@@business-plan.sections.executive.point2:Mission Statement`,
        $localize`:@@business-plan.sections.executive.point3:Success Factors`,
        $localize`:@@business-plan.sections.executive.point4:Financial Summary`,
      ],
    },
    {
      id: 'market',
      title: $localize`:@@business-plan.sections.market.title:Market Analysis`,
      description: $localize`:@@business-plan.sections.market.description:In-depth research of your target market, competition, and industry trends`,
      icon: 'pi-chart-line',
      keyPoints: [
        $localize`:@@business-plan.sections.market.point1:Market Size`,
        $localize`:@@business-plan.sections.market.point2:Target Audience`,
        $localize`:@@business-plan.sections.market.point3:Competitive Analysis`,
        $localize`:@@business-plan.sections.market.point4:Market Trends`,
      ],
    },
    {
      id: 'strategy',
      title: $localize`:@@business-plan.sections.strategy.title:Business Strategy`,
      description: $localize`:@@business-plan.sections.strategy.description:AI fitness app with personalized workouts, approach to market entry`,
      icon: 'pi-sitemap',
      keyPoints: [
        $localize`:@@business-plan.sections.strategy.point1:Value Proposition`,
        $localize`:@@business-plan.sections.strategy.point2:Business Model`,
        $localize`:@@business-plan.sections.strategy.point3:Go-to-Market Strategy`,
        $localize`:@@business-plan.sections.strategy.point4:Competitive Advantage`,
      ],
    },
    {
      id: 'operations',
      title: $localize`:@@business-plan.sections.operations.title:Operations Plan`,
      description: $localize`:@@business-plan.sections.operations.description:Detailed operational structure, processes, and resource requirements`,
      icon: 'pi-cog',
      keyPoints: [
        $localize`:@@business-plan.sections.operations.point1:Operational Structure`,
        $localize`:@@business-plan.sections.operations.point2:Key Processes`,
        $localize`:@@business-plan.sections.operations.point3:Resource Requirements`,
        $localize`:@@business-plan.sections.operations.point4:Quality Control`,
      ],
    },
    {
      id: 'marketing',
      title: $localize`:@@business-plan.sections.marketing.title:Marketing Strategy`,
      description: $localize`:@@business-plan.sections.marketing.description:Comprehensive marketing and sales approach to reach your target customers`,
      icon: 'pi-megaphone',
      keyPoints: [
        $localize`:@@business-plan.sections.marketing.point1:Marketing Mix`,
        $localize`:@@business-plan.sections.marketing.point2:Sales Strategy`,
        $localize`:@@business-plan.sections.marketing.point3:Customer Acquisition`,
        $localize`:@@business-plan.sections.marketing.point4:Brand Positioning`,
      ],
    },
    {
      id: 'financial',
      title: $localize`:@@business-plan.sections.financial.title:Financial Projections`,
      description: $localize`:@@business-plan.sections.financial.description:Detailed financial forecasts, funding requirements, and return projections`,
      icon: 'pi-dollar',
      keyPoints: [
        $localize`:@@business-plan.sections.financial.point1:Revenue Projections`,
        $localize`:@@business-plan.sections.financial.point2:Cost Structure`,
        $localize`:@@business-plan.sections.financial.point3:Funding Requirements`,
        $localize`:@@business-plan.sections.financial.point4:ROI Analysis`,
      ],
    },
  ]);

  protected readonly businessExamples = signal<BusinessPlanExample[]>([
    {
      id: '1',
      companyName: 'TechFlow Solutions',
      industry: $localize`:@@business-plan.examples.techflow.industry:SaaS Technology`,
      stage: $localize`:@@business-plan.examples.techflow.stage:Startup`,
      revenue: $localize`:@@business-plan.examples.techflow.revenue:$500K ARR Target`,
      description: $localize`:@@business-plan.examples.techflow.description:AI fitness app with personalized workouts`,
      highlights: [
        $localize`:@@business-plan.examples.techflow.highlight1:5-year revenue projection: $50M`,
        $localize`:@@business-plan.examples.techflow.highlight2:Target market: 500M+ mobile users`,
        $localize`:@@business-plan.examples.techflow.highlight3:AI-powered personalization`,
      ],
      color: '#1447e6',
    },
    {
      id: '2',
      companyName: 'EcoGreen Marketplace',
      industry: $localize`:@@business-plan.examples.ecogreen.industry:E-commerce`,
      stage: $localize`:@@business-plan.examples.ecogreen.stage:Growth`,
      revenue: $localize`:@@business-plan.examples.ecogreen.revenue:$2M ARR Current`,
      description: $localize`:@@business-plan.examples.ecogreen.description:Sustainable products marketplace`,
      highlights: [
        $localize`:@@business-plan.examples.ecogreen.highlight1:5-year revenue projection: $25M`,
        $localize`:@@business-plan.examples.ecogreen.highlight2:Target market: 10M+ eco-consumers`,
        $localize`:@@business-plan.examples.ecogreen.highlight3:Verified sustainability focus`,
      ],
      color: '#22c55e',
    },
    {
      id: '3',
      companyName: 'HealthCare Connect',
      industry: $localize`:@@business-plan.examples.healthcare.industry:Healthcare`,
      stage: $localize`:@@business-plan.examples.healthcare.stage:Scale-up`,
      revenue: $localize`:@@business-plan.examples.healthcare.revenue:$10M ARR Current`,
      description: $localize`:@@business-plan.examples.healthcare.description:Telemedicine platform for underserved communities`,
      highlights: [
        $localize`:@@business-plan.examples.healthcare.highlight1:5-year revenue projection: $100M`,
        $localize`:@@business-plan.examples.healthcare.highlight2:Target market: 50M+ patients`,
        $localize`:@@business-plan.examples.healthcare.highlight3:Rural healthcare focus`,
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
      name: $localize`:@@business-plan.seo.serviceName:AI Business Plan Generation`,
      description: $localize`:@@business-plan.seo.serviceDescription:Comprehensive business plan creation with AI-powered market analysis, financial projections, and strategic planning`,
      provider: {
        '@type': 'Organization',
        name: 'Idem',
      },
      serviceType: $localize`:@@business-plan.seo.serviceType:Business Planning Software`,
      areaServed: $localize`:@@business-plan.seo.areaServed:Worldwide`,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: $localize`:@@business-plan.seo.offerCatalogName:Business Plan Components`,
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
