import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../shared/services/auth.service';
import { environment } from '../../../../environments/environment';

interface Plan {
  name: string;
  price: string;
  usd: string;
  tagline: string;
  features: string[];
  popular?: boolean;
  cta: string;
}

interface ManagedService {
  name: string;
  price: string;
  note: string;
}

interface OverageRow {
  resource: string;
  ideploy: string;
  vercel: string;
  railway: string;
}

/**
 * Public iDeploy pricing page — same visual language as the landing
 * (glass-card, inner/outer-button, i-underline from @idem/shared-styles).
 * Prices follow the IDEM economic model: generous free entry, FCFA plans,
 * pay-per-deployment, managed services à la carte and transparent overages.
 */
@Component({
  selector: 'app-pricing',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative min-h-screen text-white overflow-hidden" style="font-family: 'Jura', sans-serif;">
      <!-- Global glassmorphism accents -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div class="absolute w-[1000px] h-[800px] rounded-full blur-[120px] opacity-20"
             style="top:-30%;left:-10%;background: radial-gradient(circle, var(--color-primary-500) 0%, transparent 70%);"></div>
        <div class="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-15"
             style="bottom:-20%;right:-10%;background: radial-gradient(circle, var(--color-accent-500) 0%, transparent 70%);"></div>
      </div>

      <div class="relative z-10">
        <!-- ===== NAVBAR ===== -->
        <nav class="fixed top-0 left-0 right-0 z-50 px-6 py-5 border-b border-white/5"
             style="background: rgba(6,8,13,0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);">
          <div class="max-w-7xl mx-auto flex items-center justify-between">
            <a routerLink="/" class="flex items-center gap-3">
              <img src="/ideploy-logo.png" [alt]="'pricing.logoAlt' | translate" class="w-[150px] h-auto object-cover"
                   style="filter: drop-shadow(0 0 15px var(--color-primary-500));" />
            </a>
            <div class="hidden md:flex items-center gap-8">
              <a routerLink="/" fragment="showcase" class="text-sm font-semibold text-white/70 hover:text-white transition-colors">{{ 'pricing.navShowcase' | translate }}</a>
              <a routerLink="/" fragment="features" class="text-sm font-semibold text-white/70 hover:text-white transition-colors">{{ 'pricing.navPlatform' | translate }}</a>
              <a routerLink="/pricing" class="text-sm font-semibold text-white transition-colors">{{ 'pricing.navPricing' | translate }}</a>
            </div>
            @if (user(); as u) {
              <a routerLink="/dashboard" class="inner-button text-sm px-5 py-2.5">{{ 'pricing.navDashboard' | translate }}</a>
            } @else {
              <div class="flex items-center gap-4">
                <a [href]="loginUrl" class="hidden sm:block text-sm font-semibold text-white/70 hover:text-white">{{ 'pricing.login' | translate }}</a>
                <a [href]="loginUrl" class="inner-button text-sm px-5 py-2.5">{{ 'pricing.getStarted' | translate }}</a>
              </div>
            }
          </div>
        </nav>

        <!-- ===== HERO ===== -->
        <section class="pt-44 pb-16 px-6 text-center">
          <div class="max-w-4xl mx-auto">
            <h1 class="font-black text-white mb-6" style="font-size: clamp(2.8rem, 6vw, 5rem); line-height:1.05; letter-spacing:-0.04em;">
              {{ 'pricing.heroTitle' | translate }}<br /><span class="i-underline">{{ 'pricing.heroTitleAccent' | translate }}</span>
            </h1>
            <p class="text-xl text-white/60 max-w-2xl mx-auto font-medium leading-relaxed mb-6">
              {{ 'pricing.heroSubtitle' | translate }}
            </p>
            <p class="text-sm text-white/40 font-mono">{{ 'pricing.heroNote' | translate }}</p>
          </div>
        </section>

        <!-- ===== PLANS ===== -->
        <section class="py-16 px-6">
          <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            @for (plan of plans; track plan.name) {
              <div class="glass-card p-8 rounded-[2rem] border relative flex flex-col"
                   [class]="plan.popular ? 'border-2' : 'border-white/10'"
                   [style.border-color]="plan.popular ? 'var(--color-primary-500)' : null">
                @if (plan.popular) {
                  <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                       style="background: var(--color-primary-500)">{{ 'pricing.mostPopular' | translate }}</div>
                }
                <h3 class="text-xl font-black text-white mb-2">{{ plan.name }}</h3>
                <div class="mb-2">
                  <span class="text-4xl font-black text-white">{{ plan.price }}</span>
                  <span class="text-white/50 text-sm font-medium">{{ 'pricing.perMonth' | translate }}</span>
                </div>
                @if (plan.usd) {
                  <div class="text-xs text-white/40 font-mono mb-3">{{ plan.usd }}</div>
                }
                <p class="text-sm text-white/60 font-medium mb-6">{{ plan.tagline }}</p>
                <ul class="space-y-3 mb-8 grow">
                  @for (feature of plan.features; track feature) {
                    <li class="flex items-start gap-3 text-sm text-white/80 font-medium">
                      <div class="w-2 h-2 mt-1.5 rounded-full shrink-0" style="background: var(--color-primary-500)"></div>
                      <span>{{ feature }}</span>
                    </li>
                  }
                </ul>
                <a [href]="loginUrl" [class]="plan.popular ? 'inner-button w-full py-3 text-center text-sm' : 'outer-button w-full py-3 text-center text-sm'">
                  {{ plan.cta }}
                </a>
              </div>
            }
          </div>
        </section>

        <!-- ===== PAY PER DEPLOYMENT ===== -->
        <section class="py-16 px-6">
          <div class="max-w-5xl mx-auto glass-card rounded-[2rem] border border-white/10 p-10 md:p-14 text-center">
            <h2 class="text-3xl md:text-4xl font-black text-white mb-4" style="letter-spacing:-0.03em;">
              {{ 'pricing.payTitle' | translate }} <span class="i-underline">{{ 'pricing.payTitleAccent' | translate }}</span>
            </h2>
            <p class="text-white/60 font-medium max-w-2xl mx-auto mb-10">
              {{ 'pricing.paySubtitle' | translate }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div class="glass-card rounded-2xl border border-white/10 p-6">
                <div class="text-3xl font-black text-white mb-1">100 F</div>
                <div class="text-sm text-white/50 font-medium">{{ 'pricing.payCard1Label' | translate }}</div>
              </div>
              <div class="glass-card rounded-2xl border border-white/10 p-6">
                <div class="text-3xl font-black text-white mb-1">900 F</div>
                <div class="text-sm text-white/50 font-medium">{{ 'pricing.payCard2Label' | translate }}</div>
              </div>
              <div class="glass-card rounded-2xl border border-white/10 p-6">
                <div class="text-3xl font-black text-white mb-1">{{ 'pricing.payCard3Value' | translate }}</div>
                <div class="text-sm text-white/50 font-medium">{{ 'pricing.payCard3Label' | translate }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== MANAGED SERVICES ===== -->
        <section class="py-16 px-6">
          <div class="max-w-7xl mx-auto">
            <h2 class="text-3xl md:text-4xl font-black text-white text-center mb-4" style="letter-spacing:-0.03em;">
              {{ 'pricing.managedTitle' | translate }} <span class="i-underline">{{ 'pricing.managedTitleAccent' | translate }}</span>
            </h2>
            <p class="text-white/60 font-medium text-center max-w-2xl mx-auto mb-12">
              {{ 'pricing.managedSubtitle' | translate }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              @for (svc of managedServices; track svc.name) {
                <div class="glass-card p-6 rounded-2xl border border-white/10 hover:-translate-y-1 transition-transform">
                  <div class="text-2xl font-black mb-2" style="color: var(--color-primary-500)">
                    {{ svc.price }}<span class="text-xs text-white/40 font-medium">{{ 'pricing.perMonth' | translate }}</span>
                  </div>
                  <div class="text-sm font-bold text-white mb-1">{{ svc.name }}</div>
                  <div class="text-xs text-white/50 font-medium">{{ svc.note }}</div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- ===== OVERAGES ===== -->
        <section class="py-16 px-6">
          <div class="max-w-5xl mx-auto">
            <h2 class="text-3xl md:text-4xl font-black text-white text-center mb-4" style="letter-spacing:-0.03em;">
              {{ 'pricing.overagesTitle' | translate }} <span class="i-underline">{{ 'pricing.overagesTitleAccent' | translate }}</span>
            </h2>
            <p class="text-white/60 font-medium text-center max-w-2xl mx-auto mb-12">
              {{ 'pricing.overagesSubtitle' | translate }}
            </p>
            <div class="glass-card rounded-[2rem] border border-white/10 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-white/5">
                    <tr>
                      <th class="text-left p-5 font-bold text-white">{{ 'pricing.colResource' | translate }}</th>
                      <th class="text-center p-5 font-bold" style="color: var(--color-primary-500)">iDeploy</th>
                      <th class="text-center p-5 font-bold text-white/70">Vercel</th>
                      <th class="text-center p-5 font-bold text-white/70">Railway</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/10">
                    @for (row of overages; track row.resource) {
                      <tr>
                        <td class="p-5 text-white/80 font-medium">{{ row.resource }}</td>
                        <td class="p-5 text-center font-bold" style="color: var(--color-primary-500)">{{ row.ideploy }}</td>
                        <td class="p-5 text-center text-white/50">{{ row.vercel }}</td>
                        <td class="p-5 text-center text-white/50">{{ row.railway }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== BYOS ===== -->
        <section class="py-16 px-6">
          <div class="max-w-5xl mx-auto glass-card rounded-[2rem] border border-white/10 p-10 md:p-14 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 class="text-3xl md:text-4xl font-black text-white mb-4" style="letter-spacing:-0.03em;">
                {{ 'pricing.byosTitle' | translate }} <span class="i-underline">{{ 'pricing.byosTitleAccent' | translate }}</span>
              </h2>
              <p class="text-white/60 font-medium leading-relaxed">
                {{ 'pricing.byosBody' | translate }}
              </p>
            </div>
            <div class="flex flex-col gap-4">
              <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5">
                <div class="w-3 h-3 rounded-full" style="background: var(--color-accent-500)"></div>
                <span class="font-bold text-white/80">{{ 'pricing.byosFeature1' | translate }}</span>
              </div>
              <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5">
                <div class="w-3 h-3 rounded-full" style="background: var(--color-accent-500)"></div>
                <span class="font-bold text-white/80">{{ 'pricing.byosFeature2' | translate }}</span>
              </div>
              <div class="glass-card flex items-center gap-4 p-4 rounded-xl border border-white/5">
                <div class="w-3 h-3 rounded-full" style="background: var(--color-accent-500)"></div>
                <span class="font-bold text-white/80">{{ 'pricing.byosFeature3' | translate }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== CTA ===== -->
        <section class="py-24 px-6">
          <div class="max-w-4xl mx-auto rounded-[3rem] overflow-hidden relative">
            <div class="absolute inset-0 z-0" style="background: linear-gradient(to bottom right, rgba(37,99,235,0.2), black, rgba(34,211,238,0.2));"></div>
            <div class="glass-card relative z-10 p-16 md:p-20 border border-white/10 text-center" style="backdrop-filter: blur(48px);">
              <h2 class="text-4xl md:text-5xl font-black text-white mb-6" style="letter-spacing:-0.04em;">
                {{ 'pricing.ctaTitle' | translate }} <span class="i-underline">{{ 'pricing.ctaTitleAccent' | translate }}</span>
              </h2>
              <p class="text-xl text-white/70 mb-10 max-w-xl mx-auto font-medium">
                {{ 'pricing.ctaSubtitle' | translate }}
              </p>
              <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a [href]="loginUrl" class="inner-button px-8 py-4 text-lg w-full sm:w-auto">{{ 'pricing.getStartedFree' | translate }}</a>
                <a routerLink="/" class="outer-button px-8 py-4 text-lg w-full sm:w-auto">{{ 'pricing.backToHome' | translate }}</a>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== FOOTER ===== -->
        <footer class="py-12 px-6 border-t border-white/10 bg-transparent">
          <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: var(--color-primary-500)">
                <i class="fa-solid fa-rocket text-xs text-white"></i>
              </div>
              <span class="text-base font-black text-white tracking-tight">EPLOY</span>
            </div>
            <p class="text-sm text-white/50 font-medium">{{ 'pricing.footerCopyright' | translate: { year: year } }}</p>
            <div class="flex items-center gap-8">
              <a routerLink="/pricing" class="text-sm font-bold text-white/50 hover:text-white transition-colors">{{ 'pricing.navPricing' | translate }}</a>
              <a [href]="loginUrl" class="text-sm font-bold text-white/50 hover:text-white transition-colors">{{ 'pricing.signIn' | translate }}</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  `,
})
export class PricingComponent implements OnInit {
  private auth = inject(AuthService);

  protected readonly user = toSignal(this.auth.user$, { initialValue: null });
  protected readonly year = new Date().getFullYear();
  protected readonly loginUrl = `${environment.services.console.url}/login?redirect=ideploy`;

  protected readonly plans: Plan[] = [
    {
      name: 'Hobby',
      price: '0 F',
      usd: 'free forever',
      tagline: 'Put your first app in production for free — commercial use allowed.',
      features: [
        '2 apps (sleep after 30 min idle), 512 MB each',
        '5 free deployments, then 100 F each',
        '50 GB outbound traffic/month',
        'Free yourapp.idem.africa domain',
        '1 free custom domain + auto SSL',
        '1 dev database (1 GB)',
        'Basic monitoring, 1 h log retention',
        '1 BYOS server',
      ],
      cta: 'Start for free',
    },
    {
      name: 'Deploy Starter',
      price: '2 999 F',
      usd: '~$5.2/month',
      tagline: 'Your apps stay awake, your data stays safe.',
      features: [
        '3 always-active apps (512 MB each)',
        'Unlimited deployments',
        '100 GB outbound traffic/month',
        '3 free custom domains + SSL',
        '1 persistent database (2 GB)',
        'Weekly automatic backups',
        'Standard monitoring, 7-day logs',
        '2 BYOS servers',
      ],
      popular: true,
      cta: 'Get started',
    },
    {
      name: 'Deploy Pro',
      price: '9 999 F',
      usd: '~$17/month',
      tagline: 'For products in real growth.',
      features: [
        '10 apps, 8 GB shared RAM pool',
        '500 GB outbound traffic/month',
        '5 databases (10 GB total)',
        'Daily automatic backups',
        'Full monitoring + alerts, 30-day logs',
        '10 custom domains, advanced firewall',
        '3 team members, 5 BYOS servers',
        'HA + autoscaling available as add-on',
      ],
      cta: 'Go Pro',
    },
    {
      name: 'Deploy Scale',
      price: '24 999 F',
      usd: '~$43/month',
      tagline: 'High availability for serious workloads.',
      features: [
        '25 apps, 24 GB RAM pool',
        '2 TB outbound traffic/month',
        'Unlimited databases (50 GB total)',
        'Daily backups + external S3',
        'High availability (Docker Swarm) + autoscaling included',
        '99.9% SLA, 90-day logs',
        'Wildcard domains, custom firewall rules',
        '10 team members, unlimited BYOS servers',
      ],
      cta: 'Scale up',
    },
  ];

  protected readonly managedServices: ManagedService[] = [
    { name: 'Advanced firewall / managed WAF', price: '1 499 F', note: 'Custom rules, geo-blocking' },
    { name: 'Autoscaling', price: '1 999 F', note: 'Automatic scale-up with Docker Swarm' },
    { name: 'Daily backups + 1-click restore', price: '999 F', note: 'Sleep well at night' },
    { name: 'Advanced monitoring + alerts', price: '999 F', note: 'CPU/RAM/disk — e-mail & WhatsApp' },
    { name: 'Extra managed database', price: '999 F', note: '2 GB, backups included' },
    { name: 'Extended log retention', price: '499 F', note: '90 days of logs' },
    { name: 'Dedicated static IP', price: '1 999 F', note: 'Vercel charges 57 500 F for this' },
    { name: 'Sovereign local hosting', price: '1 999 F', note: 'Data center in your country (roadmap)' },
  ];

  protected readonly overages: OverageRow[] = [
    { resource: 'Outbound traffic', ideploy: '25 F/GB', vercel: '86 F/GB', railway: '29 F/GB' },
    { resource: 'Extra RAM', ideploy: '1 500 F/GB/mo', vercel: '—', railway: '5 750 F/GB/mo' },
    { resource: 'Extra app (512 MB)', ideploy: '1 500 F/mo', vercel: '—', railway: '~2 900 F/mo' },
    { resource: 'Disk storage', ideploy: '150 F/GB/mo', vercel: '—', railway: '86 F/GB/mo' },
    { resource: 'Extra deployment', ideploy: '100 F', vercel: 'n/a', railway: 'n/a' },
  ];

  ngOnInit(): void {
    void this.auth.ensureLoaded();
  }
}
