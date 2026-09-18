import { Injectable, signal } from '@angular/core';
import { PaymentRequiredPayload } from '../models/billing.model';

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

  /** Produit que l'utilisateur a choisi d'acheter depuis le paywall. */
  readonly checkoutProduct = signal<{ productCode: string; engine?: string } | null>(null);

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
}
