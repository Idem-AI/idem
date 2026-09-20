import { BillingEngine, BillingProductKind } from './billing.model';

/**
 * Une facture, telle que l'API la sert (`GET /billing/invoices`).
 *
 * À ne pas confondre avec un paiement, même si l'un naît souvent de l'autre :
 * le paiement est le débit Mobile Money, la facture est le document qui le
 * justifie. Un renouvellement d'abonnement émet une facture sans qu'aucun
 * téléphone ne sonne, et un paiement échoué ne laisse aucune facture — c'est
 * exactement pourquoi l'historique des deux ne se superpose pas.
 */
export interface BillingInvoice {
  /** Numéro séquentiel, de la forme `INV-2026-09-000123`. */
  number: string;
  status: 'open' | 'paid' | 'void' | 'uncollectible';
  productCode: string;
  /** Nom commercial résolu par l'API, y compris pour un produit retiré de la vente. */
  label: string;
  kind: BillingProductKind;
  engine: BillingEngine | null;
  amountXaf: number;
  /** Période couverte, sur un abonnement. */
  periodStart?: string;
  periodEnd?: string;
  issuedAt: string;
  paidAt?: string;
  /** Relie la facture au débit correspondant, quand il y en a eu un. */
  paymentTransactionId?: string;
}
