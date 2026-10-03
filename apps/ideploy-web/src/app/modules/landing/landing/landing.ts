import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TrustedByComponent } from '@idem/shared-trusted-by/angular';
import { LandingNavComponent } from '../shared/landing-nav';
import { LandingFooterComponent } from '../shared/landing-footer';
import { IllustrationComponent } from '../../../shared/components/illustration/illustration';
import { LiveShopIllustrationComponent } from './live-shop-illustration';
import { GuardConsoleIllustrationComponent } from './guard-console-illustration';
import { HostingForkIllustrationComponent } from './hosting-fork-illustration';
import { AuthService } from '../../../shared/services/auth.service';
import { environment } from '../../../../environments/environment';

/** A catalogue entry shown on the landing. `name` is a brand, never translated. */
interface FeaturedService {
  key: string;
  name: string;
  logo: string;
  /** The file is drawn white-only (made for a dark ground): ink it dark in the light theme. */
  whiteInk?: boolean;
  /** The file carries wide inner margins (a wordmark): enlarge it to the size of its neighbours. */
  scale?: number;
}

interface ServiceGroup {
  key: string;
  services: FeaturedService[];
}

/**
 * Public iDeploy landing page.
 *
 * The hero is untouched. Below it, each section leads with one large
 * statement and a single drawn object from AGENTS.md § 4 that says the same
 * thing: the granary and its door for where the app runs, the shield for
 * protection, the market stall for the catalogue, the pirogue for going live.
 * Sections alternate between the page ground and the raised surface so the
 * page reads as chapters rather than one long column.
 */
@Component({
  selector: 'app-landing',
  imports: [
    RouterLink,
    TranslateModule,
    TrustedByComponent,
    LandingNavComponent,
    LandingFooterComponent,
    IllustrationComponent,
    LiveShopIllustrationComponent,
    GuardConsoleIllustrationComponent,
    HostingForkIllustrationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .lp-wrap {
      max-width: 72rem;
      margin-inline: auto;
      padding-inline: 1.5rem;
    }
    .lp-section {
      padding-block: 4.5rem;
    }
    @media (min-width: 768px) {
      .lp-section {
        padding-block: 7rem;
      }
    }
    /* A chapter on the raised surface, framed top and bottom by a hairline. */
    .lp-band {
      background: var(--color-surface-1);
      border-block: 1px solid var(--glass-border-subtle);
    }
    .lp-title {
      font-weight: 900;
      font-size: clamp(2rem, 4.2vw, 3.25rem);
      line-height: 1.06;
      color: var(--color-text-primary);
    }
    .lp-lead {
      margin-top: 1.25rem;
      max-width: 36rem;
      font-size: 1.125rem;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    /* Workflow — the order is the information, so the numerals carry it. */
    .lp-step {
      display: grid;
      grid-template-columns: 4.25rem 1fr;
      gap: 1rem;
      padding-block: 1.5rem;
      border-top: 1px solid var(--glass-border);
    }
    .lp-step:last-child {
      border-bottom: 1px solid var(--glass-border);
    }
    .lp-num {
      font-weight: 900;
      font-size: 2.5rem;
      line-height: 1;
      color: var(--color-primary-500);
      font-variant-numeric: tabular-nums;
    }

    /* Hosting — two columns filled column by column, so each row lines up
     * across: the same question answered for both sides. On a phone the
     * columns simply stack. */
    .lp-fork {
      position: relative;
      display: grid;
      column-gap: 4rem;
    }
    .lp-fork__head {
      padding-bottom: 1.25rem;
      text-align: center;
    }
    .lp-fork__head:not(:first-child) {
      margin-top: 3.5rem;
    }
    .lp-fork__cell {
      padding-block: 1.1rem;
      border-top: 1px solid var(--glass-border);
    }
    @media (min-width: 768px) {
      .lp-fork {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: repeat(5, auto);
        grid-auto-flow: column;
      }
      .lp-fork__head:not(:first-child) {
        margin-top: 0;
      }
      /* The path carries on between the two columns. */
      .lp-fork::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        border-left: 3px dotted var(--glass-border);
      }
    }

    /* Catalogue — the logo is the point, so it gets a real tile. */
    .lp-logo {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 3.75rem;
      height: 3.75rem;
      border-radius: var(--radius-xl);
      background: var(--color-bg-dark);
      border: 1px solid var(--glass-border);
      overflow: hidden;
    }
    .lp-logo img {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: contain;
    }
    .lp-service:hover .lp-logo {
      border-color: var(--color-primary-500);
    }

    .lp-price {
      font-weight: 900;
      font-size: clamp(3.5rem, 8vw, 5.5rem);
      line-height: 0.85;
      color: var(--color-text-primary);
    }

    /* Pricing — a till receipt: torn top and bottom, every line at 0 F. */
    .lp-receipt-wrap {
      position: relative;
      width: 100%;
      max-width: 28rem;
      margin-inline: auto;
      filter: drop-shadow(0 0 1px var(--glass-border))
        drop-shadow(0 18px 28px color-mix(in srgb, var(--color-text-primary) 10%, transparent));
    }
    @media (min-width: 1024px) {
      .lp-receipt-wrap {
        transform: rotate(1.5deg);
      }
    }
    .lp-receipt {
      --tooth: 9px;
      padding: 2.5rem 2rem;
      background: var(--color-surface-1);
      mask:
        conic-gradient(from -45deg at bottom, transparent, black 1deg 89deg, transparent 90deg) bottom /
          calc(2 * var(--tooth)) 51% repeat-x,
        conic-gradient(from 135deg at top, transparent, black 1deg 89deg, transparent 90deg) top /
          calc(2 * var(--tooth)) 51% repeat-x;
    }
    .lp-receipt__rule {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 2px dashed var(--glass-border);
    }
    .lp-receipt__row {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      padding-block: 0.35rem;
    }
    .lp-receipt__leader {
      flex: 1;
      min-width: 1rem;
      border-bottom: 1px dotted var(--color-text-tertiary);
    }
    .lp-stamp {
      position: absolute;
      top: -2.25rem;
      right: -1.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 7rem;
      height: 7rem;
      border-radius: var(--radius-full);
      border: 6px double var(--color-primary-500);
      color: var(--color-primary-500);
      transform: rotate(-14deg);
      text-align: center;
    }
    @media (max-width: 640px) {
      .lp-stamp {
        right: -0.5rem;
        top: -2rem;
        width: 5.5rem;
        height: 5.5rem;
      }
    }

  `,
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
      <section class="py-12 lp-band" style="border-top: 0;">
        <idem-trusted-by [label]="'landing.trustedBy' | translate" />
      </section>

      <!-- ===== 1. WORKFLOW — big numerals for the order, the drawn result beside ===== -->
      <section id="how" class="lp-section">
        <div class="lp-wrap grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <h2 class="lp-title">{{ 'landing.steps.title' | translate }}</h2>
            <p class="lp-lead">{{ 'landing.steps.subtitle' | translate }}</p>

            <ol class="mt-12">
              @for (step of steps; track step) {
                <li class="lp-step">
                  <span class="lp-num" aria-hidden="true">0{{ step }}</span>
                  <div>
                    <h3 class="text-lg font-bold">{{ 'landing.steps.s' + step + '.title' | translate }}</h3>
                    <p class="mt-1 text-text-secondary leading-relaxed">
                      {{ 'landing.steps.s' + step + '.body' | translate }}
                    </p>
                  </div>
                </li>
              }
            </ol>
          </div>

          <!-- The result, drawn: the shop as it looks once online -->
          <app-live-shop-illustration
            class="block lg:mt-24"
            [url]="'landing.steps.renderUrl' | translate"
            [status]="'landing.steps.renderDone' | translate" />
        </div>
      </section>

      <!-- ===== 2. HOSTING — one path that forks: the village granary, or your own door ===== -->
      <section id="where" class="lp-section lp-band">
        <div class="lp-wrap">
          <div class="max-w-2xl">
            <h2 class="lp-title">{{ 'landing.where.title' | translate }}</h2>
            <p class="lp-lead">{{ 'landing.where.subtitle' | translate }}</p>
          </div>

          <app-hosting-fork-illustration class="hidden md:block mt-16" [or]="'landing.where.or' | translate" />

          <!-- Read across: the same question, answered for each side -->
          <div class="lp-fork mt-12 md:mt-6">
            @for (side of hosting; track side) {
              <div class="lp-fork__head">
                <!-- On a phone the fork is too small to read: each side shows its own destination -->
                <div class="flex justify-center mb-5 md:hidden">
                  <app-illustration [name]="side === 'idem' ? 'managed-cloud' : 'own-server'" [width]="128" />
                </div>
                <h3 class="text-2xl md:text-3xl font-black">{{ 'landing.where.' + side + '.title' | translate }}</h3>
                <p class="mt-2 text-text-secondary leading-relaxed">
                  {{ 'landing.where.' + side + '.body' | translate }}
                </p>
              </div>
              @for (row of hostingRows; track row) {
                <div class="lp-fork__cell">
                  <p class="text-xs font-bold uppercase text-text-tertiary">
                    {{ 'landing.where.rows.' + row | translate }}
                  </p>
                  <p class="mt-1.5 font-semibold leading-relaxed">
                    {{ 'landing.where.' + side + '.' + row | translate }}
                  </p>
                </div>
              }
            }
          </div>
        </div>
      </section>

      <!-- ===== 3. SECURITY — the list, and the screen it describes, drawn ===== -->
      <section class="lp-section">
        <div class="lp-wrap grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 class="lp-title">{{ 'landing.guard.title' | translate }}</h2>
            <p class="lp-lead">{{ 'landing.guard.subtitle' | translate }}</p>

            <dl class="grid sm:grid-cols-2 gap-x-8 mt-10">
              @for (item of guards; track item) {
                <div class="py-5" style="border-top: 1px solid var(--glass-border);">
                  <dt class="font-bold">{{ 'landing.guard.' + item + '.title' | translate }}</dt>
                  <dd class="mt-1 text-sm text-text-secondary leading-relaxed">
                    {{ 'landing.guard.' + item + '.body' | translate }}
                  </dd>
                </div>
              }
            </dl>
          </div>

          <app-guard-console-illustration class="block" />
        </div>
      </section>

      <!-- ===== 4. CATALOGUE — the names people already know, by what they are for ===== -->
      <section id="services" class="lp-section lp-band">
        <div class="lp-wrap">
          <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div class="max-w-2xl">
              <h2 class="lp-title">{{ 'landing.services.title' | translate }}</h2>
              <p class="lp-lead">{{ 'landing.services.subtitle' | translate }}</p>
            </div>
            <app-illustration name="market" [width]="150" class="hidden md:block shrink-0" />
          </div>

          <div class="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-5 mt-14">
            @for (group of serviceGroups; track group.key) {
              <div>
                <h3
                  class="pb-3 text-sm font-bold text-text-secondary"
                  style="border-bottom: 1px solid var(--glass-border);">
                  {{ 'landing.services.groups.' + group.key | translate }}
                </h3>
                <ul>
                  @for (s of group.services; track s.key) {
                    <li class="lp-service flex items-center gap-4 py-3">
                      <span class="lp-logo">
                        <img
                          [src]="'/assets/svgs/' + s.logo"
                          alt=""
                          width="40"
                          height="40"
                          loading="lazy"
                          [class]="s.whiteInk ? 'invert dark:invert-0' : ''"
                          [style.transform]="s.scale ? 'scale(' + s.scale + ')' : null" />
                      </span>
                      <span class="min-w-0">
                        <span class="block font-bold">{{ s.name }}</span>
                        <span class="block text-xs text-text-secondary leading-snug">
                          {{ 'landing.services.items.' + s.key | translate }}
                        </span>
                      </span>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>

          <div
            class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mt-14 pt-8"
            style="border-top: 1px solid var(--glass-border);">
            <p class="text-text-secondary max-w-2xl">
              {{ 'landing.services.more' | translate: { count: catalogueSize - featuredCount } }}
            </p>
            <a [href]="loginUrl" class="outer-button px-6 py-3 shrink-0">
              {{ 'landing.services.cta' | translate }}
            </a>
          </div>
        </div>
      </section>

      <!-- ===== 5. THE REST — the jars, and a plain list ===== -->
      <section class="lp-section">
        <div class="lp-wrap grid gap-12 lg:grid-cols-[1fr_1.9fr]">
          <div>
            <h2 class="lp-title">{{ 'landing.also.title' | translate }}</h2>
            <app-illustration name="store" [width]="280" class="block mt-10 max-w-full" />
          </div>
          <dl class="grid sm:grid-cols-2 gap-x-10">
            @for (item of alsoItems; track item) {
              <div class="py-6" style="border-top: 1px solid var(--glass-border);">
                <dt class="text-lg font-bold">{{ 'landing.also.items.' + item + '.title' | translate }}</dt>
                <dd class="mt-1.5 text-text-secondary leading-relaxed">
                  {{ 'landing.also.items.' + item + '.body' | translate }}
                </dd>
              </div>
            }
          </dl>
        </div>
      </section>

      <!-- ===== 6. PRICING — the receipt of what you pay: nothing ===== -->
      <section class="lp-section" style="border-top: 1px solid var(--glass-border-subtle);">
        <div class="lp-wrap grid gap-16 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <app-illustration name="cowries" [width]="210" class="block mb-8 max-w-full" />
            <h2 class="lp-title">{{ 'landing.pricingTeaser.title' | translate }}</h2>
            <p class="lp-lead">{{ 'landing.pricingTeaser.subtitle' | translate }}</p>
            <div class="flex flex-col sm:flex-row gap-4 mt-10">
              <a [href]="loginUrl" class="inner-button px-8 py-4">{{ 'landing.pricingTeaser.cta' | translate }}</a>
              <a routerLink="/pricing" class="outer-button px-8 py-4">
                {{ 'landing.pricingTeaser.secondaryCta' | translate }}
              </a>
            </div>
          </div>

          <div class="lp-receipt-wrap">
            <div class="lp-receipt">
              <p class="text-center text-xl font-black">iDeploy</p>
              <p class="text-center font-mono text-xs text-text-tertiary mt-1">
                {{ 'landing.pricingTeaser.receipt.plan' | translate }}
              </p>

              <ul class="lp-receipt__rule font-mono text-sm">
                @for (item of freePlan; track item) {
                  <li class="lp-receipt__row">
                    <span>{{ 'landing.pricingTeaser.free.' + item | translate }}</span>
                    <span class="lp-receipt__leader" aria-hidden="true"></span>
                    <span class="shrink-0 font-bold">{{ 'landing.pricingTeaser.freePrice' | translate }}</span>
                  </li>
                }
              </ul>

              <div class="lp-receipt__rule flex items-end justify-between gap-4">
                <span class="font-mono text-sm font-bold uppercase">
                  {{ 'landing.pricingTeaser.receipt.total' | translate }}
                </span>
                <span class="lp-price">{{ 'landing.pricingTeaser.freePrice' | translate }}</span>
              </div>

              <p class="lp-receipt__rule font-mono text-xs text-text-secondary text-center">
                {{ 'landing.pricingTeaser.paidNote' | translate }}
              </p>
            </div>

            <!-- The stamp: the one word that matters on this receipt -->
            <p class="lp-stamp" aria-hidden="true">
              <span class="text-xl font-black uppercase leading-none">{{ 'landing.pricingTeaser.receipt.stamp' | translate }}</span>
              <span class="text-[10px] font-bold uppercase mt-1">{{ 'landing.pricingTeaser.freeLabel' | translate }}</span>
            </p>
          </div>
        </div>
      </section>

      <!-- ===== 7. CLOSING — the pirogue, ready to leave ===== -->
      <section class="lp-section lp-band text-center">
        <div class="lp-wrap max-w-3xl">
          <div class="flex justify-center mb-10">
            <app-illustration name="activity" [width]="200" />
          </div>
          <h2 class="lp-title">{{ 'landing.closing.title' | translate }}</h2>
          <p class="lp-lead mx-auto">{{ 'landing.closing.subtitle' | translate }}</p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <a [href]="loginUrl" class="inner-button px-8 py-4">{{ 'landing.getStartedFree' | translate }}</a>
            <a routerLink="/pricing" class="outer-button px-8 py-4">{{ 'landing.viewPricing' | translate }}</a>
          </div>
          <p class="mt-8 text-sm text-text-tertiary">{{ 'landing.closing.note' | translate }}</p>
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

  protected readonly hosting = ['idem', 'own'];
  /** Keep in step with `grid-template-rows` in `.lp-fork` (one head + these rows). */
  protected readonly hostingRows = ['machine', 'care', 'data', 'fit'];

  protected readonly guards = ['firewall', 'pipeline', 'monitoring', 'alerts'];

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

  /** Entries in apps/ideploy-api/templates/service-templates.json. */
  protected readonly catalogueSize = 278;

  /**
   * The most widely used open-source tools of the catalogue, grouped by what
   * an entrepreneur needs them for. Every one is a real template, and every
   * logo was checked on both grounds: the white-only files are inked dark in
   * the light theme rather than left to vanish.
   */
  protected readonly serviceGroups: ServiceGroup[] = [
    {
      key: 'site',
      services: [
        { key: 'wordpress', name: 'WordPress', logo: 'wordpress.svg' },
        { key: 'strapi', name: 'Strapi', logo: 'strapi.svg' },
        { key: 'directus', name: 'Directus', logo: 'directus.svg' },
        { key: 'moodle', name: 'Moodle', logo: 'moodle.png' },
      ],
    },
    {
      key: 'business',
      services: [
        { key: 'odoo', name: 'Odoo', logo: 'odoo.svg', scale: 2 },
        { key: 'dolibarr', name: 'Dolibarr', logo: 'dolibarr.png' },
        { key: 'invoiceninja', name: 'Invoice Ninja', logo: 'invoiceninja.png' },
        { key: 'nextcloud', name: 'Nextcloud', logo: 'nextcloud.svg' },
      ],
    },
    {
      key: 'ai',
      services: [
        { key: 'n8n', name: 'n8n', logo: 'n8n.png', scale: 1.4 },
        { key: 'ollama', name: 'Ollama', logo: 'ollama.svg' },
        { key: 'openwebui', name: 'Open WebUI', logo: 'openwebui.svg' },
        { key: 'librechat', name: 'LibreChat', logo: 'librechat.svg' },
      ],
    },
    {
      key: 'backend',
      services: [
        { key: 'supabase', name: 'Supabase', logo: 'supabase.svg' },
        { key: 'appwrite', name: 'Appwrite', logo: 'appwrite.svg' },
        { key: 'pocketbase', name: 'PocketBase', logo: 'pocketbase.svg' },
        { key: 'nocodb', name: 'NocoDB', logo: 'nocodb.svg' },
      ],
    },
    {
      key: 'monitor',
      services: [
        { key: 'grafana', name: 'Grafana', logo: 'grafana.svg' },
        { key: 'uptimekuma', name: 'Uptime Kuma', logo: 'uptime-kuma.svg' },
        { key: 'umami', name: 'Umami', logo: 'umami.svg', whiteInk: true },
        { key: 'metabase', name: 'Metabase', logo: 'metabase.svg' },
      ],
    },
  ];

  protected readonly featuredCount = this.serviceGroups.reduce((n, g) => n + g.services.length, 0);

  ngOnInit(): void {
    void this.auth.ensureLoaded();
  }
}
