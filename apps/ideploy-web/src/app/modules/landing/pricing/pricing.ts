import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LandingNavComponent } from '../shared/landing-nav';
import { LandingFooterComponent } from '../shared/landing-footer';
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
 * Public iDeploy pricing page. Same `.lp` marketing palette, nav and footer as
 * the landing, so following "Pricing" out of the header does not land on a
 * differently designed site. Prices follow the IDEM economic model: one meter
 * per application, paid by the day from the IDEM wallet, daily options, no subscription.
 */
@Component({
  selector: 'app-pricing',
  imports: [RouterLink, TranslateModule, LandingNavComponent, LandingFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative min-h-screen text-text-primary overflow-hidden">
      <app-landing-nav [overHero]="false" />

      <!-- ===== HERO ===== -->
      <section class="pt-40 pb-12 px-6">
        <div class="max-w-7xl mx-auto">
          <p class="text-xs font-bold uppercase text-text-tertiary mb-4">{{ 'landing.pricing.eyebrow' | translate }}</p>
          <h1 class="font-black mb-6 leading-tight" style="font-size: clamp(2.6rem, 5.5vw, 4.2rem);">
            {{ 'pricing.heroTitle' | translate }}<br />
            {{ 'pricing.heroTitleAccent' | translate }}
          </h1>
          <p class="text-lg text-text-secondary font-medium leading-relaxed mb-6 max-w-2xl">{{ 'pricing.heroSubtitle' | translate }}</p>
          <p class="font-mono text-xs text-text-tertiary">{{ 'pricing.heroNote' | translate }}</p>
        </div>
      </section>

      <!-- ===== PLANS ===== -->
      <section class="pb-20">
        <div class="max-w-7xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          @for (plan of plans; track plan.name) {
            <div
              class="glass-card project-card relative flex flex-col p-7"
              [style.border-color]="plan.popular ? 'var(--color-primary-500)' : null">
              @if (plan.popular) {
                <div
                  class="absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-bold text-white bg-primary-500">
                  {{ 'pricing.mostPopular' | translate }}
                </div>
              }
              <h2 class="mb-3 text-lg font-black">{{ plan.name | translate }}</h2>
              <div class="flex items-baseline gap-1">
                <span class="text-3xl font-black">{{ plan.price }}</span>
                <span class="text-sm text-text-secondary font-medium leading-relaxed">{{ 'pricing.perDay' | translate }}</span>
              </div>
              @if (plan.usd) {
                <div class="font-mono text-xs text-text-tertiary mt-1 mb-4">{{ plan.usd | translate }}</div>
              }
              <p class="text-sm text-text-secondary font-medium leading-relaxed mb-6">{{ plan.tagline | translate }}</p>
              <ul class="mb-7 flex grow flex-col gap-2.5">
                @for (feature of plan.features; track feature) {
                  <li class="flex items-start gap-2.5 text-sm font-semibold">
                    <i
                      class="pi pi-check mt-1 text-[10px] text-primary-500 dark:text-primary-400"
                      aria-hidden="true"></i>
                    <span>{{ feature | translate }}</span>
                  </li>
                }
              </ul>
              <a [href]="loginUrl" class="w-full py-3 text-center text-sm" [class.inner-button]="plan.popular" [class.outer-button]="!plan.popular">{{ plan.cta | translate }}</a>
            </div>
          }
        </div>
      </section>

      <!-- ===== PAY PER DEPLOYMENT ===== -->
      <section class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-7xl mx-auto grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <h2 class="text-4xl md:text-5xl font-black mb-5 leading-tight">
              {{ 'pricing.payTitle' | translate }} {{ 'pricing.payTitleAccent' | translate }}
            </h2>
            <p class="text-lg text-text-secondary font-medium leading-relaxed max-w-2xl">{{ 'pricing.paySubtitle' | translate }}</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            @for (card of payCards; track card.labelKey) {
              <div class="glass-card p-6">
                <div class="mb-1 text-2xl font-black">{{ card.valueKey | translate }}</div>
                <div class="text-sm text-text-secondary font-medium leading-relaxed">{{ card.labelKey | translate }}</div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ===== MANAGED SERVICES ===== -->
      <section class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-7xl mx-auto">
          <div class="mb-12 max-w-2xl">
            <h2 class="text-4xl md:text-5xl font-black mb-5 leading-tight">
              {{ 'pricing.managedTitle' | translate }}
              {{ 'pricing.managedTitleAccent' | translate }}
            </h2>
            <p class="text-lg text-text-secondary font-medium leading-relaxed max-w-2xl">{{ 'pricing.managedSubtitle' | translate }}</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            @for (svc of managedServices; track svc.name) {
              <div class="glass-card p-6">
                <div class="mb-2 text-xl font-black text-primary-500 dark:text-primary-400">
                  {{ svc.price }}<span class="text-sm font-semibold text-text-secondary">{{ 'pricing.perDay' | translate }}</span>
                </div>
                <div class="text-[1rem] font-bold mb-1">{{ svc.name | translate }}</div>
                <div class="text-sm text-text-secondary font-medium leading-relaxed">{{ svc.note | translate }}</div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ===== OVERAGES ===== -->
      <section class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-7xl mx-auto">
          <div class="mb-12 max-w-2xl">
            <h2 class="text-4xl md:text-5xl font-black mb-5 leading-tight">
              {{ 'pricing.overagesTitle' | translate }}
              {{ 'pricing.overagesTitleAccent' | translate }}
            </h2>
            <p class="text-lg text-text-secondary font-medium leading-relaxed max-w-2xl">{{ 'pricing.overagesSubtitle' | translate }}</p>
          </div>
          <div class="glass-card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr style="border-bottom: 1px solid var(--glass-border-subtle); background: var(--glass-bg-subtle);">
                    <th class="p-4 text-left font-bold">{{ 'pricing.colResource' | translate }}</th>
                    <th class="p-4 text-center font-bold text-primary-500 dark:text-primary-400">iDeploy</th>
                    <th class="p-4 text-center font-bold text-text-tertiary">Vercel</th>
                    <th class="p-4 text-center font-bold text-text-tertiary">Railway</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of overages; track row.resource) {
                    <tr style="border-bottom: 1px solid var(--glass-border-subtle); background: var(--glass-bg-subtle);">
                      <td class="p-4 font-semibold">{{ row.resource | translate }}</td>
                      <td class="p-4 text-center font-bold text-primary-500 dark:text-primary-400">{{ row.ideploy | translate }}</td>
                      <td class="p-4 text-center text-text-tertiary">{{ row.vercel | translate }}</td>
                      <td class="p-4 text-center text-text-tertiary">{{ row.railway | translate }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== BYOS ===== -->
      <section class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-7xl mx-auto grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <h2 class="text-4xl md:text-5xl font-black mb-5 leading-tight">
              {{ 'pricing.byosTitle' | translate }} {{ 'pricing.byosTitleAccent' | translate }}
            </h2>
            <p class="text-lg text-text-secondary font-medium leading-relaxed max-w-2xl">{{ 'pricing.byosBody' | translate }}</p>
          </div>
          <div class="flex flex-col gap-3">
            @for (key of byosFeatures; track key) {
              <div class="flex items-center gap-3">
                <i class="pi pi-check text-xs text-primary-500 dark:text-primary-400" aria-hidden="true"></i>
                <span class="text-sm font-semibold">{{ key | translate }}</span>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ===== CTA ===== -->
      <section class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-7xl mx-auto">
          <div class="max-w-2xl">
            <h2 class="text-4xl md:text-5xl font-black mb-5 leading-tight">
              {{ 'pricing.ctaTitle' | translate }} {{ 'pricing.ctaTitleAccent' | translate }}
            </h2>
            <p class="text-lg text-text-secondary font-medium leading-relaxed mb-8 max-w-2xl">{{ 'pricing.ctaSubtitle' | translate }}</p>
            <div class="flex flex-col gap-3 sm:flex-row">
              <a [href]="loginUrl" class="inner-button px-8 py-4">
                {{ 'pricing.getStartedFree' | translate }}
              </a>
              <a routerLink="/" class="outer-button px-8 py-4">{{ 'pricing.backToHome' | translate }}</a>
            </div>
          </div>
        </div>
      </section>

      <app-landing-footer />
    </div>
  `,
})
export class PricingComponent implements OnInit {
  private readonly auth = inject(AuthService);

  protected readonly loginUrl = `${environment.services.console.url}/login?redirect=ideploy`;

  protected readonly payCards = [
    { valueKey: 'pricing.payCard1Value', labelKey: 'pricing.payCard1Label' },
    { valueKey: 'pricing.payCard2Value', labelKey: 'pricing.payCard2Label' },
    { valueKey: 'pricing.payCard3Value', labelKey: 'pricing.payCard3Label' },
  ];

  protected readonly byosFeatures = ['pricing.byosFeature1', 'pricing.byosFeature2', 'pricing.byosFeature3'];

  /**
   * Une application = un compteur, payé au jour depuis le portefeuille IDEM (`offer.model.ts`
   * côté API). Les textes sont traduits ; les montants sont ceux que l'API débite.
   */
  protected readonly plans: Plan[] = (['veille', 'vitrine', 'application', 'application_plus'] as const).map((tier) => ({
    name: `pricing.meters.${tier}.name`,
    price: { veille: '0 F', vitrine: '10 F', application: '50 F', application_plus: '150 F' }[tier],
    usd: `pricing.meters.${tier}.monthly`,
    tagline: `pricing.meters.${tier}.tagline`,
    features: [1, 2, 3, 4].map((n) => `pricing.meters.${tier}.f${n}`),
    popular: tier === 'vitrine',
    cta: tier === 'veille' ? 'pricing.getStartedFree' : 'pricing.meters.choose',
  }));

  /** Options à la journée, sur n'importe quel compteur payant. */
  protected readonly managedServices: ManagedService[] = [
    { name: 'pricing.options.waf', price: '50 F', note: 'pricing.options.wafNote' },
    { name: 'pricing.options.autoscaling', price: '70 F', note: 'pricing.options.autoscalingNote' },
    { name: 'pricing.options.backups', price: '35 F', note: 'pricing.options.backupsNote' },
    { name: 'pricing.options.monitoring', price: '35 F', note: 'pricing.options.monitoringNote' },
    { name: 'pricing.options.database', price: '35 F', note: 'pricing.options.databaseNote' },
    { name: 'pricing.options.logs', price: '15 F', note: 'pricing.options.logsNote' },
    { name: 'pricing.options.staticIp', price: '70 F', note: 'pricing.options.staticIpNote' },
    { name: 'pricing.options.sovereign', price: '70 F', note: 'pricing.options.sovereignNote' },
  ];

  protected readonly overages: OverageRow[] = [
    { resource: 'pricing.compare.showcase', ideploy: '300 F/mo', vercel: '11 500 F/mo', railway: '2 900 F/mo' },
    { resource: 'pricing.compare.app', ideploy: '1 500 F/mo', vercel: '11 500 F/mo', railway: '~2 900 F/mo' },
    { resource: 'pricing.compare.deployments', ideploy: 'pricing.compare.unlimited', vercel: 'pricing.compare.unlimited', railway: 'pricing.compare.unlimited' },
    { resource: 'pricing.compare.domain', ideploy: '6 500 F/yr', vercel: '~11 500 F/yr', railway: '—' },
  ];

  ngOnInit(): void {
    void this.auth.ensureLoaded();
  }
}
