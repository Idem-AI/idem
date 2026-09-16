import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BillingService } from '../../services/billing.service';
import {
  BillingEngine,
  EngineSubscription,
  PaymentView,
} from '../../models/billing.model';

/**
 * « Mon offre » : ce dont l'utilisateur dispose, et ce qu'il doit faire.
 *
 * L'ordre de la page est celui de l'urgence : d'abord ce qui appelle une
 * action (une échéance dépassée, une bêta qui se termine), puis les compteurs
 * de crédits, puis les plans, puis l'historique. Une page de facturation qui
 * commence par un tableau ne dit pas à l'utilisateur ce qu'il doit faire.
 */
@Component({
  selector: 'app-billing-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-text-primary">{{ 'billing.overview.title' | translate }}</h1>
        <p class="mt-1 text-sm text-text-secondary">{{ 'billing.overview.subtitle' | translate }}</p>
      </header>

      <!-- Ce qui appelle une action, en premier -->
      @for (subscription of pastDue(); track subscription.engine) {
        <div class="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-text-primary">
                {{ engineLabel(subscription.engine) }} —
                {{ 'billing.overview.pastDue' | translate: { date: (subscription.graceEndsAt | date: 'dd/MM/yyyy') } }}
              </p>
            </div>
            <a
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              [routerLink]="['/billing/checkout']"
              [queryParams]="{ product: subscription.productCode, engine: subscription.engine }"
            >
              {{ 'billing.overview.payNow' | translate }}
            </a>
          </div>
        </div>
      }

      @if (betaSubscription(); as beta) {
        <div class="mb-4 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <p class="text-sm text-text-primary">
            <i class="pi pi-star mr-2 text-accent"></i>
            {{ 'billing.overview.betaBanner' | translate: { date: (beta.currentPeriodEnd | date: 'dd/MM/yyyy') } }}
          </p>
        </div>
      }

      <!-- Crédits : le chiffre que l'utilisateur vient vérifier -->
      <section class="mb-6">
        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-tertiary">
          {{ 'billing.overview.credits' | translate }}
        </h2>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          @for (engine of engines; track engine) {
            <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
              <p class="text-xs uppercase tracking-wide text-text-tertiary">
                {{ engineLabel(engine) }}
              </p>
              <p class="mt-1 text-3xl font-bold tabular-nums text-text-primary">
                {{ credits()?.[engine] ?? 0 }}
              </p>
              <p class="mt-1 text-xs text-text-tertiary">{{ planNameOf(engine) }}</p>
            </div>
          }
        </div>
      </section>

      <!-- Plans par moteur -->
      <section class="mb-6">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-medium uppercase tracking-wide text-text-tertiary">
            {{ 'billing.plans.title' | translate }}
          </h2>
          <a class="text-sm text-primary hover:underline" routerLink="/billing/plans">
            {{ 'billing.overview.changePlan' | translate }}
          </a>
        </div>

        <div class="space-y-3">
          @for (engine of engines; track engine) {
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
              <div>
                <p class="text-sm font-semibold text-text-primary">{{ engineLabel(engine) }}</p>
                <p class="mt-0.5 text-sm text-text-secondary">{{ planNameOf(engine) }}</p>

                @if (subscriptionOf(engine); as subscription) {
                  <p class="mt-1 text-xs text-text-tertiary">
                    @if (subscription.complimentary) {
                      {{ 'billing.overview.complimentary' | translate }} ·
                      {{ 'billing.overview.endsOn' | translate: { date: (subscription.currentPeriodEnd | date: 'dd/MM/yyyy') } }}
                    } @else if (subscription.cancelAtPeriodEnd) {
                      {{ 'billing.overview.endsOn' | translate: { date: (subscription.currentPeriodEnd | date: 'dd/MM/yyyy') } }}
                    } @else {
                      {{ 'billing.overview.renewsOn' | translate: { date: (subscription.currentPeriodEnd | date: 'dd/MM/yyyy') } }}
                    }
                  </p>
                }
              </div>

              <div class="flex items-center gap-2">
                @if (subscriptionOf(engine); as subscription) {
                  @if (!subscription.complimentary && !subscription.cancelAtPeriodEnd) {
                    <button
                      type="button"
                      class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-text-secondary"
                      (click)="cancel(engine)"
                    >
                      {{ 'billing.overview.cancel' | translate }}
                    </button>
                  }
                } @else {
                  <a
                    class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                    routerLink="/billing/plans"
                    [queryParams]="{ engine }"
                  >
                    {{ 'billing.plans.choose' | translate }}
                  </a>
                }
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Historique -->
      <section>
        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-tertiary">
          {{ 'billing.overview.history' | translate }}
        </h2>

        @if (payments().length === 0) {
          <p class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 text-center text-sm text-text-tertiary">
            {{ 'billing.overview.noPayments' | translate }}
          </p>
        }

        <div class="space-y-2">
          @for (payment of payments(); track payment.reference) {
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm text-text-primary">{{ payment.label }}</p>
                <p class="mt-0.5 font-mono text-xs text-text-tertiary">{{ payment.reference }}</p>
              </div>

              <div class="flex items-center gap-4">
                <span class="text-sm tabular-nums text-text-primary">
                  {{ payment.amount | number: '1.0-0' }} {{ payment.currency }}
                </span>
                <span
                  class="rounded-full px-2.5 py-1 text-xs"
                  [class.bg-success/15]="payment.status === 'COMPLETED'"
                  [class.text-success]="payment.status === 'COMPLETED'"
                  [class.bg-danger/15]="isFailed(payment)"
                  [class.text-danger]="isFailed(payment)"
                  [class.bg-warning/15]="!isFailed(payment) && payment.status !== 'COMPLETED'"
                  [class.text-warning]="!isFailed(payment) && payment.status !== 'COMPLETED'"
                >
                  {{ 'billing.status.' + payment.status | translate }}
                </span>
                <span class="hidden text-xs text-text-tertiary sm:inline">
                  {{ payment.createdAt | date: 'dd/MM/yyyy' }}
                </span>
              </div>
            </div>
          }
        </div>
      </section>
    </div>
  `,
})
export class BillingOverviewPage {
  private readonly billing = inject(BillingService);

  readonly engines: BillingEngine[] = ['business', 'appgen', 'ideploy'];
  readonly payments = signal<PaymentView[]>([]);

  readonly credits = this.billing.credits;
  readonly me = this.billing.me;

  readonly pastDue = computed(() =>
    (this.me()?.subscriptions ?? []).filter((subscription) => subscription.status === 'past_due'),
  );

  readonly betaSubscription = computed(() =>
    (this.me()?.subscriptions ?? []).find((subscription) => subscription.complimentary),
  );

  constructor() {
    this.billing.loadMe().subscribe();
    this.billing.loadCatalog().subscribe();
    this.billing.listPayments().subscribe({
      next: (result) => this.payments.set(result.payments),
      error: () => this.payments.set([]),
    });
  }

  subscriptionOf(engine: BillingEngine): EngineSubscription | undefined {
    return (this.me()?.subscriptions ?? []).find((subscription) => subscription.engine === engine);
  }

  /** Nom commercial du plan courant, ou l'offre gratuite. */
  planNameOf(engine: BillingEngine): string {
    const subscription = this.subscriptionOf(engine);
    if (!subscription) return 'Découverte';

    const product = (this.billing.catalog()?.products ?? []).find(
      (entry) => entry.code === subscription.productCode,
    );
    return product?.name ?? subscription.productCode;
  }

  engineLabel(engine: BillingEngine): string {
    return { business: 'iBusiness', appgen: 'iCode', ideploy: 'iDeploy' }[engine];
  }

  isFailed(payment: PaymentView): boolean {
    return ['FAILED', 'REJECTED', 'NOT_FOUND', 'EXPIRED'].includes(payment.status);
  }

  cancel(engine: BillingEngine): void {
    this.billing.cancelSubscription(engine).subscribe({
      // Le plan reste actif jusqu'à la fin de la période payée : on relit les
      // droits plutôt que de retirer la ligne de l'écran.
      next: () => this.billing.loadMe().subscribe(),
    });
  }
}
