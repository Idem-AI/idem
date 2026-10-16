import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PaywallService } from '../../services/paywall.service';
import { BillingService } from '../../services/billing.service';
import { CheckoutComponent } from '../checkout/checkout';
import { BuyOfferRequest, PaymentRequiredPayload } from '../../models/billing.model';

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
          class="w-full max-w-md modal-panel p-5"
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
              [amountXaf]="product.amountXaf"
              [then]="product.then"
              (completed)="onPaid()"
              (dismissed)="close()"
            ></app-checkout>
          } @else {
            <!-- Étape 1 : ce qui manque, et pourquoi -->
            <div class="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 class="text-base font-semibold text-text-primary">
                  {{ titleKey(refusal.error) | translate }}
                </h2>
                <p class="mt-1 text-sm text-text-secondary">{{ refusal.message }}</p>
                @if (refusal.resetsAt) {
                  <p class="mt-1 text-xs text-text-tertiary">
                    {{ 'billing.paywall.quotaResets' | translate: { date: (refusal.resetsAt | date: 'EEEE d MMMM, HH:mm') } }}
                  </p>
                }
              </div>
              <button type="button" class="text-text-tertiary hover:text-text-primary" (click)="close()">
                <i class="pi pi-times"></i>
              </button>
            </div>

            @if (refusal.priceXaf !== undefined) {
              <!-- Le portefeuille : prix, solde, ce qui manque — en francs -->
              <div class="mb-4 rounded-lg border border-[var(--glass-border)] bg-[var(--color-surface-2)] p-3">
                @if (refusal.label) {
                  <p class="mb-2 text-sm font-medium text-text-primary">{{ refusal.label }}</p>
                }
                <div class="flex items-center justify-between text-sm">
                  <span class="text-text-secondary">{{ 'billing.paywall.price' | translate: { price: (refusal.priceXaf | number: '1.0-0') } }}</span>
                  <span class="text-text-tertiary">{{ 'billing.paywall.walletBalance' | translate: { balance: ((refusal.balanceXaf ?? 0) | number: '1.0-0') } }}</span>
                </div>
                @if (refusal.missingXaf) {
                  <p class="mt-2 text-sm font-medium text-warning">
                    {{ 'billing.paywall.walletMissing' | translate: { missing: (refusal.missingXaf | number: '1.0-0') } }}
                  </p>
                }
                @if (refusal.kit && !refusal.kit.complete) {
                  <p class="mt-2 text-xs text-text-tertiary">
                    {{ 'billing.paywall.kitRemaining' | translate: { remaining: (refusal.kit.remainingXaf | number: '1.0-0'), cap: (refusal.kit.capXaf | number: '1.0-0') } }}
                  </p>
                }
              </div>

              @if (unlockRequest(refusal); as request) {
                @if ((refusal.balanceXaf ?? 0) >= refusal.priceXaf) {
                  <button type="button" class="inner-button w-full" [disabled]="buying()" (click)="unlock(request)">
                    {{ 'billing.paywall.unlock' | translate: { price: (refusal.priceXaf | number: '1.0-0') } }}
                  </button>
                } @else {
                  <button type="button" class="inner-button w-full" (click)="paywall.topUp(refusal.topupXaf ?? refusal.missingXaf ?? 0, request)">
                    {{ 'billing.paywall.topUpAndUnlock' | translate: { amount: ((refusal.topupXaf ?? refusal.missingXaf ?? 0) | number: '1.0-0') } }}
                  </button>
                }
                @if (unlockError()) {
                  <p class="mt-2 text-sm text-danger" role="alert">{{ unlockError() }}</p>
                }
              } @else if (refusal.topupXaf) {
                <button type="button" class="inner-button w-full" (click)="paywall.topUp(refusal.topupXaf)">
                  {{ 'billing.paywall.topUp' | translate: { amount: (refusal.topupXaf | number: '1.0-0') } }}
                </button>
              }

              @if (refusal.offers?.length) {
                <div class="mt-3 space-y-2">
                  @for (offer of refusal.offers; track offer.kind) {
                    <button
                      type="button"
                      class="flex w-full items-center justify-between rounded-lg border border-[var(--glass-border)] bg-[var(--color-surface-1)] px-4 py-3 text-left transition-colors hover:border-primary"
                      (click)="paywall.topUp(offer.priceXaf, $any({ kind: offer.kind }))"
                    >
                      <span class="text-sm font-medium text-text-primary">{{ offer.label }}</span>
                      <span class="text-sm font-semibold tabular-nums text-text-primary">{{ offer.priceXaf | number: '1.0-0' }} F</span>
                    </button>
                  }
                </div>
              }
            } @else if (refusal.cost !== undefined) {
              <div class="mb-4 rounded-lg border border-[var(--glass-border)] bg-[var(--color-surface-2)] p-3">
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
                    class="flex w-full items-center justify-between rounded-lg border border-[var(--glass-border)] bg-[var(--color-surface-1)] px-4 py-3 text-left transition-colors hover:border-primary"
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
              <a class="text-sm text-primary hover:underline" routerLink="/account/plans" (click)="close()">
                {{ 'billing.paywall.seeWallet' | translate }}
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

  protected readonly buying = signal(false);
  protected readonly unlockError = signal<string | null>(null);

  protected titleKey(error: string): string {
    if (error === 'plan_upgrade_required') return 'billing.paywall.upgradeTitle';
    if (error === 'quota_exceeded') return 'billing.paywall.quotaTitle';
    if (error === 'deliverable_locked') return 'billing.paywall.lockedTitle';
    return 'billing.paywall.walletTitle';
  }

  /** Un fichier final refusé : l'achat qui le débloque. */
  protected unlockRequest(refusal: PaymentRequiredPayload): BuyOfferRequest | null {
    if (refusal.error !== 'deliverable_locked' || !refusal.deliverable || !refusal.projectId) return null;
    return { kind: 'unlock', projectId: refusal.projectId, deliverable: refusal.deliverable };
  }

  /** Le solde suffit : la version finale se débloque sans passer par le mobile money. */
  protected unlock(request: BuyOfferRequest): void {
    this.buying.set(true);
    this.unlockError.set(null);
    this.billing.buyOffer(request).subscribe({
      next: () => {
        this.buying.set(false);
        this.close();
      },
      error: (error) => {
        this.buying.set(false);
        // Un 402 rouvre le paywall avec le nouveau manque ; le reste s'affiche ici.
        if (error?.status !== 402) this.unlockError.set(error?.error?.message ?? null);
      },
    });
  }

  close(): void {
    this.unlockError.set(null);
    this.paywall.close();
  }

  /**
   * Paiement abouti.
   *
   * On recharge les droits, et **on ne ferme pas**. Fermer ici — ce que faisait
   * le code précédent — escamotait l'écran de confirmation du composant de
   * paiement à la milliseconde où il s'affichait : l'utilisateur voyait la
   * fenêtre disparaître sans jamais lire que son paiement était passé, ni ce
   * qu'il avait obtenu. C'est lui qui ferme, par « Continuer », et ce bouton
   * émet `dismissed`.
   */
  onPaid(): void {
    this.billing.loadMe().subscribe();
  }
}
