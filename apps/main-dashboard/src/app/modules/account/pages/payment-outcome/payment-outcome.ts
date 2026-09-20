import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, interval, takeUntil } from 'rxjs';
import { BillingService } from '../../../billing/services/billing.service';
import {
  FINAL_PAYMENT_STATUSES,
  PaymentView,
} from '../../../billing/models/billing.model';
import { ENGINE_LABELS } from '../../../billing/models/plan.model';
import { CookieService } from '../../../../shared/services/cookie.service';

/**
 * L'écran d'après-paiement.
 *
 * C'est le trou le plus coûteux du parcours précédent : une fois le code saisi
 * et le montant débité, l'utilisateur était renvoyé sur une page de facturation
 * ordinaire. Rien ne confirmait que son argent avait servi à quelque chose,
 * rien ne disait ce qui venait de changer sur son compte, rien n'indiquait où
 * retourner travailler. Beaucoup repayaient, ou écrivaient au support.
 *
 * Cette page répond aux trois questions de ce moment précis, dans l'ordre où
 * elles se posent :
 *
 *   1. **est-ce passé ?** — le statut, en grand, et le suivi continue tout seul
 *      si l'opérateur n'a pas encore tranché ;
 *   2. **qu'est-ce que ça change ?** — l'offre devenue active, les crédits
 *      arrivés et le nouveau solde, lus dans les droits rechargés ;
 *   3. **et maintenant ?** — un bouton pour reprendre son travail, un lien vers
 *      la facture.
 *
 * Elle est atteignable après coup depuis l'historique : c'est aussi le reçu.
 */
@Component({
  selector: 'app-payment-outcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <div class="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      @if (!reference()) {
        <p class="text-sm text-text-secondary">{{ 'account.outcome.noReference' | translate }}</p>
        <a class="mt-4 inline-block text-sm text-primary hover:underline" routerLink="/account">
          {{ 'account.outcome.backToAccount' | translate }}
        </a>
      } @else if (payment(); as paid) {
        <!-- 1. Est-ce passé ? -->
        <div class="text-center">
          <div
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            [class]="markClass(paid)"
          >
            <i class="pi text-2xl" [class]="markIcon(paid)" aria-hidden="true"></i>
          </div>

          <h1 class="mt-4 text-xl font-bold text-text-primary">{{ title(paid) }}</h1>
          <p class="mt-2 text-sm text-text-secondary">{{ subtitle(paid) }}</p>
        </div>

        <!-- Le montant et la référence : ce qu'on cherche quand on compare avec
             le SMS de l'opérateur. -->
        <dl class="mt-8 divide-y divide-[var(--glass-border-subtle)] rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-1)] px-4">
          <div class="flex items-center justify-between py-3">
            <dt class="text-sm text-text-secondary">{{ 'account.outcome.product' | translate }}</dt>
            <dd class="text-sm font-medium text-text-primary">{{ paid.label }}</dd>
          </div>
          <div class="flex items-center justify-between py-3">
            <dt class="text-sm text-text-secondary">{{ 'account.amount' | translate }}</dt>
            <dd class="text-sm font-medium tabular-nums text-text-primary">
              {{ paid.amount | number: '1.0-0' }} {{ paid.currency }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-3">
            <dt class="text-sm text-text-secondary">{{ 'billing.checkout.reference' | translate }}</dt>
            <dd class="font-mono text-xs text-text-tertiary">{{ paid.reference }}</dd>
          </div>
          <div class="flex items-center justify-between py-3">
            <dt class="text-sm text-text-secondary">{{ 'account.outcome.paidAt' | translate }}</dt>
            <dd class="text-sm text-text-tertiary">
              {{ (paid.finalizedAt ?? paid.createdAt) | date: 'dd/MM/yyyy HH:mm' }}
            </dd>
          </div>
        </dl>

        <!-- 2. Qu'est-ce que ça change ? -->
        @if (paid.status === 'COMPLETED') {
          @if (effects().length > 0) {
            <section class="mt-6 rounded-xl border border-success/40 bg-success/10 p-4">
              <h2 class="text-sm font-semibold text-text-primary">
                {{ 'account.outcome.whatChanged' | translate }}
              </h2>
              <ul class="mt-2 space-y-1.5">
                @for (effect of effects(); track effect) {
                  <li class="flex gap-2 text-sm text-text-secondary">
                    <i class="pi pi-check mt-1 text-[10px] text-success" aria-hidden="true"></i>
                    <span>{{ effect }}</span>
                  </li>
                }
              </ul>
            </section>
          } @else if (!paid.fulfilled) {
            <!-- Encaissé mais pas encore livré : c'est un délai, pas une perte.
                 Le dire vaut mieux que de laisser un écran muet. -->
            <p class="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text-secondary">
              {{ 'account.outcome.deliveryPending' | translate }}
            </p>
          }
        }

        <!-- 3. Et maintenant ? -->
        <div class="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          @if (isFailed(paid)) {
            <a
              class="rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
              [routerLink]="['/billing/checkout']"
              [queryParams]="{ product: paid.productCode }"
            >
              {{ 'billing.checkout.retry' | translate }}
            </a>
          } @else {
            <a
              class="rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
              [routerLink]="resumeLink()"
            >
              {{ 'account.outcome.resume' | translate }}
            </a>
          }

          <a
            class="rounded-lg border border-[var(--glass-border-medium)] px-5 py-2.5 text-center text-sm text-text-secondary transition-colors hover:text-text-primary"
            routerLink="/account/payments"
          >
            {{ 'account.outcome.seeInvoice' | translate }}
          </a>
        </div>
      } @else if (loadFailed()) {
        <p class="text-sm text-text-secondary">{{ 'account.outcome.notFound' | translate }}</p>
        <a class="mt-4 inline-block text-sm text-primary hover:underline" routerLink="/account/payments">
          {{ 'account.outcome.seeInvoice' | translate }}
        </a>
      } @else {
        <div class="h-64 animate-pulse rounded-xl bg-[var(--color-surface-2)]"></div>
      }
    </div>
  `,
})
export class PaymentOutcomePage {
  private readonly route = inject(ActivatedRoute);
  private readonly billing = inject(BillingService);
  private readonly cookies = inject(CookieService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly reference = signal<string | null>(null);
  protected readonly payment = signal<PaymentView | null>(null);
  protected readonly loadFailed = signal(false);

  private readonly stopPolling = new Subject<void>();

  /**
   * Ce que le paiement a produit sur le compte.
   *
   * Lu dans les droits rechargés plutôt que déduit du produit acheté : c'est le
   * serveur qui a livré, et c'est son état qui fait foi. Annoncer « +155
   * crédits » à partir du catalogue alors que la livraison a échoué serait un
   * mensonge poli.
   */
  protected readonly effects = computed<string[]>(() => {
    const paid = this.payment();
    if (!paid || paid.status !== 'COMPLETED' || !paid.fulfilled) return [];

    const product = (this.billing.catalog()?.products ?? []).find(
      (entry) => entry.code === paid.productCode,
    );
    if (!product) return [];

    const lines: string[] = [];

    if (product.kind === 'subscription' || product.kind === 'bundle') {
      const plan = this.billing
        .plans()
        .find((entry) => entry.subscription?.productCode === product.code);

      if (plan) {
        lines.push(
          plan.boundaryDate
            ? `Offre ${plan.engineLabel} ${plan.currentName} active — prochaine échéance le ${formatDay(plan.boundaryDate)}.`
            : `Offre ${plan.engineLabel} ${plan.currentName} active.`,
        );
      }
    }

    if (product.credits > 0 && product.engine) {
      const balance = this.billing.credits()?.[product.engine];
      const label = ENGINE_LABELS[product.engine];

      lines.push(
        balance === undefined
          ? `${product.credits} crédits ${label} ajoutés.`
          : `${product.credits} crédits ${label} ajoutés — nouveau solde : ${balance}.`,
      );
    }

    return lines;
  });

  /**
   * Où reprendre.
   *
   * Le projet ouvert si l'on en a un — on revient presque toujours d'une
   * génération interrompue —, la console sinon.
   */
  protected readonly resumeLink = computed(() =>
    this.cookies.get('projectId') ? ['/project/dashboard'] : ['/console'],
  );

  constructor() {
    const reference = this.route.snapshot.queryParamMap.get('payment');
    this.reference.set(reference);

    if (reference) this.load(reference);

    this.destroyRef.onDestroy(() => {
      this.stopPolling.next();
      this.stopPolling.complete();
    });
  }

  private load(reference: string): void {
    this.billing.getPayment(reference).subscribe({
      next: (payment) => {
        this.payment.set(payment);

        // Les droits ont peut-être changé à l'instant : on les relit pour que
        // « ce qui a changé » dise l'état réel, pas celui d'avant le paiement.
        this.billing.loadMe().subscribe();
        if (!this.billing.catalog()) this.billing.loadCatalog().subscribe();

        // Arrivée pendant que l'opérateur tranche encore, ou encaissement non
        // encore livré : on suit au lieu d'afficher un état figé.
        if (!FINAL_PAYMENT_STATUSES.includes(payment.status) || !payment.fulfilled) {
          this.follow(reference);
        }
      },
      error: () => this.loadFailed.set(true),
    });
  }

  /**
   * Suivi jusqu'à l'issue, puis jusqu'à la livraison.
   *
   * Toutes les cinq secondes, deux minutes au plus : au-delà, c'est un délai de
   * réconciliation, et l'utilisateur sera prévenu autrement plutôt que de
   * rester devant un écran qui interroge l'API indéfiniment.
   */
  private follow(reference: string): void {
    let ticks = 0;

    interval(5000)
      .pipe(takeUntil(this.stopPolling))
      .subscribe(() => {
        ticks += 1;

        if (ticks > 24) {
          this.stopPolling.next();
          return;
        }

        this.billing.getPayment(reference).subscribe({
          next: (payment) => {
            this.payment.set(payment);

            if (FINAL_PAYMENT_STATUSES.includes(payment.status) && payment.fulfilled) {
              this.stopPolling.next();
              this.billing.loadMe().subscribe();
            }
          },
          error: () => undefined,
        });
      });
  }

  protected isFailed(payment: PaymentView): boolean {
    return ['FAILED', 'REJECTED', 'NOT_FOUND', 'EXPIRED'].includes(payment.status);
  }

  protected markClass(payment: PaymentView): string {
    if (payment.status === 'COMPLETED') return 'bg-success/15 text-success';
    if (this.isFailed(payment)) return 'bg-danger/15 text-danger';
    return 'bg-warning/15 text-warning';
  }

  protected markIcon(payment: PaymentView): string {
    if (payment.status === 'COMPLETED') return 'pi-check';
    if (this.isFailed(payment)) return 'pi-times';
    return 'pi-clock';
  }

  protected title(payment: PaymentView): string {
    if (payment.status === 'COMPLETED') return 'Paiement confirmé';
    if (this.isFailed(payment)) return 'Le paiement n’a pas abouti';
    return 'Paiement en cours';
  }

  protected subtitle(payment: PaymentView): string {
    if (payment.status === 'COMPLETED') {
      return payment.fulfilled
        ? 'Votre compte a été mis à jour.'
        : 'Votre paiement est encaissé, la livraison est en cours.';
    }

    if (this.isFailed(payment)) {
      // L'inquiétude immédiate après un échec Mobile Money : « m'a-t-on
      // prélevé quand même ? » On y répond avant qu'elle soit posée.
      return payment.failure?.message ?? 'Aucun montant n’a été prélevé sur votre compte.';
    }

    return 'Votre opérateur n’a pas encore confirmé. Cet écran se met à jour tout seul.';
  }
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
