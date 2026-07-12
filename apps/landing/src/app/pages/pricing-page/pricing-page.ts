import { Component, ChangeDetectionStrategy, inject, PLATFORM_ID, signal, computed, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../shared/services/seo.service';
import { environment } from '../../../environments/environment';

type PricingEngine = 'business' | 'appgen' | 'ideploy';

interface PlanCard {
  id: string;
  name: string;
  price: string;
  usd: string;
  period: string;
  creditsLabel: string;
  description: string;
  features: string[];
  popular?: boolean;
  cta: string;
  link: string;
}

interface PackCard {
  id: string;
  name: string;
  price: string;
  usd: string;
  creditsLabel: string;
  deliverables: string;
  localAlternative: string;
  popular?: boolean;
}

interface PricedItem {
  name: string;
  price: string;
  note: string;
}

interface CreditRecharge {
  name: string;
  price: string;
  credits: number;
  perCredit: string;
}

interface BundleCard {
  name: string;
  price: string;
  usd: string;
  discount: string;
  composition: string;
  description: string;
}

interface ComparisonRow {
  item: string;
  idem: string;
  alternative: string;
}

@Component({
  selector: 'app-pricing-page',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.css',
})
export class PricingPage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  protected readonly dashboardUrl = environment.services.dashboard.url;
  protected readonly appgenUrl = environment.services.idev.url;
  protected readonly ideployUrl = environment.services.ideploy.url;

  // Active engine tab
  protected readonly activeEngine = signal<PricingEngine>('business');

  private readonly perMonth = $localize`:@@pricing-page.period.month:/month`;
  private readonly ctaStartFree = $localize`:@@pricing-page.cta.startFree:Start Free`;
  private readonly ctaGetStarted = $localize`:@@pricing-page.cta.getStarted:Get Started`;

  // ── A. IDEM Business — company structuring (main dashboard) ──────────────
  protected readonly businessPlans: PlanCard[] = [
    {
      id: 'discovery',
      name: $localize`:@@pricing-page.business.discovery.name:Discovery`,
      price: '0 F',
      usd: '',
      period: $localize`:@@pricing-page.period.forever:/forever`,
      creditsLabel: $localize`:@@pricing-page.business.discovery.credits:5 credits/month (watermarked previews)`,
      description: $localize`:@@pricing-page.business.discovery.description:Explore every deliverable before paying a single franc`,
      features: [
        $localize`:@@pricing-page.business.discovery.f1:Free watermarked preview of every deliverable`,
        $localize`:@@pricing-page.business.discovery.f2:1 active project`,
        $localize`:@@pricing-page.business.discovery.f3:Financial forecasts (read-only)`,
        $localize`:@@pricing-page.business.discovery.f4:Community support`,
      ],
      cta: this.ctaStartFree,
      link: `${environment.services.dashboard.url}/login`,
    },
    {
      id: 'essential',
      name: $localize`:@@pricing-page.business.essential.name:Essential`,
      price: '2 999 F',
      usd: '~$5.2',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.business.essential.credits:150 Business credits/month`,
      description: $localize`:@@pricing-page.business.essential.description:The virtual back office of the active entrepreneur`,
      features: [
        $localize`:@@pricing-page.business.essential.f1:150 credits/month, 2-month rollover`,
        $localize`:@@pricing-page.business.essential.f2:Monthly financial forecast updates`,
        $localize`:@@pricing-page.business.essential.f3:Legal documents: generation + updates`,
        $localize`:@@pricing-page.business.essential.f4:Business cards for 2 team members`,
        $localize`:@@pricing-page.business.essential.f5:Watermark-free exports (Word, PPT, PDF)`,
        $localize`:@@pricing-page.business.essential.f6:Loyalty bonus: up to +30% credits`,
      ],
      popular: true,
      cta: this.ctaGetStarted,
      link: `${environment.services.dashboard.url}/login`,
    },
    {
      id: 'growth',
      name: $localize`:@@pricing-page.business.growth.name:Growth`,
      price: '7 999 F',
      usd: '~$14',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.business.growth.credits:500 Business credits/month`,
      description: $localize`:@@pricing-page.business.growth.description:For structured SMEs managing their business in IDEM`,
      features: [
        $localize`:@@pricing-page.business.growth.f1:500 credits/month (16 F per credit)`,
        $localize`:@@pricing-page.business.growth.f2:3 active projects`,
        $localize`:@@pricing-page.business.growth.f3:Forecast vs actuals tracking + alerts`,
        $localize`:@@pricing-page.business.growth.f4:OHADA legal watch included`,
        $localize`:@@pricing-page.business.growth.f5:Business cards for 10 team members`,
        $localize`:@@pricing-page.business.growth.f6:IDEM Social Starter included`,
      ],
      cta: this.ctaGetStarted,
      link: `${environment.services.dashboard.url}/login`,
    },
    {
      id: 'cabinet',
      name: $localize`:@@pricing-page.business.cabinet.name:Cabinet`,
      price: '19 999 F',
      usd: '~$35',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.business.cabinet.credits:1,500 Business credits/month`,
      description: $localize`:@@pricing-page.business.cabinet.description:For agencies, consultants and accountants serving clients`,
      features: [
        $localize`:@@pricing-page.business.cabinet.f1:1,500 credits/month (13.3 F per credit)`,
        $localize`:@@pricing-page.business.cabinet.f2:10 active projects (multi-client)`,
        $localize`:@@pricing-page.business.cabinet.f3:Multi-project financial tracking`,
        $localize`:@@pricing-page.business.cabinet.f4:Custom legal library`,
        $localize`:@@pricing-page.business.cabinet.f5:White-label deliverables (your logo)`,
        $localize`:@@pricing-page.business.cabinet.f6:IDEM Social Pro included`,
      ],
      cta: $localize`:@@pricing-page.cta.goCabinet:Scale Up`,
      link: `${environment.services.dashboard.url}/login`,
    },
  ];

  protected readonly businessPacks: PackCard[] = [
    {
      id: 'identity',
      name: $localize`:@@pricing-page.packs.identity.name:Identity Pack`,
      price: '1 999 F',
      usd: '~$3.5',
      creditsLabel: $localize`:@@pricing-page.packs.identity.credits:80 credits included`,
      deliverables: $localize`:@@pricing-page.packs.identity.deliverables:HD logo + brand guidelines + customizable business cards`,
      localAlternative: $localize`:@@pricing-page.packs.identity.alt:50,000 – 95,000 F at a local designer`,
    },
    {
      id: 'strategy',
      name: $localize`:@@pricing-page.packs.strategy.name:Strategy Pack`,
      price: '2 999 F',
      usd: '~$5.2',
      creditsLabel: $localize`:@@pricing-page.packs.strategy.credits:155 credits included`,
      deliverables: $localize`:@@pricing-page.packs.strategy.deliverables:Business plan + pitch deck + 3-year financial forecasts`,
      localAlternative: $localize`:@@pricing-page.packs.strategy.alt:225,000 – 700,000 F at a consultant`,
    },
    {
      id: 'compliance',
      name: $localize`:@@pricing-page.packs.compliance.name:Compliance Pack`,
      price: '2 499 F',
      usd: '~$4.3',
      creditsLabel: $localize`:@@pricing-page.packs.compliance.credits:120 credits included`,
      deliverables: $localize`:@@pricing-page.packs.compliance.deliverables:OHADA legal kit (articles, shareholder agreement, T&Cs) + procedures manual`,
      localAlternative: $localize`:@@pricing-page.packs.compliance.alt:300,000 F+ at a law firm`,
    },
    {
      id: 'complete',
      name: $localize`:@@pricing-page.packs.complete.name:Full Business Pack`,
      price: '4 999 F',
      usd: '~$8.7',
      creditsLabel: $localize`:@@pricing-page.packs.complete.credits:265 credits — 33% off vs separate packs`,
      deliverables: $localize`:@@pricing-page.packs.complete.deliverables:Identity + Strategy + Compliance, everything to launch credible`,
      localAlternative: $localize`:@@pricing-page.packs.complete.alt:500,000 – 1,000,000 F with local providers`,
      popular: true,
    },
  ];

  protected readonly socialAddons: PlanCard[] = [
    {
      id: 'social-starter',
      name: $localize`:@@pricing-page.social.starter.name:IDEM Social Starter`,
      price: '1 999 F',
      usd: '~$3.5',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.social.starter.credits:2 connected networks`,
      description: $localize`:@@pricing-page.social.starter.description:Publish your editorial calendar automatically`,
      features: [
        $localize`:@@pricing-page.social.starter.f1:30 scheduled posts/month`,
        $localize`:@@pricing-page.social.starter.f2:Auto-publishing of your editorial calendar`,
        $localize`:@@pricing-page.social.starter.f3:Basic engagement statistics`,
      ],
      cta: this.ctaGetStarted,
      link: `${environment.services.dashboard.url}/login`,
    },
    {
      id: 'social-pro',
      name: $localize`:@@pricing-page.social.pro.name:IDEM Social Pro`,
      price: '4 999 F',
      usd: '~$8.7',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.social.pro.credits:6 networks: Facebook, Instagram, TikTok, LinkedIn, X, WhatsApp Business`,
      description: $localize`:@@pricing-page.social.pro.description:What Hootsuite sells for 57,000 F/month`,
      features: [
        $localize`:@@pricing-page.social.pro.f1:Unlimited scheduled posts`,
        $localize`:@@pricing-page.social.pro.f2:AI picks the best publishing time`,
        $localize`:@@pricing-page.social.pro.f3:Full statistics + monthly report`,
        $localize`:@@pricing-page.social.pro.f4:Included in Business Cabinet`,
      ],
      popular: true,
      cta: this.ctaGetStarted,
      link: `${environment.services.dashboard.url}/login`,
    },
  ];

  // ── B. IDEM AppGen — application generation ───────────────────────────────
  protected readonly projectPassFeatures: string[] = [
    $localize`:@@pricing-page.appgen.pass.f1:Initial generation is 100% free — watch your app run in the browser`,
    $localize`:@@pricing-page.appgen.pass.f2:AI modifications unlocked (30 credits included)`,
    $localize`:@@pricing-page.appgen.pass.f3:Unlimited code download (ZIP)`,
    $localize`:@@pricing-page.appgen.pass.f4:Unlimited GitHub push`,
    $localize`:@@pricing-page.appgen.pass.f5:Deployment on iDeploy unlocked`,
    $localize`:@@pricing-page.appgen.pass.f6:Private project + removable badge`,
  ];

  protected readonly appgenPlans: PlanCard[] = [
    {
      id: 'appgen-discovery',
      name: $localize`:@@pricing-page.appgen.discovery.name:Discovery`,
      price: '0 F',
      usd: '',
      period: $localize`:@@pricing-page.period.forever:/forever`,
      creditsLabel: $localize`:@@pricing-page.appgen.discovery.credits:3 free generations/day`,
      description: $localize`:@@pricing-page.appgen.discovery.description:Generate complete apps and watch them run, free`,
      features: [
        $localize`:@@pricing-page.appgen.discovery.f1:3 complete generations per day`,
        $localize`:@@pricing-page.appgen.discovery.f2:Unlimited browser preview`,
        $localize`:@@pricing-page.appgen.discovery.f3:Project Pass at 999 F per project`,
        $localize`:@@pricing-page.appgen.discovery.f4:Community support`,
      ],
      cta: this.ctaStartFree,
      link: `${environment.services.idev.url}`,
    },
    {
      id: 'appgen-starter',
      name: $localize`:@@pricing-page.appgen.starter.name:Starter`,
      price: '2 999 F',
      usd: '~$5.2',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.appgen.starter.credits:150 credits/month`,
      description: $localize`:@@pricing-page.appgen.starter.description:7× cheaper per credit than Lovable Pro`,
      features: [
        $localize`:@@pricing-page.appgen.starter.f1:Unlimited initial generations`,
        $localize`:@@pricing-page.appgen.starter.f2:Project Pass included on all projects`,
        $localize`:@@pricing-page.appgen.starter.f3:150 credits/month, 2-month rollover`,
        $localize`:@@pricing-page.appgen.starter.f4:Import existing projects`,
        $localize`:@@pricing-page.appgen.starter.f5:Standard support`,
      ],
      popular: true,
      cta: this.ctaGetStarted,
      link: `${environment.services.idev.url}`,
    },
    {
      id: 'appgen-pro',
      name: $localize`:@@pricing-page.appgen.pro.name:Pro`,
      price: '9 999 F',
      usd: '~$17',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.appgen.pro.credits:550 credits/month`,
      description: $localize`:@@pricing-page.appgen.pro.description:For builders shipping every week`,
      features: [
        $localize`:@@pricing-page.appgen.pro.f1:Everything in Starter`,
        $localize`:@@pricing-page.appgen.pro.f2:550 credits/month`,
        $localize`:@@pricing-page.appgen.pro.f3:Premium AI models (complex actions)`,
        $localize`:@@pricing-page.appgen.pro.f4:Priority support`,
      ],
      cta: $localize`:@@pricing-page.cta.goPro:Go Pro`,
      link: `${environment.services.idev.url}`,
    },
    {
      id: 'appgen-studio',
      name: $localize`:@@pricing-page.appgen.studio.name:Studio`,
      price: '24 999 F',
      usd: '~$43',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.appgen.studio.credits:1,500 credits/month`,
      description: $localize`:@@pricing-page.appgen.studio.description:For agencies building for their clients`,
      features: [
        $localize`:@@pricing-page.appgen.studio.f1:Everything in Pro`,
        $localize`:@@pricing-page.appgen.studio.f2:1,500 credits/month`,
        $localize`:@@pricing-page.appgen.studio.f3:5 seats`,
        $localize`:@@pricing-page.appgen.studio.f4:API access`,
        $localize`:@@pricing-page.appgen.studio.f5:White-label for agencies`,
        $localize`:@@pricing-page.appgen.studio.f6:Dedicated support`,
      ],
      cta: $localize`:@@pricing-page.cta.scaleUp:Scale Up`,
      link: `${environment.services.idev.url}`,
    },
  ];

  protected readonly appgenPasses: PricedItem[] = [
    {
      name: $localize`:@@pricing-page.appgen.pass24.name:24h Pass`,
      price: '500 F',
      note: $localize`:@@pricing-page.appgen.pass24.note:25 credits — "I'm testing my idea tonight"`,
    },
    {
      name: $localize`:@@pricing-page.appgen.pass7d.name:7-day Pass`,
      price: '1 499 F',
      note: $localize`:@@pricing-page.appgen.pass7d.note:90 credits — "I'm prepping Friday's demo"`,
    },
  ];

  // ── C. iDeploy — deployment & hosting ─────────────────────────────────────
  protected readonly ideployPlans: PlanCard[] = [
    {
      id: 'hobby',
      name: $localize`:@@pricing-page.ideploy.hobby.name:Hobby`,
      price: '0 F',
      usd: '',
      period: $localize`:@@pricing-page.period.forever:/forever`,
      creditsLabel: $localize`:@@pricing-page.ideploy.hobby.credits:Commercial use allowed`,
      description: $localize`:@@pricing-page.ideploy.hobby.description:Put your first app in production for free`,
      features: [
        $localize`:@@pricing-page.ideploy.hobby.f1:2 apps (sleep after 30 min idle), 512 MB each`,
        $localize`:@@pricing-page.ideploy.hobby.f2:5 free deployments, then 100 F each`,
        $localize`:@@pricing-page.ideploy.hobby.f3:Free yourapp.idem.africa domain`,
        $localize`:@@pricing-page.ideploy.hobby.f4:1 free custom domain + auto SSL`,
        $localize`:@@pricing-page.ideploy.hobby.f5:50 GB traffic/month`,
        $localize`:@@pricing-page.ideploy.hobby.f6:1 dev database (1 GB)`,
      ],
      cta: this.ctaStartFree,
      link: `${environment.services.ideploy.url}`,
    },
    {
      id: 'deploy-starter',
      name: $localize`:@@pricing-page.ideploy.starter.name:Deploy Starter`,
      price: '2 999 F',
      usd: '~$5.2',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.ideploy.starter.credits:3 always-on apps`,
      description: $localize`:@@pricing-page.ideploy.starter.description:Your apps stay awake, your data stays safe`,
      features: [
        $localize`:@@pricing-page.ideploy.starter.f1:3 always-active apps (512 MB each)`,
        $localize`:@@pricing-page.ideploy.starter.f2:Unlimited deployments`,
        $localize`:@@pricing-page.ideploy.starter.f3:100 GB traffic/month`,
        $localize`:@@pricing-page.ideploy.starter.f4:3 free custom domains + SSL`,
        $localize`:@@pricing-page.ideploy.starter.f5:1 persistent database (2 GB) + weekly backups`,
        $localize`:@@pricing-page.ideploy.starter.f6:2 BYOS servers (bring your own server)`,
      ],
      popular: true,
      cta: this.ctaGetStarted,
      link: `${environment.services.ideploy.url}`,
    },
    {
      id: 'deploy-pro',
      name: $localize`:@@pricing-page.ideploy.pro.name:Deploy Pro`,
      price: '9 999 F',
      usd: '~$17',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.ideploy.pro.credits:10 apps — 8 GB RAM pool`,
      description: $localize`:@@pricing-page.ideploy.pro.description:For products in real growth`,
      features: [
        $localize`:@@pricing-page.ideploy.pro.f1:10 apps, 8 GB shared RAM pool`,
        $localize`:@@pricing-page.ideploy.pro.f2:500 GB traffic/month`,
        $localize`:@@pricing-page.ideploy.pro.f3:5 databases (10 GB) + daily backups`,
        $localize`:@@pricing-page.ideploy.pro.f4:Full monitoring + alerts, 30-day logs`,
        $localize`:@@pricing-page.ideploy.pro.f5:10 custom domains, advanced firewall`,
        $localize`:@@pricing-page.ideploy.pro.f6:3 team members, 5 BYOS servers`,
      ],
      cta: $localize`:@@pricing-page.cta.goPro:Go Pro`,
      link: `${environment.services.ideploy.url}`,
    },
    {
      id: 'deploy-scale',
      name: $localize`:@@pricing-page.ideploy.scale.name:Deploy Scale`,
      price: '24 999 F',
      usd: '~$43',
      period: this.perMonth,
      creditsLabel: $localize`:@@pricing-page.ideploy.scale.credits:25 apps — 24 GB RAM pool`,
      description: $localize`:@@pricing-page.ideploy.scale.description:High availability for serious workloads`,
      features: [
        $localize`:@@pricing-page.ideploy.scale.f1:25 apps, 24 GB RAM pool, 2 TB traffic`,
        $localize`:@@pricing-page.ideploy.scale.f2:High availability + autoscaling included`,
        $localize`:@@pricing-page.ideploy.scale.f3:Unlimited databases (50 GB) + external S3 backups`,
        $localize`:@@pricing-page.ideploy.scale.f4:99.9% SLA`,
        $localize`:@@pricing-page.ideploy.scale.f5:Wildcard domains, custom firewall rules`,
        $localize`:@@pricing-page.ideploy.scale.f6:10 team members, unlimited BYOS servers`,
      ],
      cta: $localize`:@@pricing-page.cta.scaleUp:Scale Up`,
      link: `${environment.services.ideploy.url}`,
    },
  ];

  protected readonly managedServices: PricedItem[] = [
    {
      name: $localize`:@@pricing-page.ideploy.svc.waf:Advanced firewall / managed WAF`,
      price: '1 499 F',
      note: $localize`:@@pricing-page.ideploy.svc.waf.note:Custom rules, geo-blocking`,
    },
    {
      name: $localize`:@@pricing-page.ideploy.svc.autoscaling:Autoscaling`,
      price: '1 999 F',
      note: $localize`:@@pricing-page.ideploy.svc.autoscaling.note:Automatic scale-up (Docker Swarm)`,
    },
    {
      name: $localize`:@@pricing-page.ideploy.svc.backups:Daily backups + 1-click restore`,
      price: '999 F',
      note: $localize`:@@pricing-page.ideploy.svc.backups.note:Sleep well at night`,
    },
    {
      name: $localize`:@@pricing-page.ideploy.svc.monitoring:Advanced monitoring + alerts`,
      price: '999 F',
      note: $localize`:@@pricing-page.ideploy.svc.monitoring.note:CPU/RAM/disk, e-mail & WhatsApp`,
    },
    {
      name: $localize`:@@pricing-page.ideploy.svc.db:Extra managed database`,
      price: '999 F',
      note: $localize`:@@pricing-page.ideploy.svc.db.note:2 GB, backups included`,
    },
    {
      name: $localize`:@@pricing-page.ideploy.svc.logs:Extended log retention`,
      price: '499 F',
      note: $localize`:@@pricing-page.ideploy.svc.logs.note:90 days of logs`,
    },
    {
      name: $localize`:@@pricing-page.ideploy.svc.ip:Dedicated static IP`,
      price: '1 999 F',
      note: $localize`:@@pricing-page.ideploy.svc.ip.note:Vercel sells this at 57,500 F`,
    },
    {
      name: $localize`:@@pricing-page.ideploy.svc.sovereign:Sovereign local hosting`,
      price: '1 999 F',
      note: $localize`:@@pricing-page.ideploy.svc.sovereign.note:Data center in your country (roadmap)`,
    },
  ];

  // ── Credit recharges (Business & AppGen, separate meters, same price) ────
  protected readonly creditRecharges: CreditRecharge[] = [
    {
      name: $localize`:@@pricing-page.recharge.boost:Boost`,
      price: '500 F',
      credits: 25,
      perCredit: '20 F',
    },
    {
      name: $localize`:@@pricing-page.recharge.standard:Standard`,
      price: '999 F',
      credits: 55,
      perCredit: '18 F',
    },
    {
      name: $localize`:@@pricing-page.recharge.growth:Growth`,
      price: '2 499 F',
      credits: 145,
      perCredit: '17 F',
    },
    {
      name: $localize`:@@pricing-page.recharge.power:Power`,
      price: '4 999 F',
      credits: 320,
      perCredit: '15.6 F',
    },
  ];

  // ── Business credit price list (what one deliverable costs) ──────────────
  protected readonly creditCosts: PricedItem[] = [
    {
      name: $localize`:@@pricing-page.credits.revision:Revision / iteration`,
      price: '1',
      note: '~20 F',
    },
    {
      name: $localize`:@@pricing-page.credits.flyer:Flyer / social post visual`,
      price: '2',
      note: '~40 F',
    },
    {
      name: $localize`:@@pricing-page.credits.card:Custom business card`,
      price: '10',
      note: '~200 F',
    },
    {
      name: $localize`:@@pricing-page.credits.calendar:Monthly editorial calendar (30 posts)`,
      price: '15',
      note: '~300 F',
    },
    {
      name: $localize`:@@pricing-page.credits.pitchdeck:Investor pitch deck`,
      price: '35',
      note: '~700 F',
    },
    {
      name: $localize`:@@pricing-page.credits.forecast:3-year financial forecasts`,
      price: '40',
      note: '~800 F',
    },
    {
      name: $localize`:@@pricing-page.credits.logo:HD logo + full brand guidelines`,
      price: '60',
      note: '~1 200 F',
    },
    {
      name: $localize`:@@pricing-page.credits.bp:Complete business plan`,
      price: '70',
      note: '~1 400 F',
    },
  ];

  // ── Loyalty bundles ───────────────────────────────────────────────────────
  protected readonly bundles: BundleCard[] = [
    {
      name: $localize`:@@pricing-page.bundles.launch.name:Launch Pack`,
      price: '7 499 F',
      usd: '~$13',
      discount: '-17%',
      composition: $localize`:@@pricing-page.bundles.launch.composition:Business Essential + AppGen Starter + Deploy Starter`,
      description: $localize`:@@pricing-page.bundles.launch.description:Structure, build and host your business in one subscription`,
    },
    {
      name: $localize`:@@pricing-page.bundles.complete.name:IDEM Complete`,
      price: '29 999 F',
      usd: '~$52',
      discount: '-21%',
      composition: $localize`:@@pricing-page.bundles.complete.composition:Business Growth + AppGen Pro + Deploy Pro + Advisory Premium`,
      description: $localize`:@@pricing-page.bundles.complete.description:Documents, code, hosting and a human advisor — everything in one place`,
    },
  ];

  // ── Frontal comparison ────────────────────────────────────────────────────
  protected readonly comparisonRows: ComparisonRow[] = [
    {
      item: $localize`:@@pricing-page.compare.bp:Complete business plan`,
      idem: $localize`:@@pricing-page.compare.bp.idem:~1 400 F (70 credits)`,
      alternative: $localize`:@@pricing-page.compare.bp.alt:225,000 – 700,000 F (local consultant)`,
    },
    {
      item: $localize`:@@pricing-page.compare.logo:Logo + brand identity`,
      idem: $localize`:@@pricing-page.compare.logo.idem:1 999 F (Identity Pack)`,
      alternative: $localize`:@@pricing-page.compare.logo.alt:50,000 – 95,000 F (designer)`,
    },
    {
      item: $localize`:@@pricing-page.compare.appgen:AI app builder`,
      idem: $localize`:@@pricing-page.compare.appgen.idem:2 999 F/month — 150 credits`,
      alternative: $localize`:@@pricing-page.compare.appgen.alt:Lovable Pro: 14,375 F ($25) — 100 credits`,
    },
    {
      item: $localize`:@@pricing-page.compare.bandwidth:Hosting bandwidth overage`,
      idem: $localize`:@@pricing-page.compare.bandwidth.idem:25 F/GB`,
      alternative: $localize`:@@pricing-page.compare.bandwidth.alt:Vercel: 86 F/GB ($0.15)`,
    },
    {
      item: $localize`:@@pricing-page.compare.social:Social media scheduling`,
      idem: $localize`:@@pricing-page.compare.social.idem:4 999 F/month (Social Pro)`,
      alternative: $localize`:@@pricing-page.compare.social.alt:Hootsuite: ~57,000 F/month`,
    },
  ];

  protected readonly currentPlans = computed<PlanCard[]>(() => {
    switch (this.activeEngine()) {
      case 'appgen':
        return this.appgenPlans;
      case 'ideploy':
        return this.ideployPlans;
      default:
        return this.businessPlans;
    }
  });

  ngOnInit(): void {
    this.setupSeo();
  }

  protected setEngine(engine: PricingEngine): void {
    this.activeEngine.set(engine);
  }

  private setupSeo(): void {
    const title = 'Pricing | IDEM - FCFA Pricing Made for African Entrepreneurs';
    const description =
      'IDEM pricing in FCFA: Business packs from 1,999 F, AppGen from 2,999 F/month, iDeploy hosting free tier with commercial use. Pay with Mobile Money. Up to 99% cheaper than local alternatives.';

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          'IDEM pricing, FCFA pricing, Mobile Money, AI credits, business plan generator price, app builder Africa, hosting Africa, iDeploy, AppGen',
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
