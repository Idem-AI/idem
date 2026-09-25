import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TrustedByComponent } from '@idem/shared-trusted-by/angular';
import { LandingNavComponent } from '../shared/landing-nav';
import { LandingFooterComponent } from '../shared/landing-footer';
import { AuthService } from '../../../shared/services/auth.service';
import { environment } from '../../../../environments/environment';

/**
 * Public iDeploy landing page.
 *
 * Each section is composed differently on purpose, because each one says a
 * different kind of thing: the workflow is a numbered rail because it is an
 * order; hosting is a two-panel fork because it is a choice; security is one
 * console beside a plain list because it is one screen doing several jobs;
 * the remainder is a bare definition list because none of it needs a frame.
 * Only what is genuinely a separate object gets a `.glass-card`.
 *
 * Built from @idem/shared-styles' own components and tokens — `.glass-card`,
 * `.inner-button`, `.outer-button`, `.tag`, `.i-underline`, `.gradient-primary`,
 * `.transition-smooth` — with no styles defined for this page anywhere.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslateModule, TrustedByComponent, LandingNavComponent, LandingFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative min-h-screen text-text-primary overflow-hidden">
      <app-landing-nav [overHero]="true" />

      <!-- ===== HERO — white type on the photograph, in either theme ===== -->
      <section
        [attr.data-on-brand]="''"
        class="dark relative flex flex-col justify-center min-h-[82vh] px-6 pt-36 pb-24 md:pt-40 overflow-hidden text-white"
        style="background: #06080d;">
        <div class="absolute inset-0 z-0">
          <div
            class="absolute inset-0 z-10"
            style="background: linear-gradient(to bottom, rgba(6,8,13,0.6), rgba(6,8,13,0.72), rgba(6,8,13,0.94));"></div>
          <img
            src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2000&auto=format&fit=crop"
            [alt]="'landing.heroImageAlt' | translate"
            class="w-full h-full object-cover opacity-85"
            style="filter: grayscale(35%) brightness(1.15);" />
        </div>

        <div class="relative z-10 max-w-6xl mx-auto w-full text-center">
          <h1
            class="font-black mb-8 mx-auto"
            style="font-size: clamp(2.2rem, 4.4vw, 3.9rem); line-height: 1.1; max-width: 26ch;">
            {{ 'landing.heroTitleLine1' | translate }} {{ 'landing.heroTitleAccent' | translate }}
          </h1>
          <p class="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
            {{ 'landing.heroSubtitle' | translate }}
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <a [href]="loginUrl" class="inner-button px-8 py-4">{{ 'landing.getStartedFree' | translate }}</a>
            <a routerLink="/pricing" class="outer-button px-8 py-4 text-white! border-white/35!">{{ 'landing.viewPricing' | translate }}</a>
          </div>
        </div>
      </section>

      <!-- ===== PARTNERS ===== -->
      <section class="py-14">
        <idem-trusted-by [label]="'landing.trustedBy' | translate" />
      </section>

      <!-- ===== 1. WORKFLOW — a numbered rail, because it is an order ===== -->
      <section id="how" class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl md:text-4xl font-black mb-4 leading-tight">{{ 'landing.steps.title' | translate }}</h2>
          <p class="text-lg text-text-secondary font-medium mb-16 max-w-2xl">
            {{ 'landing.steps.subtitle' | translate }}
          </p>

          <ol class="grid gap-y-10 md:grid-cols-4 md:gap-x-8 mb-16">
            @for (step of steps; track step; let last = $last) {
              <li class="relative md:pt-8">
                <!-- The rail itself: a hairline between the numbers, stopping at the last -->
                @if (!last) {
                  <span
                    class="hidden md:block absolute left-0 right-0 top-3 h-px"
                    style="background: var(--glass-border);"></span>
                }
                <span
                  class="hidden md:block absolute left-0 top-1.5 w-3 h-3 rounded-full gradient-primary"
                  style="outline: 4px solid var(--color-bg-dark);"></span>
                <span class="md:hidden font-mono text-xs text-text-tertiary">{{ step }}</span>
                <h3 class="text-[1rem] font-bold mt-2 mb-2">{{ 'landing.steps.s' + step + '.title' | translate }}</h3>
                <p class="text-sm text-text-secondary font-medium leading-relaxed">
                  {{ 'landing.steps.s' + step + '.body' | translate }}
                </p>
              </li>
            }
          </ol>

          <!-- One wide render of the result, not four small ones -->
          <div class="glass-card overflow-hidden">
            <div
              class="flex items-center gap-3 px-5 py-3.5"
              style="border-bottom: 1px solid var(--glass-border-subtle);">
              <span class="w-2 h-2 rounded-full shrink-0" style="background: var(--color-success);"></span>
              <span class="font-mono text-xs font-bold">{{ 'landing.steps.renderTitle' | translate }}</span>
              <span class="font-mono text-xs text-text-tertiary ml-auto truncate">
                {{ 'landing.steps.renderUrl' | translate }}
              </span>
            </div>
            <ul class="px-5 py-4 font-mono text-xs leading-8">
              @for (line of buildLog; track line) {
                <li class="flex items-center gap-3">
                  <i class="fa-solid fa-check text-[9px]" style="color: var(--color-success);" aria-hidden="true"></i>
                  <span>{{ 'landing.steps.log.' + line + '.label' | translate }}</span>
                  <span class="ml-auto text-text-tertiary">{{ 'landing.steps.log.' + line + '.time' | translate }}</span>
                </li>
              }
            </ul>
            <p class="px-5 py-3.5 font-mono text-xs font-bold" style="border-top: 1px solid var(--glass-border-subtle);">
              {{ 'landing.steps.renderDone' | translate }}
            </p>
          </div>
        </div>
      </section>

      <!-- ===== 2. HOSTING — a fork, so two panels and the word between ===== -->
      <section id="where" class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl md:text-4xl font-black mb-4 leading-tight">{{ 'landing.where.title' | translate }}</h2>
          <p class="text-lg text-text-secondary font-medium mb-14 max-w-2xl">
            {{ 'landing.where.subtitle' | translate }}
          </p>

          <div class="relative grid gap-6 md:grid-cols-2">
            @for (side of hosting; track side) {
              <div class="glass-card p-8 flex flex-col">
                <h3 class="text-xl font-bold mb-3">{{ 'landing.where.' + side + '.title' | translate }}</h3>
                <p class="text-text-secondary font-medium leading-relaxed mb-7">
                  {{ 'landing.where.' + side + '.body' | translate }}
                </p>
                <ul class="flex flex-col gap-3 mt-auto">
                  @for (n of [1, 2, 3]; track n) {
                    <li class="flex items-start gap-3 text-sm font-semibold">
                      <i
                        class="fa-solid fa-check text-[10px] mt-1.5 shrink-0"
                        style="color: var(--color-primary-500);"
                        aria-hidden="true"></i>
                      <span>{{ 'landing.where.' + side + '.p' + n | translate }}</span>
                    </li>
                  }
                </ul>
              </div>
            }

            <!-- The fork, named -->
            <span
              class="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full items-center justify-center text-xs font-bold uppercase glass-card"
              style="border-radius: var(--radius-full);">
              {{ 'landing.where.or' | translate }}
            </span>
          </div>
        </div>
      </section>

      <!-- ===== 3. SECURITY — one console beside a plain list ===== -->
      <section class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-6xl mx-auto grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          <div>
            <h2 class="text-3xl md:text-4xl font-black mb-4 leading-tight">{{ 'landing.guard.title' | translate }}</h2>
            <p class="text-lg text-text-secondary font-medium mb-10">{{ 'landing.guard.subtitle' | translate }}</p>

            <dl class="flex flex-col">
              @for (item of guards; track item) {
                <div class="py-5" style="border-top: 1px solid var(--glass-border-subtle);">
                  <dt class="text-[1rem] font-bold mb-1.5">{{ 'landing.guard.' + item + '.title' | translate }}</dt>
                  <dd class="text-sm text-text-secondary font-medium leading-relaxed">
                    {{ 'landing.guard.' + item + '.body' | translate }}
                  </dd>
                </div>
              }
            </dl>
          </div>

          <!-- The one screen the list is describing -->
          <div class="glass-card overflow-hidden">
            <div
              class="flex items-center gap-3 px-5 py-3.5"
              style="border-bottom: 1px solid var(--glass-border-subtle);">
              <span class="w-2 h-2 rounded-full shrink-0" style="background: var(--color-success);"></span>
              <span class="font-mono text-xs font-bold">{{ 'landing.guard.console.app' | translate }}</span>
              <span class="font-mono text-xs text-text-tertiary ml-auto">
                {{ 'landing.guard.console.state' | translate }}
              </span>
            </div>

            <div class="grid grid-cols-2" style="border-bottom: 1px solid var(--glass-border-subtle);">
              <div class="px-5 py-5" style="border-right: 1px solid var(--glass-border-subtle);">
                <div class="text-2xl font-black">184 302</div>
                <div class="font-mono text-[11px] text-text-tertiary">
                  {{ 'landing.guard.console.requests' | translate }}
                </div>
              </div>
              <div class="px-5 py-5">
                <div class="text-2xl font-black" style="color: var(--color-danger);">2 471</div>
                <div class="font-mono text-[11px] text-text-tertiary">
                  {{ 'landing.guard.console.blocked' | translate }}
                </div>
              </div>
            </div>

            <div class="px-5 py-5 flex flex-col gap-4" style="border-bottom: 1px solid var(--glass-border-subtle);">
              @for (m of meters; track m.key) {
                <div>
                  <div class="flex justify-between font-mono text-[11px] mb-2">
                    <span class="text-text-tertiary">{{ 'landing.guard.console.' + m.key | translate }}</span>
                    <span>{{ m.reading }}</span>
                  </div>
                  <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--glass-border);">
                    <div class="h-full rounded-full gradient-primary" [style.width.%]="m.percent"></div>
                  </div>
                </div>
              }
            </div>

            <div class="px-5 py-5">
              <p class="font-mono text-[11px] text-text-tertiary mb-3">
                {{ 'landing.guard.console.stages' | translate }}
              </p>
              @for (scan of scans; track scan.key) {
                <div class="flex items-center gap-3 py-1.5">
                  <i class="fa-solid fa-check text-[9px]" style="color: var(--color-success);" aria-hidden="true"></i>
                  <span class="text-xs font-semibold">{{ 'landing.guard.console.' + scan.key | translate }}</span>
                  <span class="ml-auto font-mono text-[11px] text-text-tertiary">
                    {{ 'landing.guard.console.' + scan.result | translate }}
                  </span>
                </div>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 4. THE REST — a bare list, no frames ===== -->
      <section class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl md:text-4xl font-black mb-14 leading-tight">{{ 'landing.also.title' | translate }}</h2>
          <dl class="grid md:grid-cols-2 md:gap-x-16">
            @for (item of alsoItems; track item) {
              <div class="py-6" style="border-top: 1px solid var(--glass-border-subtle);">
                <dt class="text-[1rem] font-bold mb-1.5">{{ 'landing.also.items.' + item + '.title' | translate }}</dt>
                <dd class="text-sm text-text-secondary font-medium leading-relaxed">
                  {{ 'landing.also.items.' + item + '.body' | translate }}
                </dd>
              </div>
            }
          </dl>
        </div>
      </section>

      <!-- ===== 5. CATALOGUE — the logos themselves are the section ===== -->
      <section id="services" class="py-24 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-6xl mx-auto px-6 mb-12 text-center">
          <h2 class="text-3xl md:text-4xl font-black mb-4 leading-tight">{{ 'landing.services.title' | translate }}</h2>
          <p class="text-lg text-text-secondary font-medium mb-7 max-w-2xl mx-auto">
            {{ 'landing.services.subtitle' | translate }}
          </p>
          <a [href]="loginUrl" class="outer-button px-6 py-3 text-sm inline-flex">
            {{ 'landing.services.cta' | translate }}
          </a>
        </div>

        @for (row of logoRows; track $index; let rowIndex = $index) {
          <div class="marquee-wrapper mb-3">
            @for (copy of [0, 1]; track copy) {
              <div
                class="marquee-content"
                [attr.aria-hidden]="copy === 1 ? true : null"
                [style.animation-direction]="rowIndex === 1 ? 'reverse' : null"
                style="gap: 3rem; padding-right: 3rem; animation-duration: 75s;">
                @for (logo of row; track logo) {
                  <img
                    [src]="'/assets/svgs/' + logo"
                    alt=""
                    class="h-7 w-7 shrink-0 object-contain opacity-60 grayscale dark:invert" />
                }
              </div>
            }
          </div>
        }
      </section>

      <!-- ===== 6. PRICING — split, one card ===== -->
      <section class="py-24 px-6 border-t border-[var(--glass-border-subtle)]">
        <div class="max-w-6xl mx-auto grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 class="text-3xl md:text-4xl font-black mb-4 leading-tight">
              {{ 'landing.pricingTeaser.title' | translate }}
            </h2>
            <p class="text-lg text-text-secondary font-medium leading-relaxed mb-8">
              {{ 'landing.pricingTeaser.subtitle' | translate }}
            </p>
            <div class="flex flex-col sm:flex-row gap-4">
              <a [href]="loginUrl" class="inner-button px-8 py-4">{{ 'landing.pricingTeaser.cta' | translate }}</a>
              <a routerLink="/pricing" class="outer-button px-8 py-4">
                {{ 'landing.pricingTeaser.secondaryCta' | translate }}
              </a>
            </div>
          </div>

          <div class="glass-card p-8">
            <div class="flex items-baseline gap-2 mb-7">
              <span class="text-4xl font-black">{{ 'landing.pricingTeaser.freePrice' | translate }}</span>
              <span class="text-text-secondary font-medium">{{ 'landing.pricingTeaser.freeLabel' | translate }}</span>
            </div>
            <ul class="flex flex-col gap-3 mb-7">
              @for (item of freePlan; track item) {
                <li class="flex items-start gap-3 text-sm font-semibold">
                  <i
                    class="fa-solid fa-check text-[10px] mt-1.5 shrink-0"
                    style="color: var(--color-primary-500);"
                    aria-hidden="true"></i>
                  <span>{{ 'landing.pricingTeaser.free.' + item | translate }}</span>
                </li>
              }
            </ul>
            <p
              class="text-sm text-text-secondary font-medium pt-6"
              style="border-top: 1px solid var(--glass-border-subtle);">
              {{ 'landing.pricingTeaser.paidNote' | translate }}
            </p>
          </div>
        </div>
      </section>

      <!-- ===== 7. CLOSING — plain, no frame ===== -->
      <section class="py-28 px-6 border-t border-[var(--glass-border-subtle)] text-center">
        <div class="max-w-2xl mx-auto">
          <h2 class="text-3xl md:text-4xl font-black mb-4 leading-tight">{{ 'landing.closing.title' | translate }}</h2>
          <p class="text-lg text-text-secondary font-medium mb-9">{{ 'landing.closing.subtitle' | translate }}</p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a [href]="loginUrl" class="inner-button px-8 py-4">{{ 'landing.getStartedFree' | translate }}</a>
            <a routerLink="/pricing" class="outer-button px-8 py-4">{{ 'landing.viewPricing' | translate }}</a>
          </div>
          <p class="mt-8 font-mono text-xs text-text-tertiary">{{ 'landing.closing.note' | translate }}</p>
        </div>
      </section>

      <app-landing-footer />
    </div>
  `,
})
export class LandingComponent implements OnInit {
  private readonly auth = inject(AuthService);

  protected readonly loginUrl = `${environment.services.console.url}/login?redirect=ideploy`;

  protected readonly steps = [1, 2, 3, 4];
  protected readonly buildLog = ['clone', 'detect', 'build', 'ssl', 'swap'];
  protected readonly hosting = ['idem', 'own'];
  protected readonly guards = ['firewall', 'pipeline', 'monitoring', 'alerts'];

  protected readonly meters = [
    { key: 'cpu', reading: '4 %', percent: 4 },
    { key: 'memory', reading: '212 / 512 Mo', percent: 41 },
    { key: 'disk', reading: '18 / 40 Go', percent: 45 },
  ];

  protected readonly scans = [
    { key: 'sonar', result: 'sonarResult' },
    { key: 'trivy', result: 'trivyResult' },
  ];

  protected readonly alsoItems = [
    'database',
    'workspace',
    'preview',
    'rollback',
    'terminal',
    'env',
    'cron',
    'team',
  ];

  protected readonly freePlan = ['apps', 'deployments', 'domain', 'database', 'commercial'];

  /**
   * Real catalogue entries, picked for legibility: several of the 278 logos are
   * drawn white-on-transparent and vanish on a light ground.
   */
  protected readonly logoRows: string[][] = [
    ['wordpress.svg', 'strapi.svg', 'directus.svg', 'supabase.svg', 'appwrite.svg', 'grafana.svg',
     'gitea.svg', 'mattermost.svg', 'chatwoot.svg', 'keycloak.svg', 'nocodb.svg', 'budibase.svg'],
    ['listmonk.svg', 'rabbitmq.svg', 'redis.svg', 'postgres.svg', 'pocketbase.svg', 'typesense.png',
     'excalidraw.svg', 'jellyfin.svg', 'documenso.png', 'authentik.png', 'langfuse.svg', 'windmill.svg'],
  ];

  ngOnInit(): void {
    void this.auth.ensureLoaded();
  }
}
