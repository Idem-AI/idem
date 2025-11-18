import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  credits: number;
  creditsLabel: string;
  description: string;
  features: string[];
  deployment: string;
  storage: string;
  projects: string;
  collaboration: string;
  support: string;
  sla?: string;
  popular?: boolean;
  cta: string;
}

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  discount?: string;
  description: string;
  popular?: boolean;
}

interface GenerationCost {
  name: string;
  credits: number;
  price: number;
  apiCost: number;
  margin: number;
  value: string;
  description: string;
  icon: string;
}

interface ComparisonFeature {
  name: string;
  free: string | boolean;
  starter: string | boolean;
  professional: string | boolean;
  business: string | boolean;
  enterprise: string | boolean;
}

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.css',
})
export class PricingPage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // Onglet actif (subscriptions ou credits)
  protected activeTab = signal<'subscriptions' | 'credits'>('subscriptions');

  // Plans d'abonnement
  protected readonly subscriptionPlans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: '/forever',
      credits: 10,
      creditsLabel: '10 credits (one-time)',
      description: 'Test IDEM with a complete project',
      features: [
        'Access to all features',
        '10 one-time credits',
        'Generate 1 complete project',
        'Export code in ZIP',
        'Quick deployment (subdomain)',
        'Community support',
      ],
      deployment: 'Quick (subdomain)',
      storage: '500 MB',
      projects: '1 active',
      collaboration: 'No',
      support: 'Community',
      cta: 'Start Free',
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 15,
      period: '/month',
      credits: 150,
      creditsLabel: '150 credits/month',
      description: 'Perfect for entrepreneurs creating regularly',
      features: [
        '150 monthly renewable credits',
        '~2 complete projects/month',
        'Custom domain deployment',
        '3 active projects',
        '5 GB storage',
        'Basic monitoring',
        'Email support',
      ],
      deployment: 'Custom domain',
      storage: '5 GB',
      projects: '3',
      collaboration: 'No',
      support: 'Email',
      popular: true,
      cta: 'Get Started',
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 60,
      period: '/month',
      credits: 650,
      creditsLabel: '650 credits/month',
      description: 'For agencies managing multiple clients',
      features: [
        '650 monthly renewable credits',
        '~10 projects/month',
        'VPS deployment (advanced)',
        '10 active projects',
        'Multi-environment (dev/staging/prod)',
        '5 team members',
        '50 GB storage',
        'Complete monitoring & logs',
        'Priority support',
      ],
      deployment: 'VPS (advanced)',
      storage: '50 GB',
      projects: '10',
      collaboration: '5 users',
      support: 'Priority',
      cta: 'Go Pro',
    },
    {
      id: 'business',
      name: 'Business',
      price: 150,
      period: '/month',
      credits: 1800,
      creditsLabel: '1,800 credits/month',
      description: 'For established agencies and SMEs',
      features: [
        '1,800 monthly renewable credits',
        '~28 projects/month',
        'Cloud deployment (AWS/GCP)',
        'Unlimited projects',
        'Unlimited collaboration',
        'Role management',
        '500 GB storage',
        '99.9% SLA',
        'Dedicated support',
        'IDEM API access',
        'Partial white-labeling',
      ],
      deployment: 'Cloud (AWS/GCP)',
      storage: '500 GB',
      projects: 'Unlimited',
      collaboration: 'Unlimited',
      support: 'Dedicated',
      sla: '99.9%',
      cta: 'Scale Up',
    },
  ];

  // Packs de crédits
  protected readonly creditPacks: CreditPack[] = [
    {
      id: 'discovery',
      name: 'Discovery',
      credits: 50,
      price: 4,
      pricePerCredit: 0.08,
      description: 'Test IDEM with your first project',
      popular: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      credits: 150,
      price: 12,
      pricePerCredit: 0.08,
      description: 'Complete project: Identity + BP + App',
      popular: true,
    },
    {
      id: 'growth',
      name: 'Growth',
      credits: 400,
      price: 35,
      pricePerCredit: 0.0875,
      discount: '+9%',
      description: '2-3 projects with iterations',
      popular: false,
    },
    {
      id: 'professional',
      name: 'Professional',
      credits: 1000,
      price: 80,
      pricePerCredit: 0.08,
      description: '~15-16 complete projects',
      popular: false,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      credits: 5000,
      price: 375,
      pricePerCredit: 0.075,
      discount: '-6%',
      description: '~75-80 projects for agencies',
      popular: false,
    },
  ];

  // Coûts par type de génération
  protected readonly generationCosts: GenerationCost[] = [
    {
      name: 'Logo SVG (4 proposals)',
      credits: 3,
      price: 0.3,
      apiCost: 0.06,
      margin: 80,
      value: '$500-2,000',
      description: '4 professional logos with mockups',
      icon: 'pi-palette',
    },
    {
      name: 'Brand Guidelines',
      credits: 5,
      price: 0.5,
      apiCost: 0.04,
      margin: 92,
      value: '$2,000-5,000',
      description: 'Complete 10-page brand charter',
      icon: 'pi-book',
    },
    {
      name: 'Complete Identity Package',
      credits: 7,
      price: 0.7,
      apiCost: 0.1,
      margin: 86,
      value: '$2,500-7,000',
      description: 'Logo + Brand guidelines (save 1 credit)',
      icon: 'pi-star',
    },
    {
      name: 'Business Plan',
      credits: 20,
      price: 2.0,
      apiCost: 0.3,
      margin: 85,
      value: '$5,000-15,000',
      description: 'Complete 80-page BP',
      icon: 'pi-chart-line',
    },
    {
      name: 'Legal Document',
      credits: 2,
      price: 0.2,
      apiCost: 0.02,
      margin: 90,
      value: '$500-2,000',
      description: 'Terms, privacy policy, contracts',
      icon: 'pi-file',
    },
    {
      name: 'UML Diagrams',
      credits: 3,
      price: 0.3,
      apiCost: 0.03,
      margin: 90,
      value: '$1,000-3,000',
      description: 'Complete diagram set',
      icon: 'pi-sitemap',
    },
    {
      name: 'Landing Page',
      credits: 4,
      price: 0.4,
      apiCost: 0.05,
      margin: 88,
      value: '$1,500-5,000',
      description: 'Responsive HTML/CSS/JS',
      icon: 'pi-desktop',
    },
    {
      name: 'Fullstack Application',
      credits: 30,
      price: 3.0,
      apiCost: 0.38,
      margin: 87,
      value: '$15,000-50,000',
      description: 'Frontend + Backend + Database',
      icon: 'pi-code',
    },
    {
      name: 'Simple Modification',
      credits: 1,
      price: 0.1,
      apiCost: 0.01,
      margin: 90,
      value: 'Variable',
      description: 'Post-generation edits',
      icon: 'pi-pencil',
    },
    {
      name: 'Cloud Architecture',
      credits: 3,
      price: 0.3,
      apiCost: 0.03,
      margin: 90,
      value: '$3,000-10,000',
      description: 'Diagrams + Terraform',
      icon: 'pi-cloud',
    },
    {
      name: 'Technical Documentation',
      credits: 4,
      price: 0.4,
      apiCost: 0.04,
      margin: 90,
      value: '$2,000-5,000',
      description: 'Complete technical docs',
      icon: 'pi-file-edit',
    },
  ];

  // Tableau comparatif
  protected readonly comparisonFeatures: ComparisonFeature[] = [
    {
      name: 'Monthly Credits',
      free: '10 (once)',
      starter: '150',
      professional: '650',
      business: '1,800',
      enterprise: '10,000+',
    },
    {
      name: 'Active Projects',
      free: '1',
      starter: '3',
      professional: '10',
      business: 'Unlimited',
      enterprise: 'Unlimited',
    },
    {
      name: 'Storage',
      free: '500 MB',
      starter: '5 GB',
      professional: '50 GB',
      business: '500 GB',
      enterprise: 'Custom',
    },
    {
      name: 'Deployment',
      free: 'Quick (subdomain)',
      starter: 'Custom domain',
      professional: 'VPS',
      business: 'Cloud (AWS/GCP)',
      enterprise: 'On-premise',
    },
    {
      name: 'Collaboration',
      free: false,
      starter: false,
      professional: '5 users',
      business: 'Unlimited',
      enterprise: 'Unlimited',
    },
    {
      name: 'Support',
      free: 'Community',
      starter: 'Email',
      professional: 'Priority',
      business: 'Dedicated',
      enterprise: '24/7 + CSM',
    },
    {
      name: 'SLA',
      free: false,
      starter: false,
      professional: false,
      business: '99.9%',
      enterprise: '99.95%',
    },
    {
      name: 'White-labeling',
      free: false,
      starter: false,
      professional: false,
      business: 'Partial',
      enterprise: 'Complete',
    },
    {
      name: 'API Access',
      free: false,
      starter: false,
      professional: false,
      business: true,
      enterprise: true,
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  protected setActiveTab(tab: 'subscriptions' | 'credits'): void {
    this.activeTab.set(tab);
  }

  private setupSeo(): void {
    const title = 'Pricing | IDEM - Affordable AI for African Entrepreneurs';
    const description =
      'IDEM pricing: Free plan with 10 credits, Starter at $15/month (150 credits), Professional at $60/month (650 credits). Credit packs from $4. 60-80% cheaper than alternatives.';

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          'IDEM pricing, AI credits, subscription plans, credit packs, affordable AI, African pricing, startup tools, business plan generator pricing',
      },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${this.seoService.domain}/pricing` },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/pricing');
  }
}
