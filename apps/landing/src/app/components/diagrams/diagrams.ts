import { Component, signal, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';

interface DiagramType {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  examples: string[];
}

interface DiagramExample {
  id: string;
  title: string;
  type: string;
  industry: string;
  complexity: 'Simple' | 'Medium' | 'Complex';
  description: string;
  elements: number;
  connections: number;
  previewData: string;
}

@Component({
  selector: 'app-diagrams',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagrams.html',
  styleUrl: './diagrams.css',
})
export class Diagrams implements OnInit, OnDestroy {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly showAll = signal<boolean>(false);
  protected readonly activeExample = signal<number>(0);
  private intervalId?: number;

  protected readonly diagramTypes = signal<DiagramType[]>([
    {
      id: 'use-case',
      title: $localize`:@@diagrams.types.useCase.title:Use Case Diagrams`,
      description: $localize`:@@diagrams.types.useCase.description:Visual representation of system functionality and user interactions`,
      icon: 'pi-users',
      color: '#1447e6',
      examples: [
        $localize`:@@diagrams.types.useCase.example1:User Registration`,
        $localize`:@@diagrams.types.useCase.example2:Payment Processing`,
        $localize`:@@diagrams.types.useCase.example3:Content Management`,
      ],
    },
    {
      id: 'class',
      title: $localize`:@@diagrams.types.class.title:Class Diagrams`,
      description: $localize`:@@diagrams.types.class.description:Object-oriented system structure with classes, attributes, and relationships`,
      icon: 'pi-sitemap',
      color: '#22c55e',
      examples: [
        $localize`:@@diagrams.types.class.example1:User Management`,
        $localize`:@@diagrams.types.class.example2:Product Catalog`,
        $localize`:@@diagrams.types.class.example3:Order System`,
      ],
    },
    {
      id: 'sequence',
      title: $localize`:@@diagrams.types.sequence.title:Sequence Diagrams`,
      description: $localize`:@@diagrams.types.sequence.description:Time-ordered interaction between system components and actors`,
      icon: 'pi-arrows-h',
      color: '#d11ec0',
      examples: [
        $localize`:@@diagrams.types.sequence.example1:Login Flow`,
        $localize`:@@diagrams.types.sequence.example2:API Calls`,
        $localize`:@@diagrams.types.sequence.example3:Data Processing`,
      ],
    },
    {
      id: 'activity',
      title: $localize`:@@diagrams.types.activity.title:Activity Diagrams`,
      description: $localize`:@@diagrams.types.activity.description:Workflow and business process modeling with decision points`,
      icon: 'pi-share-alt',
      color: '#f59e0b',
      examples: [
        $localize`:@@diagrams.types.activity.example1:Order Processing`,
        $localize`:@@diagrams.types.activity.example2:User Onboarding`,
        $localize`:@@diagrams.types.activity.example3:Content Approval`,
      ],
    },
    {
      id: 'component',
      title: $localize`:@@diagrams.types.component.title:Component Diagrams`,
      description: $localize`:@@diagrams.types.component.description:System architecture showing components and their dependencies`,
      icon: 'pi-th-large',
      color: '#8b5cf6',
      examples: [
        $localize`:@@diagrams.types.component.example1:Microservices`,
        $localize`:@@diagrams.types.component.example2:Frontend Architecture`,
        $localize`:@@diagrams.types.component.example3:Database Design`,
      ],
    },
    {
      id: 'deployment',
      title: $localize`:@@diagrams.types.deployment.title:Deployment Diagrams`,
      description: $localize`:@@diagrams.types.deployment.description:Infrastructure and deployment architecture visualization`,
      icon: 'pi-cloud',
      color: '#06b6d4',
      examples: [
        $localize`:@@diagrams.types.deployment.example1:Cloud Infrastructure`,
        $localize`:@@diagrams.types.deployment.example2:Server Architecture`,
        $localize`:@@diagrams.types.deployment.example3:Network Topology`,
      ],
    },
  ]);

  protected readonly diagramExamples = signal<DiagramExample[]>([
    {
      id: '1',
      title: $localize`:@@diagrams.examples.ecommerce.title:E-commerce Platform Use Cases`,
      type: $localize`:@@diagrams.examples.ecommerce.type:Use Case`,
      industry: $localize`:@@diagrams.examples.ecommerce.industry:E-commerce`,
      complexity: 'Complex',
      description: $localize`:@@diagrams.examples.ecommerce.description:User journey from registration to checkout`,
      elements: 12,
      connections: 18,
      previewData: $localize`:@@diagrams.examples.ecommerce.preview:User → Browse Products → Add to Cart → Checkout → Payment → Order Confirmation`,
    },
    {
      id: '2',
      title: $localize`:@@diagrams.examples.saas.title:SaaS Application Classes`,
      type: $localize`:@@diagrams.examples.saas.type:Class Diagram`,
      industry: $localize`:@@diagrams.examples.saas.industry:SaaS`,
      complexity: 'Medium',
      description: $localize`:@@diagrams.examples.saas.description:Multi-tenant SaaS application structure`,
      elements: 8,
      connections: 14,
      previewData: $localize`:@@diagrams.examples.saas.preview:User ← extends → Admin | Product → contains → Features | Subscription → manages → Billing`,
    },
    {
      id: '3',
      title: $localize`:@@diagrams.examples.api.title:API Authentication Sequence`,
      type: $localize`:@@diagrams.examples.api.type:Sequence`,
      industry: $localize`:@@diagrams.examples.api.industry:Technology`,
      complexity: 'Simple',
      description: $localize`:@@diagrams.examples.api.description:JWT authentication flow`,
      elements: 5,
      connections: 10,
      previewData: $localize`:@@diagrams.examples.api.preview:Client → Auth Server → Database → Token Generation → Response`,
    },
    {
      id: '4',
      title: $localize`:@@diagrams.examples.healthcare.title:Healthcare Workflow Activity`,
      type: $localize`:@@diagrams.examples.healthcare.type:Activity`,
      industry: $localize`:@@diagrams.examples.healthcare.industry:Healthcare`,
      complexity: 'Complex',
      description: $localize`:@@diagrams.examples.healthcare.description:Patient treatment workflow`,
      elements: 15,
      connections: 22,
      previewData: $localize`:@@diagrams.examples.healthcare.preview:Patient Registration → Triage → Doctor Assignment → Treatment → Billing → Discharge`,
    },
  ]);

  ngOnInit(): void {
    this.setupSeoForDiagramsSection();
    this.startAutoRotation();
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private startAutoRotation(): void {
    this.intervalId = window.setInterval(() => {
      const examples = this.diagramExamples();
      const current = this.activeExample();
      const next = (current + 1) % examples.length;
      this.activeExample.set(next);
    }, 4000);
  }

  protected toggleShowAll(): void {
    this.showAll.set(!this.showAll());
  }

  protected getVisibleExamples(): DiagramExample[] {
    const examples = this.diagramExamples();
    return this.showAll() ? examples : examples.slice(0, 3);
  }

  protected selectExample(index: number): void {
    this.activeExample.set(index);
  }

  protected getFilteredTypes(): DiagramType[] {
    return this.diagramTypes();
  }

  protected getCurrentExample(): DiagramExample {
    return this.diagramExamples()[this.activeExample()];
  }

  private setupSeoForDiagramsSection(): void {
    // Add structured data for diagrams section
    const diagramsStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: $localize`:@@diagrams.seo.name:AI UML Diagram Generation`,
      description: $localize`:@@diagrams.seo.description:Automated generation of UML diagrams including use case, class, sequence, activity, component, and deployment diagrams`,
      provider: {
        '@type': 'Organization',
        name: 'Idem',
      },
      serviceType: $localize`:@@diagrams.seo.serviceType:Software Development Tools`,
      areaServed: $localize`:@@diagrams.seo.areaServed:Worldwide`,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: $localize`:@@diagrams.seo.offerCatalogName:UML Diagram Types`,
        itemListElement: this.diagramTypes().map((diagram) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: diagram.title,
            description: diagram.description,
            category: $localize`:@@diagrams.seo.category:UML Diagram Generation`,
          },
        })),
      },
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-diagrams-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-diagrams-structured-data', 'true');
      script.textContent = JSON.stringify(diagramsStructuredData);
      document.head.appendChild(script);
    }
  }

  protected getComplexityColor(complexity: string): string {
    switch (complexity) {
      case $localize`:@@diagrams.complexity.simple:Simple`:
        return '#22c55e';
      case $localize`:@@diagrams.complexity.medium:Medium`:
        return '#f59e0b';
      case $localize`:@@diagrams.complexity.complex:Complex`:
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }
}
