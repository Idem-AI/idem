import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BillingService } from '../../services/billing.service';
import { CheckoutComponent } from '../../components/checkout/checkout';
import { BillingEngine, BillingProduct } from '../../models/billing.model';
import { PRICING_DEFAULTS } from '@idem/shared-models/pricing/defaults';
import { annualPrice } from '@idem/shared-models/pricing/pricing';

/**
 * Les offres.
 *
 * Trois partis pris, tous tirés du modèle économique :
 *
 *  - **les moteurs sont séparés** : on choisit son offre iBusiness sans rien
 *    décider pour iCode ; les mélanger sur une seule grille laisserait croire
 *    à un plan unique ;
 *  - **l'achat ponctuel a le même rang que l'abonnement** — packs, recharges
 *    et passes pèsent autant dans le revenu, et c'est souvent par eux qu'on
 *    commence ;
 *  - **le prix local en regard** : « 1 999 F » ne dit rien ; « 1 999 F contre
 *    50 000 à 95 000 F chez un graphiste » dit tout.
 */
@Component({
  selector: 'app-billing-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TranslateModule, CheckoutComponent],
  template: `
    <div class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-text-primary">{{ 'billing.plans.title' | translate }}</h1>
          <p class="mt-1 text-sm text-text-secondary">{{ 'billing.plans.subtitle' | translate }}</p>
        </div>

        <!-- Mensuel / annuel : la remise « 2 mois offerts » est annoncée ici,
             pas cachée dans une note de bas de page. -->
        <div class="flex items-center gap-1 rounded-lg border border-[var(--color-border)] p-1">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm"
            [class.bg-primary]="interval() === 'month'"
            [class.text-white]="interval() === 'month'"
            [class.text-text-secondary]="interval() !== 'month'"
            (click)="interval.set('month')"
          >
            {{ 'billing.plans.monthly' | translate }}
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm"
            [class.bg-primary]="interval() === 'year'"
            [class.text-white]="interval() === 'year'"
            [class.text-text-secondary]="interval() !== 'year'"
            (click)="interval.set('year')"
          >
            {{ 'billing.plans.yearly' | translate }}
            <span class="ml-1 text-xs opacity-80">· {{ 'billing.plans.yearlyHint' | translate }}</span>
          </button>
        </div>
      </header>

      <!-- Prix affichés sans l'API : on le dit, plutôt que de laisser croire
           à un montant ferme. -->
      @if (billing.pricesIndicative()) {
        <p
          class="mb-6 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text-secondary"
          role="status"
        >
          <i class="pi pi-info-circle mt-0.5 text-warning"></i>
          <span>{{ 'billing.plans.indicativePrices' | translate }}</span>
        </p>
      }

      <!-- Abonnements, moteur par moteur -->
      @for (engine of engines; track engine) {
        <section class="mb-8">
          <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-tertiary">
            {{ engineLabel(engine) }}
          </h2>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            @for (product of subscriptionsOf(engine); track product.code) {
              <div
                class="flex flex-col rounded-xl border bg-[var(--color-surface-1)] p-4"
                [class.border-primary]="product.highlighted"
                [class.border-[var(--color-border)]]="!product.highlighted"
              >
                <p class="text-sm font-semibold text-text-primary">{{ product.name }}</p>

                <p class="mt-2">
                  <span class="text-2xl font-bold tabular-nums text-text-primary">
                    {{ displayPrice(product) | number: '1.0-0' }}
                  </span>
                  <span class="text-sm text-text-tertiary">
                    F{{ (interval() === 'year' ? 'billing.plans.perYear' : 'billing.plans.perMonth') | translate }}
                  </span>
                </p>

                @if (product.credits > 0) {
                  <p class="mt-1 text-xs text-text-secondary">
                    {{ 'billing.plans.credits' | translate: { count: product.credits } }}
                  </p>
                }

                @if (product.description) {
                  <p class="mt-2 text-xs text-text-tertiary">{{ product.description }}</p>
                }

                @if (product.features?.length) {
                  <ul class="mt-3 space-y-1">
                    @for (feature of product.features; track feature) {
                      <li class="flex gap-2 text-xs text-text-secondary">
                        <i class="pi pi-check mt-0.5 text-[10px] text-success"></i>
                        <span>{{ feature }}</span>
                      </li>
                    }
                  </ul>
                }

                <div class="mt-auto pt-4">
                  @if (isCurrent(product.code)) {
                    <span class="block rounded-lg border border-success/40 px-3 py-2 text-center text-sm text-success">
                      {{ 'billing.plans.currentPlan' | translate }}
                    </span>
                  } @else if (product.priceXaf === 0) {
                    <span class="block px-3 py-2 text-center text-xs text-text-tertiary">—</span>
                  } @else {
                    <button
                      type="button"
                      class="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                      (click)="buy(product)"
                    >
                      {{ 'billing.plans.choose' | translate }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }

      <!-- Achats ponctuels -->
      @for (group of oneTimeGroups(); track group.key) {
        @if (group.products.length > 0) {
          <section class="mb-8">
            <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-tertiary">
              {{ group.labelKey | translate }}
            </h2>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              @for (product of group.products; track product.code) {
                <div class="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
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
                    <p class="mt-2 text-xs text-text-tertiary italic">
                      {{ 'billing.plans.localAlternative' | translate: { price: product.localAlternative } }}
                    </p>
                  }

                  <div class="mt-auto pt-4">
                    <button
                      type="button"
                      class="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                      (click)="buy(product)"
                    >
                      {{ 'billing.plans.buy' | translate }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </section>
        }
      }

      <!-- Paiement, en surcouche : on ne quitte pas la grille des offres -->
      @if (selected(); as product) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" (click)="close()">
          <div class="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-dark)] p-5" (click)="$event.stopPropagation()">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-base font-semibold text-text-primary">
                {{ 'billing.checkout.title' | translate }}
              </h2>
              <button type="button" class="text-text-tertiary hover:text-text-primary" (click)="close()">
                <i class="pi pi-times"></i>
              </button>
            </div>

            <app-checkout
              [productCode]="product.code"
              [engine]="product.engine ?? undefined"
              [interval]="product.interval === 'one_time' ? undefined : interval()"
              (completed)="onPaid()"
              (dismissed)="close()"
            ></app-checkout>
          </div>
        </div>
      }
    </div>
  `,
})
export class BillingPlansPage {
  // Lu par le gabarit (bandeau « prix indicatifs ») : donc protégé, pas privé.
  protected readonly billing = inject(BillingService);
  private readonly route = inject(ActivatedRoute);

  readonly engines: BillingEngine[] = ['business', 'appgen', 'ideploy'];
  readonly interval = signal<'month' | 'year'>('month');
  readonly selected = signal<BillingProduct | null>(null);

  private readonly products = computed(() => this.billing.catalog()?.products ?? []);

  /** Achats ponctuels, groupés comme sur la page publique. */
  readonly oneTimeGroups = computed(() => [
    {
      key: 'packs',
      labelKey: 'billing.plans.packs',
      products: this.products().filter((product) => product.kind === 'pack'),
    },
    {
      key: 'recharges',
      labelKey: 'billing.plans.recharges',
      products: this.products().filter((product) => product.kind === 'recharge'),
    },
    {
      key: 'bundles',
      labelKey: 'billing.plans.bundles',
      products: this.products().filter((product) => product.kind === 'bundle'),
    },
    {
      key: 'addons',
      labelKey: 'billing.plans.addons',
      products: this.products().filter((product) => product.kind === 'addon'),
    },
  ]);

  constructor() {
    this.billing.loadCatalog().subscribe();
    this.billing.loadMe().subscribe();

    // `/billing/plans?engine=appgen` depuis « Mon offre » : la page s'ouvre
    // sur le moteur concerné plutôt qu'en haut de la grille.
    const engine = this.route.snapshot.queryParamMap.get('engine');
    if (engine) {
      setTimeout(() => {
        document.getElementById(`engine-${engine}`)?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
  }

  subscriptionsOf(engine: BillingEngine): BillingProduct[] {
    return this.products()
      .filter((product) => product.kind === 'subscription' && product.engine === engine)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  /**
   * Prix affiché selon la périodicité.
   *
   * L'annuel passe par la règle partagée avec l'API (`annualPrice`) plutôt que
   * par une copie locale de la formule : un taux recopié finit par diverger,
   * et l'écart se découvre au moment de payer.
   */
  displayPrice(product: BillingProduct): number {
    if (this.interval() === 'year' && product.interval === 'month') {
      return annualPrice(product.priceXaf, PRICING_DEFAULTS, true);
    }
    return product.priceXaf;
  }

  isCurrent(productCode: string): boolean {
    return (this.billing.me()?.subscriptions ?? []).some(
      (subscription) => subscription.productCode === productCode,
    );
  }

  engineLabel(engine: BillingEngine): string {
    return { business: 'iBusiness', appgen: 'iCode', ideploy: 'iDeploy' }[engine];
  }

  buy(product: BillingProduct): void {
    this.selected.set(product);
  }

  close(): void {
    this.selected.set(null);
  }

  onPaid(): void {
    this.selected.set(null);
    this.billing.loadMe().subscribe();
  }
}
