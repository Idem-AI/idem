import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BillingService } from '../../../billing/services/billing.service';
import { EnginePlanView } from '../../../billing/models/plan.model';
import { PaymentView } from '../../../billing/models/billing.model';

/**
 * L'aperçu : « où j'en suis », en un écran.
 *
 * Une carte par moteur, et chaque carte répond dans l'ordre aux trois seules
 * questions que l'on se pose en arrivant ici : quelle offre j'ai, combien il me
 * reste, et qu'est-ce qu'il y a au-dessus. Une seule action principale par
 * carte — l'échelon immédiatement supérieur, ou rien quand on est au sommet.
 *
 * Ce qui a été retiré compte autant que ce qui reste. L'ancienne page affichait
 * trois compteurs de crédits, puis trois lignes d'abonnement, puis
 * l'historique : les mêmes moteurs traités trois fois, à trois endroits, sans
 * qu'aucun bloc ne dise quoi faire. Ici chaque moteur est dit une fois, en
 * entier, avec son geste suivant.
 */
@Component({
  selector: 'app-account-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancelling.set(null)' },
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    @if (plans().length === 0) {
      <div class="space-y-3">
        @for (row of [1, 2, 3]; track row) {
          <div class="h-40 animate-pulse rounded-xl bg-[var(--color-surface-2)]"></div>
        }
      </div>
    } @else {
      <div class="space-y-4">
        @for (plan of plans(); track plan.engine) {
          <section
            class="rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-5"
          >
            <!-- Identité de l'offre -->
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-base font-semibold text-text-primary">{{ plan.engineLabel }}</h2>
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    [class]="badgeClass(plan)"
                  >
                    {{ badgeLabel(plan) }}
                  </span>
                </div>

                <p class="mt-1 text-sm text-text-tertiary">
                  {{ 'account.engines.' + plan.engine + '.what' | translate }}
                </p>
              </div>

              <div class="shrink-0 text-right">
                <p class="text-lg font-semibold text-text-primary">{{ plan.currentName }}</p>
                <p class="text-sm text-text-tertiary">
                  @if (plan.current && plan.current.priceXaf > 0) {
                    {{ plan.current.priceXaf | number: '1.0-0' }} F{{ 'account.perMonth' | translate }}
                  } @else {
                    {{ 'account.free' | translate }}
                  }
                </p>
              </div>
            </div>

            <!-- Échéance : ce que la date veut dire change avec l'état, donc
                 le verbe aussi. « Renouvellement » et « prend fin » ne sont pas
                 la même information. -->
            @if (plan.boundaryDate) {
              <p class="mt-3 text-sm" [class]="plan.state === 'past_due' ? 'text-danger' : 'text-text-secondary'">
                <i class="pi pi-calendar mr-1.5 text-xs" aria-hidden="true"></i>
                {{ boundaryLabel(plan) }}
              </p>
            }

            <!-- Crédits, rapportés à ce que l'offre en donne : « 120 » seul ne
                 dit pas si c'est beaucoup. -->
            @if (plan.engine !== 'ideploy') {
              <div class="mt-4">
                <div class="flex items-baseline justify-between text-sm">
                  <span class="text-text-secondary">{{ 'account.credits' | translate }}</span>
                  <span class="tabular-nums font-medium text-text-primary">
                    {{ plan.credits | number: '1.0-0' }}
                    @if (allowanceOf(plan); as allowance) {
                      <span class="font-normal text-text-tertiary">
                        / {{ allowance | number: '1.0-0' }}{{ 'account.perMonth' | translate }}
                      </span>
                    }
                  </span>
                </div>

                <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [class]="plan.credits < 10 ? 'bg-warning' : 'bg-primary'"
                    [style.width.%]="creditsPercent(plan)"
                  ></div>
                </div>
              </div>
            }

            <!-- Le geste suivant, et un seul -->
            <div class="mt-5 flex flex-wrap items-center gap-2">
              @if (plan.next; as next) {
                <a
                  class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  [routerLink]="['/billing/checkout']"
                  [queryParams]="{ product: next.code, engine: plan.engine, interval: 'month' }"
                >
                  {{ 'account.upgradeTo' | translate: { plan: next.name } }} —
                  {{ next.priceXaf | number: '1.0-0' }} F{{ 'account.perMonth' | translate }}
                </a>
              } @else if (plan.isTopTier) {
                <span
                  class="inline-flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
                >
                  <i class="pi pi-check-circle text-xs" aria-hidden="true"></i>
                  {{ 'account.topTier' | translate }}
                </span>
              }

              <a
                class="rounded-lg border border-[var(--glass-border-medium)] px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
                routerLink="/account/plans"
                [queryParams]="{ engine: plan.engine }"
              >
                {{ 'account.seeAllOffers' | translate }}
              </a>

              <!-- Résilier : présent, mais sans le poids d'un bouton. Le
                   proposer à égalité avec la montée en gamme serait étrange. -->
              @if (plan.state === 'active' || plan.state === 'trialing') {
                <button
                  type="button"
                  class="ml-auto text-sm text-text-tertiary underline-offset-2 transition-colors hover:text-danger hover:underline"
                  (click)="askCancel(plan)"
                >
                  {{ 'account.cancel' | translate }}
                </button>
              }
            </div>
          </section>
        }
      </div>

      <!-- Dernière opération : la réponse à « mon paiement est-il passé ? »,
           sans ouvrir l'onglet des paiements. -->
      @if (lastPayment(); as payment) {
        <section class="mt-6 rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-4">
          <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-tertiary">
            {{ 'account.lastPayment' | translate }}
          </h2>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm text-text-primary">{{ payment.label }}</p>
              <p class="mt-0.5 text-xs text-text-tertiary">
                {{ payment.createdAt | date: 'dd MMMM yyyy' }} ·
                {{ payment.amount | number: '1.0-0' }} {{ payment.currency }}
              </p>
            </div>

            <div class="flex items-center gap-3">
              <span class="rounded-full px-2.5 py-1 text-xs" [class]="statusClass(payment)">
                {{ 'billing.status.' + payment.status | translate }}
              </span>
              <a
                class="text-sm text-primary hover:underline"
                [routerLink]="['/billing/success']"
                [queryParams]="{ payment: payment.reference }"
              >
                {{ 'account.viewReceipt' | translate }}
              </a>
            </div>
          </div>
        </section>
      }
    }

    <!-- Résiliation : une confirmation, parce qu'elle est irréversible dans le
         mois en cours et qu'un clic distrait ne doit pas la déclencher. -->
    @if (cancelling(); as plan) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        (click)="cancelling.set(null)"
      >
        <div
          class="w-full max-w-sm modal-panel p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-plan-title"
          (click)="$event.stopPropagation()"
        >
          <h2 id="cancel-plan-title" class="text-base font-semibold text-text-primary">
            {{ 'account.cancelTitle' | translate: { plan: plan.currentName } }}
          </h2>
          <p class="mt-2 text-sm text-text-secondary">
            {{ 'billing.overview.cancelConfirm' | translate }}
          </p>

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              (click)="cancelling.set(null)"
            >
              {{ 'common.close' | translate }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              (click)="confirmCancel(plan)"
            >
              {{ 'account.cancel' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AccountOverviewPage {
  private readonly billing = inject(BillingService);

  protected readonly plans = this.billing.plans;
  protected readonly cancelling = signal<EnginePlanView | null>(null);

  private readonly payments = signal<PaymentView[]>([]);

  /**
   * Le dernier paiement, abouti ou non.
   *
   * Ne pas filtrer sur les succès est délibéré : c'est justement après un échec
   * que l'on vient vérifier, et une ligne absente se lit comme « rien ne s'est
   * passé » alors qu'un montant a peut-être été demandé.
   */
  protected readonly lastPayment = computed(() => this.payments()[0] ?? null);

  constructor() {
    this.billing.listPayments().subscribe({
      next: (result) => this.payments.set(result.payments),
      error: () => this.payments.set([]),
    });
  }

  /** Crédits accordés par l'offre en cours — le dénominateur de la jauge. */
  protected allowanceOf(plan: EnginePlanView): number | null {
    const allowance = plan.current?.credits ?? 0;
    return allowance > 0 ? allowance : null;
  }

  /**
   * Remplissage de la jauge.
   *
   * Plafonné à 100 : une recharge peut porter le solde au-dessus de la dotation
   * mensuelle, et une barre qui déborde de son rail se lit comme un défaut
   * d'affichage plutôt que comme une bonne nouvelle.
   */
  protected creditsPercent(plan: EnginePlanView): number {
    const allowance = this.allowanceOf(plan);
    if (!allowance) return plan.credits > 0 ? 100 : 0;
    return Math.min(100, Math.round((plan.credits / allowance) * 100));
  }

  protected badgeLabel(plan: EnginePlanView): string {
    return {
      free: 'Offre gratuite',
      active: 'Actif',
      trialing: 'Essai',
      ending: 'Se termine',
      past_due: 'Impayé',
      complimentary: 'Offert — bêta',
    }[plan.state];
  }

  protected badgeClass(plan: EnginePlanView): string {
    return {
      free: 'bg-[var(--color-surface-3)] text-text-secondary',
      active: 'bg-success/15 text-success',
      trialing: 'bg-primary/15 text-primary',
      ending: 'bg-warning/15 text-warning',
      past_due: 'bg-danger/15 text-danger',
      complimentary: 'bg-accent/15 text-accent',
    }[plan.state];
  }

  protected boundaryLabel(plan: EnginePlanView): string {
    const date = formatDay(plan.boundaryDate!);

    switch (plan.state) {
      case 'past_due':
        return `Échéance dépassée — accès maintenu jusqu'au ${date}`;
      case 'ending':
        return `Prend fin le ${date}`;
      case 'complimentary':
        return `Accès offert jusqu'au ${date}`;
      default:
        return `Renouvellement le ${date}`;
    }
  }

  protected statusClass(payment: PaymentView): string {
    if (payment.status === 'COMPLETED') return 'bg-success/15 text-success';
    if (['FAILED', 'REJECTED', 'NOT_FOUND', 'EXPIRED'].includes(payment.status)) {
      return 'bg-danger/15 text-danger';
    }
    return 'bg-warning/15 text-warning';
  }

  protected askCancel(plan: EnginePlanView): void {
    this.cancelling.set(plan);
  }

  protected confirmCancel(plan: EnginePlanView): void {
    this.billing.cancelSubscription(plan.engine).subscribe({
      // L'accès court jusqu'à la fin de la période payée : on relit les droits
      // plutôt que de retirer la carte, qui doit rester à l'écran avec sa
      // nouvelle date de fin.
      next: () => {
        this.billing.loadMe().subscribe();
        this.cancelling.set(null);
      },
      error: () => this.cancelling.set(null),
    });
  }
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
