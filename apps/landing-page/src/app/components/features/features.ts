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
      name: 'Business',
      description: 'African-focused planning',
      icon: 'pi-chart-line',
      color: '#22c55e',
    },
    {
      id: 'branding',
      name: 'Branding',
      description: 'Cultural identity',
      icon: 'pi-palette',
      color: '#d11ec0',
    },
    {
      id: 'development',
      name: 'Development',
      description: '200+ AI agents',
      icon: 'pi-code',
      color: '#8b5cf6',
    },
    {
      id: 'deployment',
      name: 'Deployment',
      description: 'Sovereign infrastructure',
      icon: 'pi-rocket',
      color: '#06b6d4',
    },
  ]);

  protected readonly features = signal<Feature[]>([
    // Business Features (4)
    {
      id: 'business-plans',
      title: 'African Market Business Plans',
      description:
        'Generate business plans adapted to African markets with local insights and cultural context',
      icon: 'pi-chart-line',
      category: 'business',
      benefits: ['African market focus', 'Local regulations', 'Cultural adaptation'],
      color: '#22c55e',
      isPopular: true,
    },
    {
      id: 'financial-modeling',
      title: 'Affordable Financial Models',
      description: 'Cost-optimized financial planning with 60-80% savings vs international tools',
      icon: 'pi-dollar',
      category: 'business',
      benefits: ['Ultra-affordable pricing', 'Local currency support', 'African market rates'],
      color: '#22c55e',
    },
    {
      id: 'market-research',
      title: 'Pan-African Market Research',
      description: 'Analyze African markets with insights from Cameroon to South Africa',
      icon: 'pi-search',
      category: 'business',
      benefits: ['African competitor data', 'Regional trends', 'Local opportunities'],
      color: '#22c55e',
    },
    {
      id: 'strategy-planning',
      title: 'Strategy Planning',
      description: 'Build strategic roadmaps with clear goals and milestones',
      icon: 'pi-map',
      category: 'business',
      benefits: ['Strategic roadmap', 'Clear objectives', 'Timeline planning'],
      color: '#22c55e',
    },

    // Branding Features (4)
    {
      id: 'ai-logos',
      title: 'Culturally Relevant Logos',
      description: 'Create logos that resonate with African audiences and cultural values',
      icon: 'pi-star',
      category: 'branding',
      benefits: ['Cultural relevance', 'African aesthetics', 'Local market fit'],
      color: '#d11ec0',
      isPopular: true,
    },
    {
      id: 'brand-charter',
      title: 'African Brand Identity',
      description: 'Brand guidelines that reflect African values and resonate with local audiences',
      icon: 'pi-bookmark',
      category: 'branding',
      benefits: ['Cultural authenticity', 'Local market appeal', 'Pan-African reach'],
      color: '#d11ec0',
    },
    {
      id: 'color-palettes',
      title: 'Color Palettes',
      description: 'Generate harmonious color schemes that reflect your brand identity',
      icon: 'pi-palette',
      category: 'branding',
      benefits: ['Color harmony', 'Brand alignment', 'Accessibility'],
      color: '#d11ec0',
    },
    {
      id: 'typography',
      title: 'Typography System',
      description: 'Select perfect font combinations for your brand communication',
      icon: 'pi-font',
      category: 'branding',
      benefits: ['Font pairing', 'Brand consistency', 'Readability'],
      color: '#d11ec0',
    },

    // Development Features (4)
    {
      id: 'architecture-diagrams',
      title: '200+ Specialized AI Agents',
      description:
        'Multi-agent architecture with agents for design, code, business, and deployment',
      icon: 'pi-sitemap',
      category: 'development',
      benefits: ['200+ AI agents', 'Specialized expertise', 'Collaborative workflow'],
      color: '#8b5cf6',
      isPopular: true,
    },
    {
      id: 'code-generation',
      title: 'Open Source Code Generation',
      description: '100% transparent, auditable code generation with Apache 2.0 license',
      icon: 'pi-code',
      category: 'development',
      benefits: ['Fully auditable', 'No black boxes', 'Community reviewed'],
      color: '#8b5cf6',
    },
    {
      id: 'api-design',
      title: 'API Design',
      description: 'Design and document RESTful APIs with automatic testing setup',
      icon: 'pi-link',
      category: 'development',
      benefits: ['RESTful design', 'Auto-documentation', 'Testing included'],
      color: '#8b5cf6',
    },
    {
      id: 'database-design',
      title: 'Database Design',
      description: 'Create optimized database schemas with performance considerations',
      icon: 'pi-database',
      category: 'development',
      benefits: ['Optimized schema', 'Performance tuned', 'Scalable design'],
      color: '#8b5cf6',
    },

    // Deployment Features (4)
    {
      id: 'one-click-deploy',
      title: 'Sovereign Cloud Deployment',
      description: 'Deploy on African infrastructure with full data sovereignty and control',
      icon: 'pi-bolt',
      category: 'deployment',
      benefits: ['African infrastructure', 'Data sovereignty', 'Low latency'],
      color: '#06b6d4',
      isPopular: true,
    },
    {
      id: 'ai-assistant',
      title: 'On-Premise Deployment',
      description: 'Deploy IDEM on your own infrastructure for complete control and privacy',
      icon: 'pi-comments',
      category: 'deployment',
      benefits: ['Full control', 'Data privacy', 'Custom infrastructure'],
      color: '#06b6d4',
    },
    {
      id: 'template-deploy',
      title: 'Deployment Templates',
      description: 'Use pre-configured deployment templates for common architectures',
      icon: 'pi-th-large',
      category: 'deployment',
      benefits: ['Pre-configured', 'Best practices', 'Quick setup'],
      color: '#06b6d4',
    },
    {
      id: 'expert-mode',
      title: 'Expert Configuration',
      description: 'Advanced deployment settings with full control over infrastructure',
      icon: 'pi-cog',
      category: 'deployment',
      benefits: ['Full control', 'Advanced settings', 'Custom infrastructure'],
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
      name: 'Idem Platform Features',
      description:
        'Comprehensive AI-powered features for business planning, branding, development, and deployment',
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
      business: 'Business Planning Software',
      branding: 'Design Software',
      development: 'Development Tools',
      deployment: 'Deployment Platform',
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
