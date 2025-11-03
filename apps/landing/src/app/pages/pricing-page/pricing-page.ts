import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
  credits: string;
}

interface FAQ {
  question: string;
  answer: string;
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

  protected readonly plans: PricingPlan[] = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      credits: '10 credits',
      description: 'Perfect to explore IDEM and create your first project',
      features: [
        '10 free credits',
        'All core features',
        'Community support',
        'Basic templates',
        'Export capabilities',
      ],
      cta: 'Start Free',
    },
    {
      name: 'Starter',
      price: '$15',
      period: '/month',
      credits: '100 credits/month',
      description: 'Ideal for solo entrepreneurs and small projects',
      features: [
        '100 credits per month',
        'All features included',
        'Priority support',
        'Advanced templates',
        'Custom branding',
        'API access',
      ],
      cta: 'Get Started',
      popular: true,
    },
    {
      name: 'Pro',
      price: '$49',
      period: '/month',
      credits: '500 credits/month',
      description: 'For growing businesses and agencies',
      features: [
        '500 credits per month',
        'Everything in Starter',
        'Team collaboration',
        'White-label options',
        'Advanced analytics',
        'Dedicated support',
        'Custom integrations',
      ],
      cta: 'Go Pro',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      credits: 'Unlimited',
      description: 'For large organizations with specific needs',
      features: [
        'Unlimited credits',
        'On-premise deployment',
        'Custom AI training',
        'SLA guarantee',
        'Dedicated account manager',
        'Custom contracts',
        'Priority feature requests',
      ],
      cta: 'Contact Sales',
    },
  ];

  protected readonly faqs: FAQ[] = [
    {
      question: 'What are credits?',
      answer:
        'Credits are used to generate content with IDEM. Each action (logo generation, business plan, website, etc.) consumes a certain number of credits based on complexity.',
    },
    {
      question: 'Can I upgrade or downgrade anytime?',
      answer:
        'Yes, you can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the next billing cycle.',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept all major credit cards, PayPal, and mobile money for African users. Enterprise clients can also pay via bank transfer.',
    },
    {
      question: 'Is there a refund policy?',
      answer:
        'Yes, we offer a 14-day money-back guarantee for all paid plans. If you are not satisfied, contact us for a full refund.',
    },
    {
      question: 'Do unused credits roll over?',
      answer:
        'Unused credits expire at the end of each billing cycle. However, Pro and Enterprise plans can purchase additional credit packs that never expire.',
    },
    {
      question: 'Can I use IDEM for commercial projects?',
      answer:
        'Absolutely! All plans, including the free tier, allow commercial use of generated content. You own everything you create.',
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = 'Pricing Plans | IDEM - Affordable AI for African Entrepreneurs';
    const description =
      'IDEM pricing starts at $0 with 10 free credits. Starter plan at $15/month, Pro at $49/month. 60-80% cheaper than alternatives. Perfect for African entrepreneurs and businesses.';

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          'IDEM pricing, affordable AI, African pricing, AI platform cost, startup pricing, entrepreneur tools, cheap AI platform, AI credits, monthly subscription, free tier',
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
