import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LandingNavComponent } from '../shared/landing-nav';
import { LandingFooterComponent } from '../shared/landing-footer';
import { AuthService } from '../../../shared/services/auth.service';
import { IllustrationComponent } from '../../../shared/components/illustration/illustration';
import { environment } from '../../../../environments/environment';

type MeterTier = 'veille' | 'vitrine' | 'application' | 'application_plus';

interface Meter {
  tier: MeterTier;
  price: string;
  recommended: boolean;
}

/**
 * Tarifs publics d'iDeploy. Une idée par écran : une application = un compteur payé au jour
 * depuis le portefeuille IDEM. On choisit son compteur (chacun a son bouton, qui mène au
 * réglage des compteurs, connexion d'abord si besoin), on voit comment on paie, puis les
 * options et la comparaison pour qui veut le détail.
 *
 * Montants : `offer.model.ts` côté API (ce que l'API débite vraiment).
 */
@Component({
  selector: 'app-pricing',
  imports: [TranslateModule, LandingNavComponent, LandingFooterComponent, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative min-h-screen overflow-hidden text-text-primary">
      <app-landing-nav [overHero]="false" />

      <!-- Héros -->
      <section class="px-6 pb-16 pt-36">
        <div class="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 class="text-balance font-black leading-[1.05]" style="font-size: clamp(2.4rem, 5.5vw, 4.2rem);">
              {{ 'pricing.heroTitle' | translate }}
              <span class="i-underline">{{ 'pricing.heroTitleAccent' | translate }}</span>
            </h1>
            <p class="mt-6 max-w-xl text-lg leading-relaxed text-text-secondary">{{ 'pricing.heroSubtitle' | translate }}</p>
            <div class="mt-8 flex flex-wrap items-center gap-5">
              <a [href]="loginUrl" class="inner-button button-lg">{{ 'pricing.getStartedFree' | translate }}</a>
              <a href="#meters" class="font-semibold text-primary-500 underline underline-offset-4">{{ 'pricing.seeMeters' | translate }}</a>
            </div>
            <p class="mt-4 text-sm text-text-secondary">{{ 'pricing.heroNote' | translate }}</p>
          </div>
          <app-illustration name="facade" [width]="300" class="mx-auto hidden text-text-tertiary sm:block" />
        </div>
      </section>

      <!-- Les compteurs -->
      <section id="meters" class="scroll-mt-28 px-6 pb-24">
        <div class="mx-auto max-w-6xl">
          <h2 class="mb-2 text-balance text-3xl font-black">{{ 'pricing.metersTitle' | translate }}</h2>
          <p class="mb-10 max-w-2xl text-text-secondary">{{ 'pricing.metersHint' | translate }}</p>
          <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            @for (meter of meters; track meter.tier) {
              <article
                class="relative flex flex-col rounded-3xl bg-[var(--color-surface-1)] p-6"
                [class]="meter.recommended ? 'border-2 border-primary-500' : 'border border-[var(--glass-border)]'"
                [attr.aria-labelledby]="'meter-' + meter.tier">
                @if (meter.recommended) {
                  <p class="absolute -top-3 left-6 rounded-full bg-primary-500 px-3 py-0.5 text-xs font-bold text-white">{{ 'pricing.mostPopular' | translate }}</p>
                }
                <h3 class="text-lg font-black" [id]="'meter-' + meter.tier">{{ 'pricing.meters.' + meter.tier + '.name' | translate }}</h3>
                <p class="mt-3">
                  <span class="text-4xl font-black tabular-nums">{{ meter.price }}</span>
                  <span class="text-sm text-text-secondary">{{ 'pricing.perDay' | translate }}</span>
                </p>
                <p class="mt-1 text-sm font-semibold text-primary-500">{{ 'pricing.meters.' + meter.tier + '.monthly' | translate }}</p>
                <p class="mt-4 text-sm leading-relaxed text-text-secondary">{{ 'pricing.meters.' + meter.tier + '.tagline' | translate }}</p>
                <ul class="mb-7 mt-5 flex grow flex-col gap-2.5">
                  @for (n of features; track n) {
                    <li class="flex items-start gap-2.5 text-sm">
                      <i class="pi pi-check mt-1 text-[10px] text-primary-500" aria-hidden="true"></i>
                      <span>{{ 'pricing.meters.' + meter.tier + '.f' + n | translate }}</span>
                    </li>
                  }
                </ul>
                @if (meter.tier === 'veille') {
                  <a [href]="loginUrl" class="outer-button w-full text-center">{{ 'pricing.getStartedFree' | translate }}</a>
                } @else {
                  <button type="button" class="w-full" [class]="meter.recommended ? 'inner-button' : 'outer-button'" (click)="chooseMeter()">
                    {{ 'pricing.meters.choose' | translate }}
                  </button>
                }
              </article>
            }
          </div>
        </div>
      </section>

      <!-- Comment on paie : une vraie suite d'étapes -->
      <section class="border-t border-[var(--glass-border-subtle)] px-6 py-24">
        <div class="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_14rem]">
          <div>
            <h2 class="mb-10 text-balance text-3xl font-black">{{ 'pricing.stepsTitle' | translate }}</h2>
            <ol class="grid gap-8 md:grid-cols-3">
              @for (n of steps; track n) {
                <li class="flex gap-4">
                  <span class="grid h-9 w-9 flex-none place-items-center rounded-full bg-primary-500 font-bold text-white" aria-hidden="true">{{ n }}</span>
                  <div>
                    <p class="font-bold">{{ 'pricing.step' + n + 'T' | translate }}</p>
                    <p class="mt-1 text-sm leading-relaxed text-text-secondary">{{ 'pricing.step' + n + 'D' | translate }}</p>
                  </div>
                </li>
              }
            </ol>
          </div>
          <app-illustration name="cowries" [width]="200" class="mx-auto hidden text-text-tertiary lg:block" />
        </div>
      </section>

      <!-- Les options à la journée : une liste, pas une grille -->
      <section class="border-t border-[var(--glass-border-subtle)] px-6 py-24">
        <div class="mx-auto max-w-6xl">
          <h2 class="mb-2 text-balance text-3xl font-black">{{ 'pricing.optionsTitle' | translate }}</h2>
          <p class="mb-8 max-w-2xl text-text-secondary">{{ 'pricing.managedSubtitle' | translate }}</p>
          <dl class="grid gap-x-12 md:grid-cols-2">
            @for (option of options; track option.key) {
              <div class="flex items-baseline justify-between gap-6 border-b border-[var(--glass-border-subtle)] py-4">
                <dt>
                  <span class="block font-semibold">{{ 'pricing.options.' + option.key | translate }}</span>
                  <span class="block text-sm text-text-secondary">{{ 'pricing.options.' + option.key + 'Note' | translate }}</span>
                </dt>
                <dd class="flex-none font-bold tabular-nums">{{ option.price }}<span class="text-sm font-normal text-text-secondary">{{ 'pricing.perDay' | translate }}</span></dd>
              </div>
            }
          </dl>
        </div>
      </section>

      <!-- Comparaison -->
      <section class="border-t border-[var(--glass-border-subtle)] px-6 py-24">
        <div class="mx-auto max-w-6xl">
          <h2 class="mb-2 text-balance text-3xl font-black">{{ 'pricing.compareTitle' | translate }}</h2>
          <p class="mb-8 text-sm text-text-secondary">{{ 'pricing.overagesSubtitle' | translate }}</p>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[34rem] text-sm">
              <thead>
                <tr class="border-b border-[var(--glass-border)]">
                  <th scope="col" class="py-3 pr-4 text-left font-bold">{{ 'pricing.colResource' | translate }}</th>
                  <th scope="col" class="px-4 py-3 text-right font-bold text-primary-500">iDeploy</th>
                  <th scope="col" class="px-4 py-3 text-right font-semibold text-text-secondary">Vercel</th>
                  <th scope="col" class="py-3 pl-4 text-right font-semibold text-text-secondary">Railway</th>
                </tr>
              </thead>
              <tbody>
                @for (row of comparison; track row.resource) {
                  <tr class="border-b border-[var(--glass-border-subtle)]">
                    <th scope="row" class="py-4 pr-4 text-left font-medium">{{ row.resource | translate }}</th>
                    @for (value of row.values; track $index; let first = $first) {
                      <td class="px-4 py-4 text-right tabular-nums last:pr-0" [class]="first ? 'font-bold' : 'text-text-secondary'">
                        @if (value === null) {
                          —
                        } @else if (row.unit) {
                          {{ value }}{{ row.unit | translate }}
                        } @else {
                          {{ value | translate }}
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="mt-8 max-w-2xl text-sm text-text-secondary">{{ 'pricing.byosBody' | translate }}</p>
        </div>
      </section>

      <!-- Dernier appel -->
      <section class="px-6 pb-28">
        <div class="mx-auto max-w-6xl rounded-[2rem] bg-primary-500 px-6 py-14 text-center">
          <h2 class="text-balance text-3xl font-black text-white md:text-4xl">{{ 'pricing.ctaTitle' | translate }}</h2>
          <p class="mx-auto mt-4 max-w-xl text-white/90">{{ 'pricing.ctaSubtitle' | translate }}</p>
          <a [href]="loginUrl" class="inner-button button-lg mt-8 inline-flex !bg-white !text-primary-500">{{ 'pricing.getStartedFree' | translate }}</a>
        </div>
      </section>

      <app-landing-footer />

      <!-- Le bouton reste sous le pouce pendant la lecture (téléphone). -->
      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--glass-border)] bg-[var(--color-surface-1)] px-4 py-3 lg:hidden">
        <a [href]="loginUrl" class="inner-button w-full text-center">{{ 'pricing.getStartedFree' | translate }}</a>
      </div>
    </div>
  `,
})
export class PricingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loginUrl = `${environment.services.console.url}/login?redirect=ideploy`;

  protected readonly meters: Meter[] = [
    { tier: 'veille', price: '0 F', recommended: false },
    { tier: 'vitrine', price: '10 F', recommended: true },
    { tier: 'application', price: '50 F', recommended: false },
    { tier: 'application_plus', price: '150 F', recommended: false },
  ];
  protected readonly features = [1, 2, 3, 4];
  protected readonly steps = [1, 2, 3];

  /** Options à la journée, sur n'importe quel compteur payant. */
  protected readonly options = [
    { key: 'backups', price: '35 F' },
    { key: 'monitoring', price: '35 F' },
    { key: 'database', price: '35 F' },
    { key: 'logs', price: '15 F' },
    { key: 'waf', price: '50 F' },
    { key: 'autoscaling', price: '70 F' },
    { key: 'staticIp', price: '70 F' },
    { key: 'sovereign', price: '70 F' },
  ];

  /** Prix relevés en septembre 2026 (575 F le dollar) ; `null` = l'offre n'existe pas. */
  protected readonly comparison = [
    { resource: 'pricing.compare.showcase', unit: 'pricing.perMonth', values: ['300 F', '11 500 F', '2 900 F'] },
    { resource: 'pricing.compare.app', unit: 'pricing.perMonth', values: ['1 500 F', '11 500 F', '~2 900 F'] },
    { resource: 'pricing.compare.deployments', unit: null, values: ['pricing.compare.unlimited', 'pricing.compare.unlimited', 'pricing.compare.unlimited'] },
    { resource: 'pricing.compare.domain', unit: 'pricing.perYear', values: ['6 500 F', '~11 500 F', null] },
  ];

  ngOnInit(): void {
    void this.auth.ensureLoaded();
  }

  /** Choisir un compteur payant : on le règle sur la page des compteurs, connecté. */
  protected chooseMeter(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/subscription']);
      return;
    }
    this.auth.rememberNextPath('/subscription');
    window.location.href = this.loginUrl;
  }
}
