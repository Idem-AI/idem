import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PaywallService } from '../../services/paywall.service';
import { BillingService } from '../../services/billing.service';
import { CheckoutComponent } from '../checkout/checkout';

/**
 * Le paywall, affiché là où le refus se produit.
 *
 * Monté une seule fois dans la coquille de l'application : quand l'API refuse
 * une génération faute de crédits, l'utilisateur voit immédiatement ce qui
 * manque et peut payer **sans quitter sa page** — son travail en cours reste
 * à l'écran, et il reprend là où il s'était arrêté.
 *
 * Les offres proposées viennent du serveur, jamais d'une liste codée ici :
 * c'est lui qui sait combien il manque et quelles recharges le couvrent.
 */
@Component({
  selector: 'app-paywall-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, TranslateModule, CheckoutComponent],
  template: `
    @if (paywall.pending(); as refusal) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" (click)="close()">
        <div
          class="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-dark)] p-5"
          (click)="$event.stopPropagation()"
        >
          @if (paywall.checkoutProduct(); as product) {
            <!-- Étape 2 : paiement, sans quitter la page de travail -->
            <div class="mb-4 flex items-center justify-between">
              <button type="button" class="text-sm text-text-tertiary hover:text-text-primary" (click)="paywall.checkoutProduct.set(null)">
                <i class="pi pi-arrow-left mr-2"></i>{{ 'common.back' | translate }}
              </button>
              <button type="button" class="text-text-tertiary hover:text-text-primary" (click)="close()">
                <i class="pi pi-times"></i>
              </button>
            </div>

            <app-checkout
              [productCode]="product.productCode"
              [engine]="product.engine"
              (completed)="onPaid()"
              (dismissed)="close()"
            ></app-checkout>
          } @else {
            <!-- Étape 1 : ce qui manque, et pourquoi -->
            <div class="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 class="text-base font-semibold text-text-primary">
                  {{ (refusal.error === 'plan_upgrade_required' ? 'billing.paywall.upgradeTitle' : 'billing.paywall.title') | translate }}
                </h2>
                <p class="mt-1 text-sm text-text-secondary">{{ refusal.message }}</p>
              </div>
              <button type="button" class="text-text-tertiary hover:text-text-primary" (click)="close()">
                <i class="pi pi-times"></i>
              </button>
            </div>

            @if (refusal.cost !== undefined) {
              <div class="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-text-secondary">{{ 'billing.paywall.cost' | translate: { cost: refusal.cost } }}</span>
                  <span class="text-text-tertiary">{{ 'billing.paywall.balance' | translate: { balance: refusal.balance } }}</span>
                </div>
                @if (refusal.missing) {
                  <p class="mt-2 text-sm font-medium text-warning">
                    {{ 'billing.paywall.missing' | translate: { missing: refusal.missing } }}
                  </p>
                }
              </div>
            }

            <!-- Offres calculées par le serveur pour couvrir ce manque précis -->
            @if (refusal.suggestions?.length) {
              <div class="space-y-2">
                @for (suggestion of refusal.suggestions; track suggestion.productCode) {
                  <button
                    type="button"
                    class="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 text-left transition-colors hover:border-primary"
                    (click)="paywall.buy(suggestion.productCode, refusal.engine)"
                  >
                    <span>
                      <span class="block text-sm font-medium text-text-primary">{{ suggestion.name }}</span>
                      <span class="block text-xs text-text-tertiary">
                        {{ 'billing.plans.credits' | translate: { count: suggestion.credits } }}
                      </span>
                    </span>
                    <span class="text-sm font-semibold tabular-nums text-text-primary">
                      {{ suggestion.priceXaf | number: '1.0-0' }} F
                    </span>
                  </button>
                }
              </div>
            }

            <div class="mt-4 flex items-center justify-between">
              <a class="text-sm text-primary hover:underline" routerLink="/billing/plans" (click)="close()">
                {{ 'billing.paywall.seeAllPlans' | translate }}
              </a>
              <button type="button" class="text-sm text-text-tertiary hover:text-text-primary" (click)="close()">
                {{ 'billing.paywall.later' | translate }}
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class PaywallHostComponent {
  protected readonly paywall = inject(PaywallService);
  private readonly billing = inject(BillingService);

  close(): void {
    this.paywall.close();
  }

  onPaid(): void {
    // Les crédits viennent d'arriver : on les recharge avant de rendre la main,
    // pour que l'utilisateur relance sa génération sans rien rafraîchir.
    this.billing.loadMe().subscribe();
    this.paywall.close();
  }
}
