import mongoose, { Schema, Document } from 'mongoose';
import logger from '../../config/logger';
import { PENDING_PAYMENT_STATUSES } from '../../models/payment.model';
import { PaymentTransaction } from '../../schemas/payment.schema';
import { billingSettingsService } from '../billing/billing-settings.service';
import { getSignatureMode } from './pawapay-signature';
import { pawapayClient } from './pawapay.client';
import { paymentEventsService } from './payment-events.service';
import { paymentService } from './payment.service';

/**
 * Les actions du panel admin sur les paiements, sans appel HTTP entre les deux services.
 *
 * Le panel écrit une DEMANDE dans `payment_admin_actions` (revérifier, relancer le callback,
 * rejouer la livraison, rembourser) ; le réconciliateur de paiements de l'API la prend à son
 * passage suivant (toutes les 60 s) et l'exécute avec les mêmes méthodes qu'avant. Seule l'API
 * détient la clé pawaPay et la chaîne d'encaissement : rien de cette logique d'argent n'est
 * dupliqué dans le panel, et le panel ne dépend plus de la disponibilité de l'API.
 *
 * Dans l'autre sens, l'API publie l'état de la chaîne d'encaissement (pawaPay joignable, soldes
 * des portefeuilles pawaPay) dans `billing_health`, que le panel lit.
 */

export type PaymentAdminActionKind = 'recheck' | 'resend_callback' | 'fulfill' | 'refund';

export interface PaymentAdminActionDocument extends Document {
  reference: string;
  action: PaymentAdminActionKind;
  params?: { reason?: string; amount?: number };
  status: 'pending' | 'processing' | 'done' | 'failed';
  requestedBy?: string;
  requestedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
}

const PaymentAdminActionSchema = new Schema<PaymentAdminActionDocument>(
  {
    reference: { type: String, required: true, index: true },
    action: { type: String, enum: ['recheck', 'resend_callback', 'fulfill', 'refund'], required: true },
    params: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending', index: true },
    requestedBy: { type: String },
    requestedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    error: { type: String },
  },
  { collection: 'payment_admin_actions' }
);

export const PaymentAdminAction = mongoose.model<PaymentAdminActionDocument>('PaymentAdminAction', PaymentAdminActionSchema);

const BATCH = 20;
/** Une action « en cours » depuis plus longtemps a perdu son exécutant (redémarrage) : elle est reprise. */
const STALE_PROCESSING_MS = 10 * 60_000;
const HEALTH_EVERY_MS = 5 * 60_000;

export class PaymentAdminActionsService {
  private healthAt = 0;

  /** Exécute les demandes en attente. Appelé par le réconciliateur, sous son verrou. */
  async process(): Promise<number> {
    await PaymentAdminAction.updateMany(
      { status: 'processing', startedAt: { $lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
      { $set: { status: 'pending' } }
    );

    let done = 0;
    for (let i = 0; i < BATCH; i += 1) {
      // Réservation atomique : deux instances ne prennent jamais la même demande.
      const action = await PaymentAdminAction.findOneAndUpdate(
        { status: 'pending' },
        { $set: { status: 'processing', startedAt: new Date() } },
        { sort: { requestedAt: 1 }, new: true }
      );
      if (!action) break;
      try {
        await this.execute(action);
        await PaymentAdminAction.updateOne({ _id: action._id }, { $set: { status: 'done', finishedAt: new Date() }, $unset: { error: '' } });
        done += 1;
      } catch (error: any) {
        await PaymentAdminAction.updateOne({ _id: action._id }, { $set: { status: 'failed', finishedAt: new Date(), error: String(error?.message ?? error).slice(0, 500) } });
        logger.error(`payment.admin_action_failed: ${error?.message}`, { event: 'payment.admin_action_failed', reference: action.reference, action: action.action });
      }
    }
    return done;
  }

  private async execute(action: PaymentAdminActionDocument): Promise<void> {
    const transaction = await paymentService.getByReference(action.reference);
    if (!transaction) throw new Error(`Paiement ${action.reference} introuvable`);
    const by = action.requestedBy ? ` par ${action.requestedBy}` : '';

    switch (action.action) {
      case 'recheck':
        await paymentEventsService.record({
          transactionId: transaction.id!,
          depositId: action.reference,
          type: 'admin_action',
          source: 'admin',
          message: `Vérification manuelle du statut demandée${by}`,
          logFields: { reference: action.reference },
        });
        await paymentService.pollTransaction(transaction.id!, 'admin');
        return;
      case 'resend_callback':
        await pawapayClient.resendDepositCallback(transaction.depositId);
        return;
      case 'fulfill':
        await paymentService.fulfill(transaction.id!);
        return;
      case 'refund': {
        const reason = action.params?.reason;
        if (!reason) throw new Error('Un motif est obligatoire.');
        await paymentService.refund(action.reference, { reason, amount: action.params?.amount, adminId: action.requestedBy });
        return;
      }
    }
  }

  /** Publie l'état de la chaîne d'encaissement pour le panel (au plus toutes les 5 minutes). */
  async publishHealth(force = false): Promise<void> {
    if (!force && Date.now() - this.healthAt < HEALTH_EVERY_MS) return;
    this.healthAt = Date.now();
    const configured = pawapayClient.isConfigured();
    let wallets: unknown = null;
    let reachable = false;
    if (configured) {
      try {
        wallets = await pawapayClient.getWalletBalances();
        reachable = true;
      } catch {
        reachable = false;
      }
    }
    const settings = await billingSettingsService.get();
    await mongoose.connection.collection('billing_health').updateOne(
      { key: 'payments' },
      {
        $set: {
          key: 'payments',
          configured,
          reachable,
          environment: pawapayClient.isProduction() ? 'production' : 'sandbox',
          signatureMode: getSignatureMode(),
          paymentsEnabled: await billingSettingsService.isPaymentsEnabled(),
          enforcement: settings.enforcement,
          wallets,
          checkedAt: new Date(),
          pendingAdminActions: await PaymentAdminAction.countDocuments({ status: { $in: ['pending', 'processing'] } }),
          stuckPayments: await PaymentTransaction.countDocuments({ status: { $in: PENDING_PAYMENT_STATUSES }, createdAt: { $lt: new Date(Date.now() - 30 * 60_000) } }),
        },
      },
      { upsert: true }
    );
  }
}

export const paymentAdminActionsService = new PaymentAdminActionsService();
export default paymentAdminActionsService;
