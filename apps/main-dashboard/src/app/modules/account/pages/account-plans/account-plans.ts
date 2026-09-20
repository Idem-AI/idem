import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { PRICING_DEFAULTS } from '@idem/shared-models/pricing/defaults';
import { annualPrice } from '@idem/shared-models/pricing/pricing';
import { BillingService } from '../../../billing/services/billing.service';
import { BillingEngine, BillingProduct } from '../../../billing/models/billing.model';
import { BILLING_ENGINES, ENGINE_LABELS, EnginePlanView } from '../../../billing/models/plan.model';

/**
 * Les offres, présentées comme une échelle.
 *
 * L'ancienne page posait les quarante-deux produits du catalogue sur un seul
 * écran : trois grilles d'abonnements, puis les packs, les recharges, les
 * offres groupées et les options. Tout y était, et c'est précisément ce qui la
 * rendait illisible — rien n'indiquait où l'on se trouvait ni ce qu'il fallait
 * prendre.
 *
 * Trois décisions corrigent cela :
 *
 *  - **un moteur à la fois.** On ne choisit pas son offre iCode au moment où
 *    l'on regarde iBusiness ; les afficher ensemble ne fait que multiplier les
 *    candidats.
 *  - **l'échelle est orientée.** L'offre en cours est marquée, ce qui est
 *    au-dessus s'achète, ce qui est en dessous est estompé — et le seul geste
 *    mis en avant est l'échelon immédiatement supérieur.
 *  - **l'achat ponctuel est second.** Packs et recharges restent accessibles,
 *    mais après l'échelle : ils répondent à « il me manque des crédits », pas
 *    à « quelle offre je prends ».
 */
@Component({
  selector: 'app-account-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <!-- Prix affichés sans l'API : on le dit, plutôt que de laisser croire à un
         montant ferme. -->
    @if (billing.pricesIndicative()) {
      <p
        class="mb-5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text-secondary"
        role="status"
      >
        <i class="pi pi-info-circle mt-0.5 text-warning" aria-hidden="true"></i>
        <span>{{ 'billing.plans.indicativePrices' | translate }}</span>
      </p>
    }

    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <!-- Moteur -->
      <div class="flex gap-1 rounded-lg border border-[var(--glass-border)] p-1">
        @for (engine of engines; track engine) {
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm transition-colors"
            [class]="
              selectedEngine() === engine
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary'
            "
            (click)="selectedEngine.set(engine)"
          >
            {{ engineLabels[engine] }}
          </button>
        }
      </div>

      <!-- Périodicité : la remise annuelle est annoncée sur le bouton, pas en
           note de bas de page. -->
      <div class="flex gap-1 rounded-lg border border-[var(--glass-border)] p-1">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          [class]="interval() === 'month' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
          (click)="interval.set('month')"
        >
          {{ 'billing.plans.monthly' | translate }}
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          [class]="interval() === 'year' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
          (click)="interval.set('year')"
        >
          {{ 'billing.plans.yearly' | translate }}
          <span class="ml-1 text-xs opacity-80">· {{ 'billing.plans.yearlyHint' | translate }}</span>
        </button>
      </div>
    </div>

    @if (activePlan(); as plan) {
      <!-- L'échelle -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        @for (rung of rungs(); track rung.product.code) {
          <div
            class="flex flex-col rounded-xl border bg-[var(--color-surface-1)] p-4 transition-opacity"
            [class]="rungClass(rung)"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-semibold text-text-primary">{{ rung.product.name }}</p>

              @if (rung.position === 'current') {
                <span class="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                  {{ 'account.yourPlan' | translate }}
                </span>
              } @else if (rung.position === 'next') {
                <span class="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {{ 'account.nextStep' | translate }}
                </span>
              }
            </div>

            <p class="mt-2">
              <span class="text-2xl font-bold tabular-nums text-text-primary">
                {{ displayPrice(rung.product) | number: '1.0-0' }}
              </span>
              <span class="text-sm text-text-tertiary">
                F{{ (interval() === 'year' ? 'billing.plans.perYear' : 'billing.plans.perMonth') | translate }}
              </span>
            </p>

            @if (rung.product.credits > 0) {
              <p class="mt-1 text-xs text-text-secondary">
                {{ 'billing.plans.credits' | translate: { count: rung.product.credits } }}
              </p>
            }

            @if (rung.product.description) {
              <p class="mt-2 text-xs text-text-tertiary">{{ rung.product.description }}</p>
            }

            @if (rung.product.features?.length) {
              <ul class="mt-3 space-y-1">
                @for (feature of rung.product.features; track feature) {
                  <li class="flex gap-2 text-xs text-text-secondary">
                    <i class="pi pi-check mt-0.5 text-[10px] text-success" aria-hidden="true"></i>
                    <span>{{ feature }}</span>
                  </li>
                }
              </ul>
            }

            <div class="mt-auto pt-4">
              @switch (rung.position) {
                @case ('current') {
                  <span class="block rounded-lg border border-success/40 px-3 py-2 text-center text-sm text-success">
                    {{ 'billing.plans.currentPlan' | translate }}
                  </span>
                }
                @case ('below') {
                  <!-- Une offre inférieure n'est pas un choix à mettre en
                       avant, mais l'interdire enfermerait l'abonné dans son
                       palier. Lien discret, et la conséquence est écrite. -->
                  <a
                    class="block px-3 py-2 text-center text-xs text-text-tertiary underline-offset-2 hover:text-text-secondary hover:underline"
                    [routerLink]="['/billing/checkout']"
                    [queryParams]="checkoutParams(rung.product)"
                  >
                    {{ 'account.switchDown' | translate }}
                  </a>
                }
                @default {
                  <a
                    class="block rounded-lg px-3 py-2 text-center text-sm font-semibold transition-opacity hover:opacity-90"
                    [class]="
                      rung.position === 'next'
                        ? 'bg-primary text-white'
                        : 'border border-[var(--glass-border-medium)] text-text-primary'
                    "
                    [routerLink]="['/billing/checkout']"
                    [queryParams]="checkoutParams(rung.product)"
                  >
                    {{ 'billing.plans.choose' | translate }}
                  </a>
                }
              }
            </div>
          </div>
        }
      </div>

      @if (hasLowerRung()) {
        <p class="mt-3 text-xs text-text-tertiary">
          {{ 'account.switchDownNote' | translate }}
        </p>
      }

      <!-- Achats ponctuels, après l'échelle -->
      @for (group of oneTimeGroups(); track group.key) {
        @if (group.products.length > 0) {
          <section class="mt-8" [id]="group.key">
            <h2 class="mb-1 text-sm font-medium uppercase tracking-wide text-text-tertiary">
              {{ group.labelKey | translate }}
            </h2>
            <p class="mb-3 text-xs text-text-tertiary">{{ group.hintKey | translate }}</p>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              @for (product of group.products; track product.code) {
                <div class="flex flex-col rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-4">
                  <p class="text-sm font-semibold text-text-primary">{{ product.name }}</p>

                  <p class="mt-2">
                    <span class="text-xl font-bold tabular-nums text-text-primary">
                      {{ product.priceXaf | number: '1.0-0' }}
                    </span>
                    <span class="text-sm text-text-tertiary">F</span>
                    @if (product.discountLabel) {
                      <span class="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        {{ product.discountLabel }}
                      </span>
                    }
                  </p>

                  @if (product.credits > 0) {
                    <p class="mt-1 text-xs text-text-secondary">
                      {{ 'billing.plans.credits' | translate: { count: product.credits } }}
                    </p>
                  }

                  @if (product.description) {
                    <p class="mt-2 text-xs text-text-tertiary">{{ product.description }}</p>
                  }

                  <!-- Le prix d'un prestataire local : l'argument qui fait
                       basculer, bien plus que la liste des fonctionnalités. -->
                  @if (product.localAlternative) {
                    <p class="mt-2 text-xs italic text-text-tertiary">
                      {{ 'billing.plans.localAlternative' | translate: { price: product.localAlternative } }}
                    </p>
                  }

                  <div class="mt-auto pt-4">
                    <a
                      class="block rounded-lg border border-[var(--glass-border-medium)] px-3 py-2 text-center text-sm font-semibold text-text-primary transition-colors hover:border-primary"
                      [routerLink]="['/billing/checkout']"
                      [queryParams]="checkoutParams(product)"
                    >
                      {{ 'billing.plans.buy' | translate }}
                    </a>
                  </div>
                </div>
              }
            </div>
          </section>
        }
      }
    } @else {
      <div class="h-48 animate-pulse rounded-xl bg-[var(--color-surface-2)]"></div>
    }
  `,
})
export class AccountPlansPage {
  // Lu par le gabarit (bandeau « prix indicatifs ») : protégé, pas privé.
  protected readonly billing = inject(BillingService);
  private readonly route = inject(ActivatedRoute);

  protected readonly engines = BILLING_ENGINES;
  protected readonly engineLabels = ENGINE_LABELS;

  protected readonly selectedEngine = signal<BillingEngine>('business');
  protected readonly interval = signal<'month' | 'year'>('month');

  private readonly queryParams = toSignal(this.route.queryParamMap);

  /** L'offre du moteur affiché — c'est elle qui oriente l'échelle. */
  protected readonly activePlan = computed<EnginePlanView | null>(
    () => this.billing.plans().find((plan) => plan.engine === this.selectedEngine()) ?? null,
  );

  /**
   * Chaque échelon, situé par rapport à l'offre en cours.
   *
   * `next` est distingué de `above` pour n'appuyer qu'un seul bouton : deux
   * boutons pleins côte à côte reposent la question du choix au lieu d'y
   * répondre.
   */
  protected readonly rungs = computed(() => {
    const plan = this.activePlan();
    if (!plan) return [];

    return plan.ladder.map((product, index) => ({
      product,
      position: positionOf(index, plan),
    }));
  });

  protected readonly hasLowerRung = computed(() =>
    this.rungs().some((rung) => rung.position === 'below'),
  );

  private readonly products = computed(() => this.billing.catalog()?.products ?? []);

  /**
   * Achats ponctuels du moteur affiché, plus ceux qui valent pour tous
   * (recharges, offres groupées). Un pack iBusiness n'a rien à faire sous
   * l'échelle iDeploy.
   */
  protected readonly oneTimeGroups = computed(() => {
    const engine = this.selectedEngine();
    const scoped = (kind: string) =>
      this.products().filter(
        (product) => product.kind === kind && (product.engine === engine || product.engine === null),
      );

    return [
      {
        key: 'packs',
        labelKey: 'billing.plans.packs',
        hintKey: 'account.packsHint',
        products: [...scoped('pack'), ...scoped('project_pass'), ...scoped('day_pass')],
      },
      {
        key: 'recharges',
        labelKey: 'billing.plans.recharges',
        hintKey: 'account.rechargesHint',
        products: scoped('recharge'),
      },
      {
        key: 'bundles',
        labelKey: 'billing.plans.bundles',
        hintKey: 'account.bundlesHint',
        products: scoped('bundle'),
      },
      {
        key: 'addons',
        labelKey: 'billing.plans.addons',
        hintKey: 'account.addonsHint',
        products: scoped('addon'),
      },
    ];
  });

  constructor() {
    // `?engine=appgen` depuis l'aperçu ou une alerte : la page s'ouvre sur le
    // moteur concerné plutôt qu'en haut de la grille.
    effect(() => {
      const engine = this.queryParams()?.get('engine');
      if (engine === 'business' || engine === 'appgen' || engine === 'ideploy') {
        this.selectedEngine.set(engine);
      }
    });

    // `?focus=recharges` depuis l'alerte « crédits au plus bas » : on amène
    // l'utilisateur là où se trouve la réponse à son problème.
    effect(() => {
      const focus = this.queryParams()?.get('focus');
      if (!focus) return;

      setTimeout(() => {
        document.getElementById(focus)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    });
  }

  /**
   * Prix affiché selon la périodicité.
   *
   * L'annuel passe par la règle partagée avec l'API (`annualPrice`) plutôt que
   * par une copie locale de la formule : un taux recopié finit par diverger, et
   * l'écart se découvre au moment de payer.
   */
  protected displayPrice(product: BillingProduct): number {
    if (this.interval() === 'year' && product.interval === 'month') {
      return annualPrice(product.priceXaf, PRICING_DEFAULTS, true);
    }
    return product.priceXaf;
  }

  /**
   * Paramètres du paiement.
   *
   * Aucun montant n'y figure : l'écran de paiement envoie un code produit et
   * l'API calcule le prix. Une interface qui transporterait la somme
   * ouvrirait la porte à un prix choisi par le client.
   */
  protected checkoutParams(product: BillingProduct): Record<string, string> {
    const params: Record<string, string> = { product: product.code };

    if (product.engine) params['engine'] = product.engine;
    if (product.interval !== 'one_time') params['interval'] = this.interval();

    return params;
  }

  protected rungClass(rung: { position: string }): string {
    switch (rung.position) {
      case 'current':
        return 'border-success/50';
      case 'next':
        return 'border-primary';
      case 'below':
        return 'border-[var(--glass-border)] opacity-60';
      default:
        return 'border-[var(--glass-border)]';
    }
  }
}

type RungPosition = 'below' | 'current' | 'next' | 'above';

/**
 * Situe un échelon.
 *
 * Quand l'offre souscrite ne figure plus dans le catalogue (`currentIndex` à
 * -1), aucun échelon n'est « en dessous » : on ne sait pas comparer, et
 * estomper la moitié de la grille sur une supposition serait pire que de tout
 * montrer à égalité.
 */
function positionOf(index: number, plan: EnginePlanView): RungPosition {
  if (plan.currentIndex < 0) return 'above';
  if (index === plan.currentIndex) return 'current';
  if (index < plan.currentIndex) return 'below';
  if (index === plan.currentIndex + 1 && plan.next) return 'next';
  return 'above';
}
