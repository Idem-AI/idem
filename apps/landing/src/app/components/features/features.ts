import { Component, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'business' | 'branding' | 'development' | 'deployment';
  benefits: string[];
  color: string;
  isPopular?: boolean;
}

interface FeatureCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './features.html',
  styleUrl: './features.css',
})
export class Features implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly selectedCategory = signal<string>('business');
  protected readonly hoveredFeature = signal<string | null>(null);

  protected readonly categories = signal<FeatureCategory[]>([
    {
      id: 'business',
      name: $localize`:@@features.categories.business.name:Business`,
      description: $localize`:@@features.categories.business.description:African-focused planning`,
      icon: 'pi-chart-line',
      color: '#22c55e',
    },
    {
      id: 'branding',
      name: $localize`:@@features.categories.branding.name:Branding`,
      description: $localize`:@@features.categories.branding.description:Cultural identity`,
      icon: 'pi-palette',
      color: '#d11ec0',
    },
    {
      id: 'development',
      name: $localize`:@@features.categories.development.name:Development`,
      description: $localize`:@@features.categories.development.description:200+ AI agents`,
      icon: 'pi-code',
      color: '#8b5cf6',
    },
    {
      id: 'deployment',
      name: $localize`:@@features.categories.deployment.name:Deployment`,
      description: $localize`:@@features.categories.deployment.description:Sovereign infrastructure`,
      icon: 'pi-rocket',
      color: '#06b6d4',
    },
  ]);

  protected readonly features = signal<Feature[]>([
    // Business Features (4)
    {
      id: 'business-plans',
      title: $localize`:@@features.business.plans.title:African Market Business Plans`,
      description: $localize`:@@features.business.plans.description:Generate business plans adapted to African markets with local insights and cultural context`,
      icon: 'pi-chart-line',
      category: 'business',
      benefits: [
        $localize`:@@features.business.plans.benefit1:African market focus`,
        $localize`:@@features.business.plans.benefit2:Local regulations`,
        $localize`:@@features.business.plans.benefit3:Cultural adaptation`,
      ],
      color: '#22c55e',
      isPopular: true,
    },
    {
      id: 'financial-modeling',
      title: $localize`:@@features.business.financial.title:Affordable Financial Models`,
      description: $localize`:@@features.business.financial.description:Cost-optimized financial planning with 60-80% savings vs international tools`,
      icon: 'pi-dollar',
      category: 'business',
      benefits: [
        $localize`:@@features.business.financial.benefit1:Ultra-affordable pricing`,
        $localize`:@@features.business.financial.benefit2:Local currency support`,
        $localize`:@@features.business.financial.benefit3:African market rates`,
      ],
      color: '#22c55e',
    },
    {
      id: 'market-research',
      title: $localize`:@@features.business.research.title:Pan-African Market Research`,
      description: $localize`:@@features.business.research.description:Analyze African markets with insights from Cameroon to South Africa`,
      icon: 'pi-search',
      category: 'business',
      benefits: [
        $localize`:@@features.business.research.benefit1:African competitor data`,
        $localize`:@@features.business.research.benefit2:Regional trends`,
        $localize`:@@features.business.research.benefit3:Local opportunities`,
      ],
      color: '#22c55e',
    },
    {
      id: 'strategy-planning',
      title: $localize`:@@features.business.strategy.title:Strategy Planning`,
      description: $localize`:@@features.business.strategy.description:Build strategic roadmaps with clear goals and milestones`,
      icon: 'pi-map',
      category: 'business',
      benefits: [
        $localize`:@@features.business.strategy.benefit1:Strategic roadmap`,
        $localize`:@@features.business.strategy.benefit2:Clear objectives`,
        $localize`:@@features.business.strategy.benefit3:Timeline planning`,
      ],
      color: '#22c55e',
    },

    // Branding Features (4)
    {
      id: 'ai-logos',
      title: $localize`:@@features.branding.logos.title:Culturally Relevant Logos`,
      description: $localize`:@@features.branding.logos.description:Create logos that resonate with African audiences and cultural values`,
      icon: 'pi-star',
      category: 'branding',
      benefits: [
        $localize`:@@features.branding.logos.benefit1:Cultural relevance`,
        $localize`:@@features.branding.logos.benefit2:African aesthetics`,
        $localize`:@@features.branding.logos.benefit3:Local market fit`,
      ],
      color: '#d11ec0',
      isPopular: true,
    },
    {
      id: 'brand-charter',
      title: $localize`:@@features.branding.charter.title:African Brand Identity`,
      description: $localize`:@@features.branding.charter.description:Brand guidelines that reflect African values and resonate with local audiences`,
      icon: 'pi-bookmark',
      category: 'branding',
      benefits: [
        $localize`:@@features.branding.charter.benefit1:Cultural authenticity`,
        $localize`:@@features.branding.charter.benefit2:Local market appeal`,
        $localize`:@@features.branding.charter.benefit3:Pan-African reach`,
      ],
      color: '#d11ec0',
    },
    {
      id: 'color-palettes',
      title: $localize`:@@features.branding.palettes.title:Color Palettes`,
      description: $localize`:@@features.branding.palettes.description:Generate harmonious color schemes that reflect your brand identity`,
      icon: 'pi-palette',
      category: 'branding',
      benefits: [
        $localize`:@@features.branding.palettes.benefit1:Color harmony`,
        $localize`:@@features.branding.palettes.benefit2:Brand alignment`,
        $localize`:@@features.branding.palettes.benefit3:Accessibility`,
      ],
      color: '#d11ec0',
    },
    {
      id: 'typography',
      title: $localize`:@@features.branding.typography.title:Typography System`,
      description: $localize`:@@features.branding.typography.description:Select perfect font combinations for your brand communication`,
      icon: 'pi-font',
      category: 'branding',
      benefits: [
        $localize`:@@features.branding.typography.benefit1:Font pairing`,
        $localize`:@@features.branding.typography.benefit2:Brand consistency`,
        $localize`:@@features.branding.typography.benefit3:Readability`,
      ],
      color: '#d11ec0',
    },

    // Development Features (4)
    {
      id: 'architecture-diagrams',
      title: $localize`:@@features.development.agents.title:200+ Specialized AI Agents`,
      description: $localize`:@@features.development.agents.description:Multi-agent architecture with agents for design, code, business, and deployment`,
      icon: 'pi-sitemap',
      category: 'development',
      benefits: [
        $localize`:@@features.development.agents.benefit1:200+ AI agents`,
        $localize`:@@features.development.agents.benefit2:Specialized expertise`,
        $localize`:@@features.development.agents.benefit3:Collaborative workflow`,
      ],
      color: '#8b5cf6',
      isPopular: true,
    },
    {
      id: 'code-generation',
      title: $localize`:@@features.development.code.title:Open Source Code Generation`,
      description: $localize`:@@features.development.code.description:100% transparent, auditable code generation with Apache 2.0 license`,
      icon: 'pi-code',
      category: 'development',
      benefits: [
        $localize`:@@features.development.code.benefit1:Fully auditable`,
        $localize`:@@features.development.code.benefit2:No black boxes`,
        $localize`:@@features.development.code.benefit3:Community reviewed`,
      ],
      color: '#8b5cf6',
    },
    {
      id: 'api-design',
      title: $localize`:@@features.development.api.title:API Design`,
      description: $localize`:@@features.development.api.description:Design and document RESTful APIs with automatic testing setup`,
      icon: 'pi-link',
      category: 'development',
      benefits: [
        $localize`:@@features.development.api.benefit1:RESTful design`,
        $localize`:@@features.development.api.benefit2:Auto-documentation`,
        $localize`:@@features.development.api.benefit3:Testing included`,
      ],
      color: '#8b5cf6',
    },
    {
      id: 'database-design',
      title: $localize`:@@features.development.database.title:Database Design`,
      description: $localize`:@@features.development.database.description:Create optimized database schemas with performance considerations`,
      icon: 'pi-database',
      category: 'development',
      benefits: [
        $localize`:@@features.development.database.benefit1:Optimized schema`,
        $localize`:@@features.development.database.benefit2:Performance tuned`,
        $localize`:@@features.development.database.benefit3:Scalable design`,
      ],
      color: '#8b5cf6',
    },

    // Deployment Features (4)
    {
      id: 'one-click-deploy',
      title: $localize`:@@features.deployment.sovereign.title:Sovereign Cloud Deployment`,
      description: $localize`:@@features.deployment.sovereign.description:Deploy on African infrastructure with full data sovereignty and control`,
      icon: 'pi-bolt',
      category: 'deployment',
      benefits: [
        $localize`:@@features.deployment.sovereign.benefit1:African infrastructure`,
        $localize`:@@features.deployment.sovereign.benefit2:Data sovereignty`,
        $localize`:@@features.deployment.sovereign.benefit3:Low latency`,
      ],
      color: '#06b6d4',
      isPopular: true,
    },
    {
      id: 'ai-assistant',
      title: $localize`:@@features.deployment.onpremise.title:On-Premise Deployment`,
      description: $localize`:@@features.deployment.onpremise.description:Deploy IDEM on your own infrastructure for complete control and privacy`,
      icon: 'pi-comments',
      category: 'deployment',
      benefits: [
        $localize`:@@features.deployment.onpremise.benefit1:Full control`,
        $localize`:@@features.deployment.onpremise.benefit2:Data privacy`,
        $localize`:@@features.deployment.onpremise.benefit3:Custom infrastructure`,
      ],
      color: '#06b6d4',
    },
    {
      id: 'template-deploy',
      title: $localize`:@@features.deployment.templates.title:Deployment Templates`,
      description: $localize`:@@features.deployment.templates.description:Use pre-configured deployment templates for common architectures`,
      icon: 'pi-th-large',
      category: 'deployment',
      benefits: [
        $localize`:@@features.deployment.templates.benefit1:Pre-configured`,
        $localize`:@@features.deployment.templates.benefit2:Best practices`,
        $localize`:@@features.deployment.templates.benefit3:Quick setup`,
      ],
      color: '#06b6d4',
    },
    {
      id: 'expert-mode',
      title: $localize`:@@features.deployment.expert.title:Expert Configuration`,
      description: $localize`:@@features.deployment.expert.description:Advanced deployment settings with full control over infrastructure`,
      icon: 'pi-cog',
      category: 'deployment',
      benefits: [
        $localize`:@@features.deployment.expert.benefit1:Full control`,
        $localize`:@@features.deployment.expert.benefit2:Advanced settings`,
        $localize`:@@features.deployment.expert.benefit3:Custom infrastructure`,
      ],
      color: '#06b6d4',
    },
  ]);

  ngOnInit(): void {
    this.setupSeoForFeaturesSection();
  }

  private setupSeoForFeaturesSection(): void {
    // Add structured data for features section
    const featuresStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: $localize`:@@features.seo.name:Idem Platform Features`,
      description: $localize`:@@features.seo.description:Comprehensive AI-powered features for business planning, branding, development, and deployment`,
      numberOfItems: this.features().length,
      itemListElement: this.features().map((feature, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'SoftwareApplication',
          name: feature.title,
          description: feature.description,
          applicationCategory: this.getCategoryName(feature.category),
          featureList: feature.benefits,
        },
      })),
    };

    // Add structured data to page if not already present
    if (this.isBrowser() && !document.querySelector('script[data-features-structured-data]')) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-features-structured-data', 'true');
      script.textContent = JSON.stringify(featuresStructuredData);
      document.head.appendChild(script);
    }
  }

  private getCategoryName(categoryId: string): string {
    const categoryMap: Record<string, string> = {
      business: $localize`:@@features.categoryMap.business:Business Planning Software`,
      branding: $localize`:@@features.categoryMap.branding:Design Software`,
      development: $localize`:@@features.categoryMap.development:Development Tools`,
      deployment: $localize`:@@features.categoryMap.deployment:Deployment Platform`,
    };
    return categoryMap[categoryId] || 'Software Application';
  }

  protected selectCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
  }

  protected setHoveredFeature(featureId: string | null): void {
    this.hoveredFeature.set(featureId);
  }

  protected getFilteredFeatures(): Feature[] {
    const features = this.features();
    const selectedCat = this.selectedCategory();

    return features.filter((feature) => feature.category === selectedCat);
  }

  protected getSelectedCategory(): FeatureCategory {
    const categories = this.categories();
    const selectedId = this.selectedCategory();
    return categories.find((cat) => cat.id === selectedId) || categories[0];
  }
}
