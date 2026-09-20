import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { BillingService } from '../../../billing/services/billing.service';
import { PaymentView } from '../../../billing/models/billing.model';
import { BillingInvoice } from '../../../billing/models/invoice.model';
import { AuthService } from '../../../auth/services/auth.service';

/**
 * Paiements et factures.
 *
 * Les deux listes se ressemblent assez pour qu'on les confonde, et diffèrent
 * assez pour que la confusion coûte cher : un paiement est un débit sur un
 * téléphone, une facture est le document qui le justifie. Un renouvellement
 * automatique produit une facture sans qu'aucun téléphone ne sonne ; un
 * paiement refusé laisse une ligne de paiement et aucune facture.
 *
 * D'où deux sections nommées, dans cet ordre — on vient d'abord vérifier qu'un
 * débit est passé — et une phrase qui dit la différence, une fois, en haut.
 */
@Component({
  selector: 'app-account-payments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'opened.set(null)' },
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <p class="mb-6 rounded-lg border border-[var(--glass-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-text-secondary">
      <i class="pi pi-info-circle mr-1.5 text-text-tertiary" aria-hidden="true"></i>
      {{ 'account.paymentsVsInvoices' | translate }}
    </p>

    <!-- Paiements -->
    <section class="mb-8">
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-tertiary">
        {{ 'account.payments' | translate }}
      </h2>

      @if (payments().length === 0) {
        <p class="rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-6 text-center text-sm text-text-tertiary">
          {{ 'billing.overview.noPayments' | translate }}
        </p>
      } @else {
        <div class="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)]">
          @for (payment of payments(); track payment.reference) {
            <div
              class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border-subtle)] px-4 py-3 last:border-b-0"
            >
              <div class="min-w-0">
                <p class="truncate text-sm text-text-primary">{{ payment.label }}</p>
                <p class="mt-0.5 text-xs text-text-tertiary">
                  {{ payment.createdAt | date: 'dd/MM/yyyy HH:mm' }} ·
                  <span class="font-mono">{{ payment.reference }}</span>
                </p>

                <!-- Après un échec, la question est « pourquoi » : la réponse
                     de l'opérateur est déjà traduite par l'API. -->
                @if (payment.failure?.message; as reason) {
                  <p class="mt-1 text-xs text-danger">{{ reason }}</p>
                }
              </div>

              <div class="flex items-center gap-4">
                <span class="text-sm tabular-nums text-text-primary">
                  {{ payment.amount | number: '1.0-0' }} {{ payment.currency }}
                </span>
                <span class="rounded-full px-2.5 py-1 text-xs" [class]="statusClass(payment)">
                  {{ 'billing.status.' + payment.status | translate }}
                </span>
                <a
                  class="text-sm text-primary hover:underline"
                  [routerLink]="['/billing/success']"
                  [queryParams]="{ payment: payment.reference }"
                >
                  {{ 'account.details' | translate }}
                </a>
              </div>
            </div>
          }
        </div>
      }
    </section>

    <!-- Factures -->
    <section>
      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-text-tertiary">
        {{ 'account.invoices' | translate }}
      </h2>

      @if (invoicesUnavailable()) {
        <p class="rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-6 text-center text-sm text-text-tertiary">
          {{ 'account.invoicesUnavailable' | translate }}
        </p>
      } @else if (invoices().length === 0) {
        <p class="rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] p-6 text-center text-sm text-text-tertiary">
          {{ 'account.noInvoices' | translate }}
        </p>
      } @else {
        <div class="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)]">
          @for (invoice of invoices(); track invoice.number) {
            <div
              class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--glass-border-subtle)] px-4 py-3 last:border-b-0"
            >
              <div class="min-w-0">
                <p class="truncate text-sm text-text-primary">{{ invoice.label }}</p>
                <p class="mt-0.5 text-xs text-text-tertiary">
                  <span class="font-mono">{{ invoice.number }}</span> ·
                  {{ invoice.issuedAt | date: 'dd/MM/yyyy' }}
                  @if (invoice.periodStart && invoice.periodEnd) {
                    · {{ 'account.periodCovered' | translate }}
                    {{ invoice.periodStart | date: 'dd/MM/yy' }} –
                    {{ invoice.periodEnd | date: 'dd/MM/yy' }}
                  }
                </p>
              </div>

              <div class="flex items-center gap-4">
                <span class="text-sm tabular-nums text-text-primary">
                  {{ invoice.amountXaf | number: '1.0-0' }} F
                </span>
                <span class="rounded-full px-2.5 py-1 text-xs" [class]="invoiceClass(invoice)">
                  {{ 'account.invoiceStatus.' + invoice.status | translate }}
                </span>
                <button
                  type="button"
                  class="text-sm text-primary hover:underline"
                  (click)="opened.set(invoice)"
                >
                  {{ 'account.viewInvoice' | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </section>

    <!-- Reçu imprimable. Pas de PDF fabriqué côté serveur : la page d'impression
         du navigateur produit le même document, sans dépendance ni stockage. -->
    @if (opened(); as invoice) {
      <div
        class="receipt-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        (click)="opened.set(null)"
      >
        <div
          class="receipt w-full max-w-lg overflow-hidden modal-panel"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="invoice.number"
          (click)="$event.stopPropagation()"
        >
          <div class="receipt__sheet p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <img src="assets/icons/logo_white.png" alt="IDEM" class="h-7 w-auto dark:hidden" />
                <img src="assets/icons/logo_dark.png" alt="IDEM" class="hidden h-7 w-auto dark:block" />
                <p class="mt-2 text-xs text-text-tertiary">{{ 'account.receiptIssuer' | translate }}</p>
              </div>

              <div class="text-right">
                <p class="text-sm font-semibold text-text-primary">
                  {{ 'account.invoice' | translate }}
                </p>
                <p class="font-mono text-xs text-text-tertiary">{{ invoice.number }}</p>
                <p class="mt-1 text-xs text-text-tertiary">
                  {{ invoice.issuedAt | date: 'dd MMMM yyyy' }}
                </p>
              </div>
            </div>

            @if (customer(); as who) {
              <div class="mt-6 text-xs text-text-secondary">
                <p class="text-text-tertiary">{{ 'account.billedTo' | translate }}</p>
                <p class="mt-0.5 text-text-primary">{{ who.name }}</p>
                <p>{{ who.email }}</p>
              </div>
            }

            <table class="mt-6 w-full text-sm">
              <thead>
                <tr class="border-b border-[var(--glass-border)] text-left text-xs text-text-tertiary">
                  <th class="pb-2 font-medium">{{ 'account.description' | translate }}</th>
                  <th class="pb-2 text-right font-medium">{{ 'account.amount' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="py-3 text-text-primary">
                    {{ invoice.label }}
                    @if (invoice.periodStart && invoice.periodEnd) {
                      <span class="block text-xs text-text-tertiary">
                        {{ invoice.periodStart | date: 'dd/MM/yyyy' }} –
                        {{ invoice.periodEnd | date: 'dd/MM/yyyy' }}
                      </span>
                    }
                  </td>
                  <td class="py-3 text-right tabular-nums text-text-primary">
                    {{ invoice.amountXaf | number: '1.0-0' }} F
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t border-[var(--glass-border)]">
                  <td class="pt-3 text-sm font-semibold text-text-primary">
                    {{ 'account.total' | translate }}
                  </td>
                  <td class="pt-3 text-right text-sm font-semibold tabular-nums text-text-primary">
                    {{ invoice.amountXaf | number: '1.0-0' }} F
                  </td>
                </tr>
              </tfoot>
            </table>

            <p class="mt-6 text-xs text-text-tertiary">
              @if (invoice.status === 'paid' && invoice.paidAt) {
                {{ 'account.paidOn' | translate: { date: (invoice.paidAt | date: 'dd/MM/yyyy') } }}
              } @else {
                {{ 'account.invoiceStatus.' + invoice.status | translate }}
              }
            </p>
          </div>

          <div class="receipt__actions flex justify-end gap-2 border-t border-[var(--glass-border)] px-6 py-4">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              (click)="opened.set(null)"
            >
              {{ 'common.close' | translate }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              (click)="print()"
            >
              <i class="pi pi-print mr-1.5 text-xs" aria-hidden="true"></i>
              {{ 'account.print' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AccountPaymentsPage {
  private readonly billing = inject(BillingService);
  private readonly auth = inject(AuthService);

  protected readonly payments = signal<PaymentView[]>([]);
  protected readonly invoices = signal<BillingInvoice[]>([]);
  protected readonly invoicesUnavailable = signal(false);
  protected readonly opened = signal<BillingInvoice | null>(null);

  private readonly user = toSignal(this.auth.user$);

  /** Le destinataire porté sur le reçu, quand la session le connaît. */
  protected readonly customer = computed(() => {
    const account = this.user();
    if (!account) return null;
    return { name: account.displayName ?? '', email: account.email ?? '' };
  });

  constructor() {
    this.billing.listPayments().subscribe({
      next: (result) => this.payments.set(result.payments),
      error: () => this.payments.set([]),
    });

    this.billing.listInvoices().subscribe({
      next: (result) => this.invoices.set(result.invoices ?? []),
      // Une liste vide dirait « vous n'avez aucune facture », ce qui est faux
      // quand c'est l'appel qui a échoué. On distingue les deux.
      error: () => this.invoicesUnavailable.set(true),
    });
  }

  protected statusClass(payment: PaymentView): string {
    if (payment.status === 'COMPLETED') return 'bg-success/15 text-success';
    if (['FAILED', 'REJECTED', 'NOT_FOUND', 'EXPIRED'].includes(payment.status)) {
      return 'bg-danger/15 text-danger';
    }
    return 'bg-warning/15 text-warning';
  }

  protected invoiceClass(invoice: BillingInvoice): string {
    switch (invoice.status) {
      case 'paid':
        return 'bg-success/15 text-success';
      case 'open':
        return 'bg-warning/15 text-warning';
      default:
        return 'bg-[var(--color-surface-3)] text-text-secondary';
    }
  }

  /**
   * Imprime le reçu seul.
   *
   * La classe posée sur `body` déclenche la règle d'impression globale, qui
   * masque le reste de l'application — barre latérale, onglets, dock — montée
   * trop loin de ce composant pour qu'une feuille de style locale l'atteigne.
   *
   * Le retrait passe par `afterprint` plutôt que par la ligne suivante :
   * `print()` rend la main immédiatement dans plusieurs navigateurs, et la
   * classe disparaîtrait avant que la page ne soit rendue.
   */
  protected print(): void {
    document.body.classList.add('is-printing-receipt');

    const cleanup = () => {
      document.body.classList.remove('is-printing-receipt');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.print();
  }
}
