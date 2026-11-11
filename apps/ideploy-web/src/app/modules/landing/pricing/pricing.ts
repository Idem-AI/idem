import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { PaySectionComponent, PayStripComponent, PromoPriceComponent, PromotionsStore } from '@idem/shared-promotions/angular';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LandingNavComponent } from '../shared/landing-nav';
import { LandingFooterComponent } from '../shared/landing-footer';
import { AuthService } from '../../../shared/services/auth.service';
import { IllustrationComponent } from '../../../shared/components/illustration/illustration';
import { environment } from '../../../../environments/environment';

type MeterTier = 'veille' | 'vitrine' | 'application' | 'application_plus';

interface Meter {
  tier: MeterTier;
  /** Prix de secours au jour (l'API fait foi : `meter:<tier>`). */
  fallbackXaf: number;
  recommended: boolean;
}

/**
 * Tarifs publics d'iDeploy. Une idée par écran : une application = un compteur payé au jour
 * depuis le portefeuille IDEM. On choisit son compteur (chacun a son bouton, qui mène au
 * réglage des compteurs, connexion d'abord si besoin), on voit comment on paie, puis les
 * options et la comparaison pour qui veut le détail.
 *
 * Montants : lus sur l'API (grille réglée dans le panel admin, ce que l'API débite vraiment) ;
 * ceux écrits ici ne servent que de secours.
 *
 * Refonte du 11/11/2026 (psychologie des prix) : le prix au jour en grand et le mois en petit
 * (« pennies-a-day », Gourville 1998 : 10 F par jour pèse moins que 300 F par mois), la Veille
 * gratuite en premier (effet du prix zéro), les options du moins cher au plus cher (effet d'ordre),
 * et la comparaison avec les hébergeurs connus comme prix d'ancrage.
 */
@Component({
  selector: 'app-pricing',
  imports: [TranslateModule, LandingNavComponent, LandingFooterComponent, IllustrationComponent, PromoPriceComponent, PaySectionComponent, PayStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* « En ligne ce soir » : une bande de nuit (la surface teintée du bleu de la marque), étoilée. */
    .tonight {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      margin-bottom: 7rem;
      padding: clamp(4rem, 9vw, 7rem) 1.5rem clamp(3.5rem, 7vw, 5.5rem);
      background: color-mix(in srgb, var(--color-primary-500) 12%, var(--color-surface-1));
      border-block: 1px solid var(--glass-border);
    }
    .tonight-stars {
      position: absolute;
      inset: 0;
      z-index: -1;
      opacity: 0.55;
      background-image:
        radial-gradient(1.5px 1.5px at 12% 18%, var(--color-text-primary) 50%, transparent 51%),
        radial-gradient(1px 1px at 28% 8%, var(--color-text-primary) 50%, transparent 51%),
        radial-gradient(1.5px 1.5px at 46% 26%, var(--color-text-primary) 50%, transparent 51%),
        radial-gradient(1px 1px at 63% 12%, var(--color-text-primary) 50%, transparent 51%),
        radial-gradient(1.5px 1.5px at 81% 22%, var(--color-text-primary) 50%, transparent 51%),
        radial-gradient(1px 1px at 92% 6%, var(--color-text-primary) 50%, transparent 51%),
        radial-gradient(1px 1px at 6% 40%, var(--color-text-primary) 50%, transparent 51%);
    }
    .tonight-inner {
      max-width: 72rem;
      margin-inline: auto;
    }
    .tonight-head {
      display: grid;
      gap: 2rem;
      align-items: end;
    }
    @media (min-width: 900px) {
      .tonight-head {
        grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
      }
    }
    .tonight-title {
      margin: 0;
      font-size: clamp(2.4rem, 5.6vw, 4.5rem);
      line-height: 1.02;
      font-weight: 900;
      letter-spacing: -0.03em;
      text-wrap: balance;
    }
    .tonight-lead {
      margin: 1.25rem 0 0;
      max-width: 36rem;
      font-size: 1.15rem;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }
    .tonight-art {
      justify-self: center;
      width: min(100%, 26rem);
      color: var(--color-text-primary);
      margin-bottom: -1.5rem;
    }

    /* La guirlande. Sur téléphone, la corde devient verticale et les lampes se suivent. */
    .garland {
      position: relative;
      display: grid;
      gap: 2.25rem;
      margin: 3rem 0 0;
      padding: 0 0 0 2.75rem;
      list-style: none;
      border-left: 2px solid var(--glass-border);
    }
    .garland-cord {
      display: none;
    }
    .lamp {
      position: relative;
    }
    .lamp-string {
      display: none;
    }
    .lamp-icon {
      position: absolute;
      left: -4.1rem;
      top: -0.25rem;
      width: 2.6rem;
      height: 3.4rem;
      padding: 0.2rem;
      color: var(--color-text-tertiary);
      background: color-mix(in srgb, var(--color-primary-500) 12%, var(--color-surface-1));
    }
    .lamp-flame {
      fill: none;
      stroke: currentColor;
    }
    @media (min-width: 820px) {
      .garland {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 2.5rem;
        margin-top: 2.5rem;
        padding: 0;
        border-left: 0;
      }
      .garland-cord {
        display: block;
        position: absolute;
        inset: 0 0 auto;
        width: 100%;
        height: 3.75rem;
        color: var(--color-text-tertiary);
      }
      .lamp {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding-top: var(--drop);
      }
      .lamp-string {
        display: block;
        width: 1.5px;
        height: 2.5rem;
        background: var(--color-text-tertiary);
      }
      .lamp-icon {
        position: static;
        width: 3.4rem;
        height: 4.5rem;
        padding: 0;
        background: none;
      }
    }
    .lamp-when {
      margin: 0.75rem 0 0;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--color-text-tertiary);
    }
    .lamp-title {
      margin: 0.2rem 0 0;
      font-size: 1.15rem;
      font-weight: 800;
    }
    .lamp-text {
      margin: 0.35rem 0 0;
      max-width: 19rem;
      font-size: 0.95rem;
      line-height: 1.55;
      color: var(--color-text-secondary);
    }
    /* La lampe allumée : la flamme pleine, la lueur autour, un léger vacillement. */
    .lamp-lit .lamp-icon {
      color: var(--color-primary-500);
      filter: drop-shadow(0 0 14px color-mix(in srgb, var(--color-primary-500) 70%, transparent));
    }
    .lamp-lit .lamp-flame {
      fill: currentColor;
      transform-origin: 12px 19px;
      animation: flicker 2.4s ease-in-out infinite;
    }
    .lamp-lit .lamp-when {
      color: var(--color-primary-500);
    }
    @keyframes flicker {
      0%, 100% { transform: scale(1); opacity: 1; }
      45% { transform: scale(0.92, 1.06); opacity: 0.85; }
      70% { transform: scale(1.04, 0.96); opacity: 0.95; }
    }

    /* L'enseigne : l'adresse, allumée, puis l'action. */
    .sign {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 1.25rem 2rem;
      margin-top: clamp(3rem, 6vw, 4.5rem);
      padding-top: 2.5rem;
      border-top: 1px dashed var(--glass-border);
    }
    .sign-address {
      display: inline-flex;
      max-width: 100%;
      align-items: center;
      gap: 0.65rem;
      margin: 0;
      padding: 0.85rem 1.35rem;
      border-radius: 999px;
      background: var(--color-surface-1);
      border: 1.5px solid var(--color-primary-500);
      box-shadow: 0 0 40px -8px color-mix(in srgb, var(--color-primary-500) 65%, transparent);
      font-size: clamp(1rem, 2.4vw, 1.25rem);
    }
    .sign-address svg {
      width: 1.1rem;
      height: 1.1rem;
      flex: none;
      color: var(--color-success);
    }
    .sign-url {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 800;
    }
    .sign-live {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--color-success);
    }
    .sign-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--color-success);
    }
    .sign-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1.25rem;
    }
    .sign-note {
      font-size: 0.9rem;
      color: var(--color-text-secondary);
    }
    @media (prefers-reduced-motion: reduce) {
      .lamp-lit .lamp-flame {
        animation: none;
      }
    }
  `,
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
            <idem-pay-strip class="mt-6 block" [lang]="translate.currentLang" />
          </div>
          <app-illustration name="mortar" [width]="0" class="mx-auto hidden w-full max-w-[34rem] text-text-tertiary sm:block" />
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
                <p class="mt-3 flex items-baseline gap-1">
                  @if (dayXaf(meter) === 0) {
                    <span class="text-4xl font-black tabular-nums">0</span><span class="text-base font-semibold text-text-secondary">&#8239;F</span>
                  } @else {
                    <span class="text-4xl font-black tabular-nums"><idem-promo-price item="ideploy.meter" [xaf]="dayXaf(meter)" unit="" [showBadge]="false" /></span><span class="text-base font-semibold text-text-secondary">&#8239;F</span>
                  }
                  <span class="text-sm text-text-secondary">{{ 'pricing.perDay' | translate }}</span>
                </p>
                <p class="mt-1 text-sm font-semibold text-primary-500">
                  @if (dayXaf(meter) === 0) {
                    {{ 'pricing.meters.' + meter.tier + '.monthly' | translate }}
                  } @else {
                    {{ 'pricing.monthlyApprox' | translate: { amount: amount(dayXaf(meter) * 30) } }}
                  }
                </p>
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

      <!-- Comment payer : la même section sur toutes les landings (mobile money, sans abonnement) -->
      <div class="my-16 px-6">
        <idem-pay-section class="mx-auto block max-w-6xl" [ctaHref]="loginUrl" [lang]="translate.currentLang" />
      </div>

      <!-- Les options à la journée : une liste, pas une grille -->
      <section class="border-t border-[var(--glass-border-subtle)] px-6 py-24">
        <div class="mx-auto max-w-6xl">
          <h2 class="mb-2 text-balance text-3xl font-black">{{ 'pricing.optionsTitle' | translate }}</h2>
          <p class="mb-8 max-w-2xl text-text-secondary">{{ 'pricing.managedSubtitle' | translate }}</p>
          <dl class="grid gap-x-12 md:grid-cols-2">
            @for (option of sortedOptions(); track option.key) {
              <div class="flex items-baseline justify-between gap-6 border-b border-[var(--glass-border-subtle)] py-4">
                <dt>
                  <span class="block font-semibold">{{ 'pricing.options.' + option.key | translate }}</span>
                  <span class="block text-sm text-text-secondary">{{ 'pricing.options.' + option.key + 'Note' | translate }}</span>
                </dt>
                <dd class="flex-none font-bold tabular-nums">{{ amount(option.xaf) }}&#8239;F<span class="text-sm font-normal text-text-secondary">{{ 'pricing.perDay' | translate }}</span></dd>
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
                @for (row of comparison(); track row.resource) {
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

      <!-- Dernier appel : « en ligne ce soir ». Une scène de nuit : l'étal du marché éclairé par sa
           lampe, puis les trois gestes pendus comme des lampes le long d'une corde tendue d'un
           bord à l'autre. La dernière est allumée (le site est en ligne) et mène à l'enseigne :
           l'adresse offerte, telle qu'elle s'affichera. -->
      <section class="tonight" aria-labelledby="tonight-title">
        <div class="tonight-stars" aria-hidden="true"></div>
        <div class="tonight-inner">
          <div class="tonight-head">
            <div>
              <h2 id="tonight-title" class="tonight-title">{{ 'pricing.ctaTitle' | translate }}</h2>
              <p class="tonight-lead">{{ 'pricing.ctaSubtitle' | translate }}</p>
            </div>
            <app-illustration name="night-stall" [width]="0" class="tonight-art" />
          </div>

          <!-- La guirlande : une corde, trois lampes, la dernière allumée. -->
          <ol class="garland">
            <svg class="garland-cord" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 6 Q166 58 333 22 Q500 -6 666 22 Q833 58 1000 6" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            @for (step of tonightSteps; track step; let i = $index; let last = $last) {
              <li class="lamp" [class.lamp-lit]="last" [style.--drop]="i === 1 ? '0.25rem' : '2.25rem'">
                <span class="lamp-string" aria-hidden="true"></span>
                <svg class="lamp-icon" viewBox="0 0 24 32" aria-hidden="true">
                  <path d="M8 7 C8 2 16 2 16 7" fill="none" stroke="currentColor" stroke-width="1.6" />
                  <path d="M6.5 7 H17.5 L15.8 9.6 H8.2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                  <path d="M8.2 9.6 C4.4 13 4.4 19.5 8.2 23 H15.8 C19.6 19.5 19.6 13 15.8 9.6" fill="none" stroke="currentColor" stroke-width="1.6" />
                  <path d="M7 23 H17 V26 H7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                  <path class="lamp-flame" d="M12 12.5 C14.6 15 14.2 18.4 12 19.6 C9.8 18.4 9.4 15 12 12.5Z" stroke-width="1.5" />
                </svg>
                <p class="lamp-when">{{ 'pricing.tonight.' + step + '.when' | translate }}</p>
                <p class="lamp-title">{{ 'pricing.tonight.' + step + '.title' | translate }}</p>
                <p class="lamp-text">{{ 'pricing.tonight.' + step + '.text' | translate }}</p>
              </li>
            }
          </ol>

          <!-- L'enseigne : l'adresse offerte, allumée, et l'action. -->
          <div class="sign">
            <p class="sign-address">
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
              <span class="sign-url">{{ 'pricing.tonight.url' | translate }}</span>
              <span class="sign-live"><span class="sign-dot" aria-hidden="true"></span>{{ 'pricing.tonight.live' | translate }}</span>
            </p>
            <div class="sign-actions">
              <a [href]="loginUrl" class="inner-button button-lg">{{ 'pricing.getStartedFree' | translate }}</a>
              <span class="sign-note">{{ 'pricing.tonight.note' | translate }}</span>
            </div>
          </div>
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
  protected readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  /** « En ligne ce soir » : les trois gestes, du code au site allumé. */
  protected readonly tonightSteps = ['connect', 'address', 'online'] as const;

  protected readonly loginUrl = `${environment.services.console.url}/login?redirect=ideploy`;

  private readonly promotions = inject(PromotionsStore);

  protected readonly meters: Meter[] = [
    { tier: 'veille', fallbackXaf: 0, recommended: false },
    { tier: 'vitrine', fallbackXaf: 10, recommended: true },
    { tier: 'application', fallbackXaf: 50, recommended: false },
    { tier: 'application_plus', fallbackXaf: 150, recommended: false },
  ];
  protected readonly features = [1, 2, 3, 4];

  /** Prix au jour d'un compteur, lu sur l'API. */
  protected dayXaf(meter: Meter): number {
    return meter.fallbackXaf === 0 ? 0 : this.promotions.offerPrice(`meter:${meter.tier}`, meter.fallbackXaf);
  }

  protected amount(value: number): string {
    return value.toLocaleString('fr-FR');
  }

  /** Options à la journée, sur n'importe quel compteur payant (prix de secours ; l'API fait foi). */
  private readonly options = [
    { key: 'backups', code: 'backups', xaf: 35 },
    { key: 'monitoring', code: 'monitoring', xaf: 35 },
    { key: 'database', code: 'database', xaf: 35 },
    { key: 'logs', code: 'logs', xaf: 15 },
    { key: 'waf', code: 'waf', xaf: 50 },
    { key: 'autoscaling', code: 'autoscaling', xaf: 70 },
    { key: 'staticIp', code: 'static_ip', xaf: 70 },
    { key: 'sovereign', code: 'sovereign', xaf: 70 },
  ];

  /** Du moins cher au plus cher : le premier prix lu sert de référence. */
  protected readonly sortedOptions = computed(() =>
    this.options
      .map((option) => ({ ...option, xaf: this.promotions.offerPrice(`meter-option:${option.code}`, option.xaf) }))
      .sort((a, b) => a.xaf - b.xaf)
  );

  /**
   * Face aux hébergeurs connus (prix relevés en septembre 2026, 575 F le dollar ; `null` = l'offre
   * n'existe pas) : notre colonne est calculée sur nos prix réels, au mois.
   */
  protected readonly comparison = computed(() => {
    const vitrine = this.promotions.offerPrice('meter:vitrine', 10) * 30;
    const application = this.promotions.offerPrice('meter:application', 50) * 30;
    return [
      { resource: 'pricing.compare.showcase', unit: 'pricing.perMonth', values: [`${this.amount(vitrine)} F`, '11 500 F', '2 900 F'] },
      { resource: 'pricing.compare.app', unit: 'pricing.perMonth', values: [`${this.amount(application)} F`, '11 500 F', '~2 900 F'] },
      { resource: 'pricing.compare.deployments', unit: null, values: ['pricing.compare.unlimited', 'pricing.compare.unlimited', 'pricing.compare.unlimited'] },
      { resource: 'pricing.compare.domain', unit: 'pricing.perYear', values: ['6 500 F', '~11 500 F', null] },
    ];
  });

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
