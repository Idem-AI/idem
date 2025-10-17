import { Component, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Cta } from "../cta/cta";
import { SeoService } from '../../../../shared/services/seo.service';

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
  imports: [CommonModule, Cta],
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
      description: 'Strategic planning',
      icon: 'pi-chart-line',
      color: '#22c55e'
    },
    {
      id: 'branding',
      name: 'Branding',
      description: 'Visual identity',
      icon: 'pi-palette',
      color: '#d11ec0'
    },
    {
      id: 'development',
      name: 'Development',
      description: 'Code & architecture',
      icon: 'pi-code',
      color: '#8b5cf6'
    },
    {
      id: 'deployment',
      name: 'Deployment',
      description: 'App deployment',
      icon: 'pi-rocket',
      color: '#06b6d4'
    }
  ]);

  protected readonly features = signal<Feature[]>([
    // Business Features (4)
    {
      id: 'business-plans',
      title: 'Business Plans',
      description: 'Generate comprehensive business plans with market analysis and financial projections',
      icon: 'pi-chart-line',
      category: 'business',
      benefits: ['Market analysis', 'Financial projections', 'Investor-ready'],
      color: '#22c55e',
      isPopular: true
    },
    {
      id: 'financial-modeling',
      title: 'Financial Models',
      description: 'Create detailed revenue models and cost analysis for your business',
      icon: 'pi-dollar',
      category: 'business',
      benefits: ['Revenue forecasts', 'Cost breakdown', 'ROI calculations'],
      color: '#22c55e'
    },
    {
      id: 'market-research',
      title: 'Market Research',
      description: 'Analyze competitors and identify market opportunities automatically',
      icon: 'pi-search',
      category: 'business',
      benefits: ['Competitor analysis', 'Market trends', 'Growth opportunities'],
      color: '#22c55e'
    },
    {
      id: 'strategy-planning',
      title: 'Strategy Planning',
      description: 'Build strategic roadmaps with clear goals and milestones',
      icon: 'pi-map',
      category: 'business',
      benefits: ['Strategic roadmap', 'Clear objectives', 'Timeline planning'],
      color: '#22c55e'
    },
    
    // Branding Features (4)
    {
      id: 'ai-logos',
      title: 'AI Logo Generator',
      description: 'Create unique, professional logos instantly with AI-powered design',
      icon: 'pi-star',
      category: 'branding',
      benefits: ['Instant creation', 'Vector format', 'Brand-specific'],
      color: '#d11ec0',
      isPopular: true
    },
    {
      id: 'brand-charter',
      title: 'Brand Charter',
      description: 'Develop complete brand guidelines with colors, fonts, and usage rules',
      icon: 'pi-bookmark',
      category: 'branding',
      benefits: ['Brand guidelines', 'Usage standards', 'Consistency rules'],
      color: '#d11ec0'
    },
    {
      id: 'color-palettes',
      title: 'Color Palettes',
      description: 'Generate harmonious color schemes that reflect your brand identity',
      icon: 'pi-palette',
      category: 'branding',
      benefits: ['Color harmony', 'Brand alignment', 'Accessibility'],
      color: '#d11ec0'
    },
    {
      id: 'typography',
      title: 'Typography System',
      description: 'Select perfect font combinations for your brand communication',
      icon: 'pi-font',
      category: 'branding',
      benefits: ['Font pairing', 'Brand consistency', 'Readability'],
      color: '#d11ec0'
    },
    
    // Development Features (4)
    {
      id: 'architecture-diagrams',
      title: 'System Architecture',
      description: 'Generate UML diagrams and technical documentation automatically',
      icon: 'pi-sitemap',
      category: 'development',
      benefits: ['UML diagrams', 'Auto-generated', 'Documentation'],
      color: '#8b5cf6',
      isPopular: true
    },
    {
      id: 'code-generation',
      title: 'Code Generation',
      description: 'AI-powered code creation with clean, documented, and tested output',
      icon: 'pi-code',
      category: 'development',
      benefits: ['Clean code', 'Documentation', 'Best practices'],
      color: '#8b5cf6'
    },
    {
      id: 'api-design',
      title: 'API Design',
      description: 'Design and document RESTful APIs with automatic testing setup',
      icon: 'pi-link',
      category: 'development',
      benefits: ['RESTful design', 'Auto-documentation', 'Testing included'],
      color: '#8b5cf6'
    },
    {
      id: 'database-design',
      title: 'Database Design',
      description: 'Create optimized database schemas with performance considerations',
      icon: 'pi-database',
      category: 'development',
      benefits: ['Optimized schema', 'Performance tuned', 'Scalable design'],
      color: '#8b5cf6'
    },
    
    // Deployment Features (4)
    {
      id: 'one-click-deploy',
      title: 'One-Click Deploy',
      description: 'Deploy applications instantly without configuration or setup hassles',
      icon: 'pi-bolt',
      category: 'deployment',
      benefits: ['Zero configuration', 'Instant deployment', 'Auto-scaling'],
      color: '#06b6d4',
      isPopular: true
    },
    {
      id: 'ai-assistant',
      title: 'Deployment Assistant',
      description: 'Get guided deployment help through conversational AI interface',
      icon: 'pi-comments',
      category: 'deployment',
      benefits: ['Natural conversation', 'Step-by-step guide', 'Smart suggestions'],
      color: '#06b6d4'
    },
    {
      id: 'template-deploy',
      title: 'Deployment Templates',
      description: 'Use pre-configured deployment templates for common architectures',
      icon: 'pi-th-large',
      category: 'deployment',
      benefits: ['Pre-configured', 'Best practices', 'Quick setup'],
      color: '#06b6d4'
    },
    {
      id: 'expert-mode',
      title: 'Expert Configuration',
      description: 'Advanced deployment settings with full control over infrastructure',
      icon: 'pi-cog',
      category: 'deployment',
      benefits: ['Full control', 'Advanced settings', 'Custom infrastructure'],
      color: '#06b6d4'
    }
  ]);

  ngOnInit(): void {
    this.setupSeoForFeaturesSection();
  }

  private setupSeoForFeaturesSection(): void {
    // Add structured data for features section
    const featuresStructuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Idem Platform Features",
      "description": "Comprehensive AI-powered features for business planning, branding, development, and deployment",
      "numberOfItems": this.features().length,
      "itemListElement": this.features().map((feature, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "SoftwareApplication",
          "name": feature.title,
          "description": feature.description,
          "applicationCategory": this.getCategoryName(feature.category),
          "featureList": feature.benefits
        }
      }))
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
      'business': 'Business Planning Software',
      'branding': 'Design Software',
      'development': 'Development Tools',
      'deployment': 'Deployment Platform'
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
    
    
    return features.filter(feature => feature.category === selectedCat);
  }

  protected getSelectedCategory(): FeatureCategory {
    const categories = this.categories();
    const selectedId = this.selectedCategory();
    return categories.find(cat => cat.id === selectedId) || categories[0];
  }


}
