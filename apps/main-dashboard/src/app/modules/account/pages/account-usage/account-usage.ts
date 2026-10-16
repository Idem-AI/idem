import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BillingService } from '../../../billing/services/billing.service';
import { BillingEngine, CreditLedgerRow, UsageQuotaStatus } from '../../../billing/models/billing.model';
import { BILLING_ENGINES, ENGINE_LABELS } from '../../../billing/models/plan.model';

/**
 * La consommation : « où sont passés mes crédits ».
 *
 * Deux compteurs coexistent dans IDEM, et les avoir affichés côte à côte sans
 * les expliquer est l'une des raisons pour lesquelles plus personne ne s'y
 * retrouvait :
 *
 *  - les **crédits** sont la monnaie ; chaque livrable en coûte un nombre
 *    connu, et ils se rechargent ou viennent de l'offre ;
 *  - les **limites d'usage** bornent le rythme des générations par famille
 *    (aides IA, retouches, créations, livrables complets, vidéos, iCode,
 *    simulations), par jour, semaine et mois selon l'offre ; elles se
 *    renouvellent toutes seules et ne se rechargent pas.
 *
 * On ne peut pas les fusionner — ce sont deux mécanismes distincts côté API —
 * mais on peut cesser de les présenter comme s'ils étaient de même nature.
 *
 * D'où l'ordre : ce dont on dispose maintenant (soldes, puis limites d'usage),
 * et seulement ensuite l'historique qui l'explique. Les limites gardent leur
 * encadré distinct, qui dit ce qu'elles sont.
 */
@Component({
  selector: 'app-account-usage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <!-- Soldes, d'abord : c'est le chiffre qu'on vient vérifier -->
    <div class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      @for (plan of creditPlans(); track plan.engine) {
        <div class="rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-4">
          <p class="text-xs uppercase tracking-wide text-text-tertiary">{{ plan.engineLabel }}</p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-text-primary">
            {{ plan.credits | number: '1.0-0' }}
          </p>
          <p class="mt-1 text-xs text-text-tertiary">
            {{ 'account.creditsOn' | translate: { plan: plan.currentName } }}
          </p>
        </div>
      }
    </div>

    <!--
      Limites d'usage, juste au-dessus du relevé : elles décrivent ce dont on
      dispose aujourd'hui, au même titre que les soldes. Cadre distinct : ce
      n'est pas de la monnaie, c'est un rythme qui se renouvelle seul.
    -->
    @if (quotas(); as status) {
      <section class="glass-card mb-6 p-4">
        <h2 class="text-sm font-medium text-text-primary">{{ 'account.quotaTitle' | translate }}</h2>
        <p class="mt-1 text-xs text-text-tertiary">{{ 'account.quotaHint' | translate }}</p>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-text-tertiary">
                <th class="py-2 pr-3 font-normal" scope="col">{{ 'account.quotaGroup' | translate }}</th>
                @for (window of windows; track window) {
                  <th class="py-2 pr-3 font-normal" scope="col">{{ 'account.quotaWindows.' + window | translate }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (group of status.groups; track group.group) {
                <tr class="border-t border-[var(--glass-border-subtle)]">
                  <th class="py-2 pr-3 text-left font-normal text-text-secondary" scope="row">{{ group.label }}</th>
                  @for (window of group.windows; track window.window) {
                    <td class="py-2 pr-3">
                      @if (window.limit === null) {
                        <span class="text-xs text-text-tertiary">{{ 'account.quotaUnlimited' | translate }}</span>
                      } @else {
                        <span class="tabular-nums text-text-primary">{{ window.used }} / {{ window.limit }}</span>
                        <progress
                          class="mt-1 block w-full"
                          [value]="window.used"
                          [max]="window.limit"
                          [attr.aria-label]="group.label + ' · ' + ('account.quotaWindows.' + window.window | translate)"
                        ></progress>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (status.capacity.day >= 80) {
          <p class="mt-3 text-xs text-warning">{{ 'account.quotaCapacityHigh' | translate }}</p>
        }
      </section>
    }

    <!-- Relevé : l'historique, après ce dont on dispose -->
    <section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-medium uppercase tracking-wide text-text-tertiary">
          {{ 'account.statement' | translate }}
        </h2>

        <div class="flex gap-1 rounded-lg border border-[var(--glass-border)] p-1">
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-xs transition-colors"
            [class]="filter() === null ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
            (click)="filter.set(null)"
          >
            {{ 'account.allEngines' | translate }}
          </button>
          @for (engine of engines; track engine) {
            <button
              type="button"
              class="rounded-md px-2.5 py-1 text-xs transition-colors"
              [class]="filter() === engine ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
              (click)="filter.set(engine)"
            >
              {{ engineLabels[engine] }}
            </button>
          }
        </div>
      </div>

      @if (isLoading()) {
        <div class="h-40 animate-pulse rounded-xl bg-[var(--color-surface-2)]"></div>
      } @else if (visibleEntries().length === 0) {
        <p class="rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-6 text-center text-sm text-text-tertiary">
          {{ 'account.noStatement' | translate }}
        </p>
      } @else {
        <div class="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)]">
          @for (entry of visibleEntries(); track entry.createdAt + entry.reason + entry.delta) {
            <div
              class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border-subtle)] px-4 py-3 last:border-b-0"
            >
              <div class="min-w-0">
                <p class="text-sm text-text-primary">
                  {{ reasonLabel(entry) }}
                  @if (entry.note) {
                    <span class="text-text-tertiary"> · {{ entry.note }}</span>
                  }
                </p>
                <p class="mt-0.5 text-xs text-text-tertiary">
                  {{ engineLabels[entry.engine] }} ·
                  {{ entry.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                </p>
              </div>

              <div class="flex items-center gap-4">
                <!-- Le signe porte l'information : un débit et un crédit ne se
                     distinguent pas d'un coup d'œil s'ils s'écrivent pareil. -->
                <span
                  class="tabular-nums text-sm font-medium"
                  [class]="entry.delta < 0 ? 'text-text-secondary' : 'text-success'"
                >
                  {{ entry.delta > 0 ? '+' : '' }}{{ entry.delta | number: '1.0-0' }}
                </span>
                <span class="hidden w-16 text-right text-xs tabular-nums text-text-tertiary sm:inline">
                  {{ entry.balanceAfter | number: '1.0-0' }}
                </span>
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class AccountUsagePage {
  private readonly billing = inject(BillingService);

  protected readonly engines = BILLING_ENGINES;
  protected readonly engineLabels = ENGINE_LABELS;

  protected readonly filter = signal<BillingEngine | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly quotas = signal<UsageQuotaStatus | null>(null);
  protected readonly windows = ['day', 'week', 'month'] as const;

  private readonly entries = signal<CreditLedgerRow[]>([]);

  /** iDeploy se facture à l'abonnement et aux ressources, pas en crédits. */
  protected readonly creditPlans = computed(() =>
    this.billing.plans().filter((plan) => plan.engine !== 'ideploy'),
  );

  protected readonly visibleEntries = computed(() => {
    const engine = this.filter();
    const rows = this.entries();
    return engine ? rows.filter((row) => row.engine === engine) : rows;
  });

  constructor() {
    // Le relevé est demandé sans filtre puis trié côté client : les boutons de
    // moteur deviennent instantanés, et l'API n'est appelée qu'une fois.
    this.billing.getCreditStatement().subscribe({
      next: (result) => {
        this.entries.set(result.entries ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.entries.set([]);
        this.isLoading.set(false);
      },
    });

    this.billing.getQuotas().subscribe({
      next: (status) => this.quotas.set(status),
      // Les limites sont secondaires ici : leur absence masque l'encadré, elle
      // n'empêche pas de lire son relevé.
      error: () => this.quotas.set(null),
    });
  }

  /**
   * Motif du mouvement, en français.
   *
   * Une consommation nomme le livrable produit quand l'API l'a transmis :
   * « Génération » seul ne permet pas de reconnaître la ligne, et c'est
   * pourtant celle que l'on vient contester.
   */
  protected reasonLabel(entry: CreditLedgerRow): string {
    const labels: Record<string, string> = {
      plan_grant: 'Crédits de votre offre',
      pack_grant: 'Pack acheté',
      recharge: 'Recharge',
      pass_grant: 'Passe activé',
      loyalty_bonus: 'Bonus de fidélité',
      rollover_expiry: 'Crédits périmés',
      manual_adjustment: 'Ajustement',
      consumption: 'Génération',
      refund: 'Remboursement',
      welcome_grant: 'Crédit de bienvenue',
    };

    const base = labels[entry.reason] ?? entry.reason;
    return entry.reason === 'consumption' && entry.action ? `${base} · ${entry.action}` : base;
  }
}
