import logger from '../../config/logger';
import { paymentsStuckGauge } from '../../config/metrics';
import { PENDING_PAYMENT_STATUSES } from '../../models/payment.model';
import { PaymentTransaction } from '../../schemas/payment.schema';
import { paymentEventsService } from './payment-events.service';
import { MAX_FULFILL_ATTEMPTS, paymentService } from './payment.service';

/**
 * Réconciliation des paiements : le filet qui rattrape tout le reste.
 *
 * Le chemin nominal est un callback suivi d'une relecture de statut. Il échoue
 * plus souvent qu'on ne l'imagine : callback perdu, endpoint indisponible au
 * mauvais moment, abonné qui valide son code vingt minutes plus tard,
 * opérateur qui met une heure à confirmer. Sans cette tâche, chacun de ces cas
 * serait un client débité sans rien recevoir.
 *
 * Elle traite trois populations :
 *
 *  1. **Les transactions en attente** dont l'échéance de relecture est passée.
 *  2. **Les livraisons échouées** sur des paiements pourtant encaissés — le
 *     cas le plus grave, donc retenté en priorité.
 *  3. **Les transactions bloquées**, comptées dans une jauge pour qu'une
 *     alerte se déclenche avant que le support ne reçoive des réclamations.
 *
 * Le traitement est borné à chaque passage : mieux vaut plusieurs cycles
 * courts qu'un cycle long qui monopolise le verrou.
 */

/** Transactions relues par passage. */
const POLL_BATCH_SIZE = 50;

/** Livraisons retentées par passage. */
const FULFILL_BATCH_SIZE = 20;

/** Au-delà, une transaction en attente est considérée comme bloquée. */
const STUCK_THRESHOLD_MS = 30 * 60_000;

export interface ReconcileReport {
  polled: number;
  refulfilled: number;
  stuck: number;
}

export class PaymentReconcilerService {
  /** Un passage complet. Appelé chaque minute par le planificateur. */
  async run(): Promise<ReconcileReport> {
    const [polled, refulfilled, stuck] = [
      await this.pollPending(),
      await this.retryFailedFulfillments(),
      await this.countStuck(),
    ];

    paymentsStuckGauge.set({ service: 'idem-api' }, stuck);

    if (polled > 0 || refulfilled > 0) {
      logger.info('payment.reconcile_cycle', {
        event: 'payment.reconcile_cycle',
        polled,
        refulfilled,
        stuck,
      });
    }

    return { polled, refulfilled, stuck };
  }

  /**
   * Relit les transactions dont l'échéance est passée.
   *
   * Séquentiel à dessein : une rafale de requêtes vers pawaPay au moindre pic
   * de trafic ferait plus de mal que de bien, et rien ici n'est urgent à la
   * seconde près.
   */
  private async pollPending(): Promise<number> {
    const due = await PaymentTransaction.find({
      status: { $in: PENDING_PAYMENT_STATUSES },
      'polling.nextPollAt': { $ne: null, $lte: new Date() },
    })
      .sort({ 'polling.nextPollAt': 1 })
      .limit(POLL_BATCH_SIZE)
      .select('_id reference')
      .lean();

    let polled = 0;

    for (const transaction of due) {
      try {
        await paymentService.pollTransaction(String(transaction._id), 'reconciler');
        polled += 1;
      } catch (error: any) {
        // Une transaction en échec ne doit pas interrompre le lot : la
        // suivante appartient peut-être à un autre client qui attend.
        logger.error(`payment.reconcile_poll_failed: ${error.message}`, {
          event: 'payment.reconcile_poll_failed',
          reference: transaction.reference,
        });
      }
    }

    return polled;
  }

  /**
   * Retente les livraisons échouées sur des paiements encaissés.
   *
   * Le plafond de tentatives évite de boucler indéfiniment sur une erreur de
   * programmation ; au-delà, la transaction reste en échec et l'alerte
   * `payment_fulfillment_failures_total` a déjà signalé le problème. Un
   * administrateur peut alors relancer la livraison à la main.
   */
  private async retryFailedFulfillments(): Promise<number> {
    const failed = await PaymentTransaction.find({
      status: 'COMPLETED',
      'fulfillment.state': 'failed',
      'fulfillment.attempts': { $lt: MAX_FULFILL_ATTEMPTS },
    })
      .limit(FULFILL_BATCH_SIZE)
      .select('_id reference depositId fulfillment.attempts')
      .lean();

    let refulfilled = 0;

    for (const transaction of failed) {
      try {
        await paymentService.fulfill(String(transaction._id));
        refulfilled += 1;
      } catch (error: any) {
        logger.error(`payment.reconcile_fulfill_failed: ${error.message}`, {
          event: 'payment.reconcile_fulfill_failed',
          reference: transaction.reference,
        });
      }
    }

    return refulfilled;
  }

  /** Transactions en attente depuis trop longtemps — alimente l'alerte. */
  private async countStuck(): Promise<number> {
    return PaymentTransaction.countDocuments({
      status: { $in: PENDING_PAYMENT_STATUSES },
      createdAt: { $lt: new Date(Date.now() - STUCK_THRESHOLD_MS) },
    });
  }

  /**
   * Relance forcée d'une transaction, depuis le panel admin.
   *
   * Court-circuite l'échéance de relecture : un agent au téléphone avec un
   * client ne va pas attendre le prochain cycle.
   */
  async forceRecheck(reference: string): Promise<void> {
    const transaction = await PaymentTransaction.findOne({ reference }).select('_id').lean();
    if (!transaction) throw new Error(`Paiement ${reference} introuvable`);

    await paymentEventsService.record({
      transactionId: String(transaction._id),
      depositId: reference,
      type: 'admin_action',
      source: 'admin',
      message: 'Vérification manuelle du statut demandée',
      logFields: { reference },
    });

    await paymentService.pollTransaction(String(transaction._id), 'admin');
  }
}

export const paymentReconcilerService = new PaymentReconcilerService();
export default paymentReconcilerService;
