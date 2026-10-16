import { Injectable, signal } from '@angular/core';
import { BuyOfferRequest, PaymentRequiredPayload } from '../models/billing.model';

/**
 * Le paywall, comme état partagé.
 *
 * Quand l'API refuse une génération faute de crédits, le refus arrive au
 * milieu d'un appel HTTP — loin du composant capable d'afficher quoi que ce
 * soit. L'intercepteur dépose donc le refus ici, et l'hôte monté une fois pour
 * toutes dans la coquille de l'application le montre.
 *
 * Ce détour évite deux écueils : que chaque page gère son propre message
 * d'erreur 402 (vingt implémentations divergentes), et qu'un refus reste
 * invisible parce que la requête était lancée par un service.
 */
@Injectable({ providedIn: 'root' })
export class PaywallService {
  /** Refus en cours ; `null` quand rien n'est affiché. */
  readonly pending = signal<PaymentRequiredPayload | null>(null);

  /**
   * Produit que l'utilisateur a choisi d'acheter depuis le paywall. Dans le modèle au
   * portefeuille, c'est la recharge (`wallet-topup`) du montant qui couvre le manque, suivie le
   * cas échéant de l'achat refusé (`then`).
   */
  readonly checkoutProduct = signal<{ productCode: string; engine?: string; amountXaf?: number; then?: BuyOfferRequest } | null>(null);

  open(payload: PaymentRequiredPayload): void {
    this.pending.set(payload);
  }

  close(): void {
    this.pending.set(null);
    this.checkoutProduct.set(null);
  }

  /** Passe du message de refus à l'écran de paiement, sans quitter la page. */
  buy(productCode: string, engine?: string): void {
    this.checkoutProduct.set({ productCode, engine });
  }

  /** Recharge le portefeuille du montant donné, puis (facultatif) achète l'offre refusée. */
  topUp(amountXaf: number, then?: BuyOfferRequest): void {
    this.checkoutProduct.set({ productCode: 'wallet-topup', amountXaf, then });
  }
}
