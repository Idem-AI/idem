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
      name: $localize`:@@pricing-page.plans.free.name:Free`,
      price: '$0',
      period: $localize`:@@pricing-page.plans.free.period:forever`,
      credits: $localize`:@@pricing-page.plans.free.credits:10 credits`,
      description: $localize`:@@pricing-page.plans.free.description:Perfect to explore IDEM and create your first project`,
      features: [
        $localize`:@@pricing-page.plans.free.feature1:10 free credits`,
        $localize`:@@pricing-page.plans.free.feature2:All core features`,
        $localize`:@@pricing-page.plans.free.feature3:Community support`,
        $localize`:@@pricing-page.plans.free.feature4:Basic templates`,
        $localize`:@@pricing-page.plans.free.feature5:Export capabilities`,
      ],
      cta: $localize`:@@pricing-page.plans.free.cta:Start Free`,
    },
    {
      name: $localize`:@@pricing-page.plans.starter.name:Starter`,
      price: '$15',
      period: $localize`:@@pricing-page.plans.starter.period:/month`,
      credits: $localize`:@@pricing-page.plans.starter.credits:100 credits/month`,
      description: $localize`:@@pricing-page.plans.starter.description:Ideal for solo entrepreneurs and small projects`,
      features: [
        $localize`:@@pricing-page.plans.starter.feature1:100 credits per month`,
        $localize`:@@pricing-page.plans.starter.feature2:All features included`,
        $localize`:@@pricing-page.plans.starter.feature3:Priority support`,
        $localize`:@@pricing-page.plans.starter.feature4:Advanced templates`,
        $localize`:@@pricing-page.plans.starter.feature5:Custom branding`,
        $localize`:@@pricing-page.plans.starter.feature6:API access`,
      ],
      cta: $localize`:@@pricing-page.plans.starter.cta:Get Started`,
      popular: true,
    },
    {
      name: $localize`:@@pricing-page.plans.pro.name:Pro`,
      price: '$49',
      period: $localize`:@@pricing-page.plans.pro.period:/month`,
      credits: $localize`:@@pricing-page.plans.pro.credits:500 credits/month`,
      description: $localize`:@@pricing-page.plans.pro.description:For growing businesses and agencies`,
      features: [
        $localize`:@@pricing-page.plans.pro.feature1:500 credits per month`,
        $localize`:@@pricing-page.plans.pro.feature2:Everything in Starter`,
        $localize`:@@pricing-page.plans.pro.feature3:Team collaboration`,
        $localize`:@@pricing-page.plans.pro.feature4:White-label options`,
        $localize`:@@pricing-page.plans.pro.feature5:Advanced analytics`,
        $localize`:@@pricing-page.plans.pro.feature6:Dedicated support`,
        $localize`:@@pricing-page.plans.pro.feature7:Custom integrations`,
      ],
      cta: $localize`:@@pricing-page.plans.pro.cta:Go Pro`,
    },
    {
      name: $localize`:@@pricing-page.plans.enterprise.name:Enterprise`,
      price: $localize`:@@pricing-page.plans.enterprise.price:Custom`,
      period: $localize`:@@pricing-page.plans.enterprise.period:pricing`,
      credits: $localize`:@@pricing-page.plans.enterprise.credits:Unlimited`,
      description: $localize`:@@pricing-page.plans.enterprise.description:For large organizations with specific needs`,
      features: [
        $localize`:@@pricing-page.plans.enterprise.feature1:Unlimited credits`,
        $localize`:@@pricing-page.plans.enterprise.feature2:On-premise deployment`,
        $localize`:@@pricing-page.plans.enterprise.feature3:Custom AI training`,
        $localize`:@@pricing-page.plans.enterprise.feature4:SLA guarantee`,
        $localize`:@@pricing-page.plans.enterprise.feature5:Dedicated account manager`,
        $localize`:@@pricing-page.plans.enterprise.feature6:Custom contracts`,
        $localize`:@@pricing-page.plans.enterprise.feature7:Priority feature requests`,
      ],
      cta: $localize`:@@pricing-page.plans.enterprise.cta:Contact Sales`,
    },
  ];

  protected readonly faqs: FAQ[] = [
    {
      question: $localize`:@@pricing-page.faq.q1:What are credits?`,
      answer: $localize`:@@pricing-page.faq.a1:Credits are used to generate content with IDEM. Each action (logo generation, business plan, website, etc.) consumes a certain number of credits based on complexity.`,
    },
    {
      question: $localize`:@@pricing-page.faq.q2:Can I upgrade or downgrade anytime?`,
      answer: $localize`:@@pricing-page.faq.a2:Yes, you can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the next billing cycle.`,
    },
    {
      question: $localize`:@@pricing-page.faq.q3:What payment methods do you accept?`,
      answer: $localize`:@@pricing-page.faq.a3:We accept all major credit cards, PayPal, and mobile money for African users. Enterprise clients can also pay via bank transfer.`,
    },
    {
      question: $localize`:@@pricing-page.faq.q4:Is there a refund policy?`,
      answer: $localize`:@@pricing-page.faq.a4:Yes, we offer a 14-day money-back guarantee for all paid plans. If you are not satisfied, contact us for a full refund.`,
    },
    {
      question: $localize`:@@pricing-page.faq.q5:Do unused credits roll over?`,
      answer: $localize`:@@pricing-page.faq.a5:Unused credits expire at the end of each billing cycle. However, Pro and Enterprise plans can purchase additional credit packs that never expire.`,
    },
    {
      question: $localize`:@@pricing-page.faq.q6:Can I use IDEM for commercial projects?`,
      answer: $localize`:@@pricing-page.faq.a6:Absolutely! All plans, including the free tier, allow commercial use of generated content. You own everything you create.`,
    },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = $localize`:@@pricing-page.seo.title:Pricing Plans | IDEM - Affordable AI for African Entrepreneurs`;
    const description = $localize`:@@pricing-page.seo.description:IDEM pricing starts at $0 with 10 free credits. Starter plan at $15/month, Pro at $49/month. 60-80% cheaper than alternatives. Perfect for African entrepreneurs and businesses.`;

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content: $localize`:@@pricing-page.seo.keywords:IDEM pricing, affordable AI, African pricing, AI platform cost, startup pricing, entrepreneur tools, cheap AI platform, AI credits, monthly subscription, free tier`,
      },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: $localize`:@@pricing-page.seo.type:website` },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${this.seoService.domain}/pricing` },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/pricing');
  }
}
