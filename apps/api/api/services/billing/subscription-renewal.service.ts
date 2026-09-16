import logger from '../../config/logger';
import { BillingSubscriptionModel } from '../../models/billing.model';
import { BillingSubscription } from '../../schemas/billing.schema';
import { User } from '../../schemas/user.schema';
import { billingService } from '../billing.service';
import { transactionalEmailService } from '../email/email.service';
import { firstNameOf } from '../email/email-layout';
import {
  engineLabel,
  graceStarted,
  renewalReminder,
  subscriptionExpired,
} from '../email/templates';
import { billingSettingsService } from './billing-settings.service';
import { entitlementsService } from './entitlements.service';

/**
 * Cycle de vie des abonnements, sans prélèvement automatique.
 *
 * C'est la contrainte structurante du Mobile Money : personne ne peut être
 * débité sans avoir saisi son code. Un abonnement ne se « renouvelle » donc
 * jamais tout seul — il arrive à échéance, et l'abonné choisit de repayer.
 *
 * Le parcours retenu ménage les deux risques opposés (perdre un client qui a
 * simplement oublié / offrir le service indéfiniment) :
 *
 *   J-3   rappel par e-mail, avec le montant et un lien de paiement
 *   J0    échéance : facture émise, rappel envoyé, accès maintenu
 *   J0→J3 tolérance (`past_due`) : tout continue de fonctionner
 *   J+3   retour à l'offre gratuite, sans rien supprimer
 *
 * Les crédits déjà acquis ne sont jamais repris : ils ont été payés.
 */

/** Abonnements traités par passage, pour borner la durée du verrou. */
const BATCH_SIZE = 200;

export interface RenewalReport {
  reminded: number;
  due: number;
  expired: number;
  failed: number;
}

function dashboardUrl(): string {
  return process.env.IDEM_FRONTEND_URL || 'https://console.idem.africa';
}

function payUrlFor(subscription: { productCode: string; engine: string }): string {
  const params = new URLSearchParams({
    product: subscription.productCode,
    engine: subscription.engine,
  });
  return `${dashboardUrl()}/billing/checkout?${params.toString()}`;
}

export class SubscriptionRenewalService {
  /** Un passage complet. Appelé chaque heure par le planificateur. */
  async run(now = new Date()): Promise<RenewalReport> {
    const settings = await billingSettingsService.get();

    const report: RenewalReport = { reminded: 0, due: 0, expired: 0, failed: 0 };

    report.reminded = await this.sendReminders(settings.reminderDays, settings.graceDays, now);
    report.due = await this.markDue(settings.graceDays, now);
    report.expired = await this.expireGracePeriods(now);

    if (report.reminded || report.due || report.expired) {
      logger.info('billing.renewal_cycle', {
        event: 'billing.renewal_cycle',
        ...report,
      });
    }

    return report;
  }

  /**
   * Relances avant échéance.
   *
   * `lastReminderAt` évite de relancer deux fois le même jour : la tâche tourne
   * toutes les heures, et recevoir vingt-quatre rappels identiques ferait plus
   * pour la résiliation que pour le renouvellement.
   */
  private async sendReminders(
    reminderDays: number[],
    graceDays: number,
    now: Date
  ): Promise<number> {
    const maxDays = Math.max(...reminderDays, 0);
    const horizon = new Date(now.getTime() + maxDays * 86_400_000);

    const candidates = await BillingSubscription.find({
      status: 'active',
      priceXaf: { $gt: 0 },
      // Un accès offert n'a pas d'échéance à payer : la bêta a son propre cycle.
      provider: { $ne: 'beta' },
      cancelAtPeriodEnd: { $ne: true },
      currentPeriodEnd: { $gt: now, $lte: horizon },
    })
      .limit(BATCH_SIZE)
      .lean();

    let sent = 0;

    for (const subscription of candidates) {
      const daysLeft = Math.ceil(
        (subscription.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000
      );

      if (!reminderDays.includes(daysLeft)) continue;

      // Déjà relancé aujourd'hui ?
      if (
        subscription.lastReminderAt &&
        subscription.lastReminderAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
      ) {
        continue;
      }

      const notified = await this.notify(subscription, (user, product) =>
        renewalReminder({
          firstName: firstNameOf(user.displayName, user.email),
          planName: product?.name ?? subscription.productCode,
          engine: subscription.engine,
          amountXaf: subscription.priceXaf,
          dueDate: subscription.currentPeriodEnd,
          daysLeft,
          payUrl: payUrlFor(subscription),
          graceDays,
        })
      );

      if (notified) {
        await BillingSubscription.updateOne(
          { _id: subscription._id },
          { $set: { lastReminderAt: now } }
        );
        sent += 1;
      }
    }

    return sent;
  }

  /**
   * Échéances atteintes : facture émise, tolérance ouverte.
   *
   * L'accès n'est PAS coupé ici. La facture matérialise la créance, la
   * tolérance donne à l'abonné le temps d'aller payer — un retard de trois
   * jours est banal quand il faut sortir son téléphone et saisir un code.
   */
  private async markDue(graceDays: number, now: Date): Promise<number> {
    const due = await BillingSubscription.find({
      status: 'active',
      priceXaf: { $gt: 0 },
      provider: { $ne: 'beta' },
      currentPeriodEnd: { $lte: now },
    })
      .limit(BATCH_SIZE)
      .lean();

    let processed = 0;

    for (const subscription of due) {
      try {
        const product = await billingService.getProduct(subscription.productCode);

        // Résiliation demandée : la période payée s'achève, on n'émet rien.
        if (subscription.cancelAtPeriodEnd) {
          await this.downgrade(subscription, 'canceled');
          processed += 1;
          continue;
        }

        await billingService.issueInvoice({
          userId: subscription.userId,
          subscriptionId: String(subscription._id),
          productCode: subscription.productCode,
          kind: product?.kind ?? 'subscription',
          engine: subscription.engine,
          amountXaf: subscription.priceXaf,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          provider: subscription.provider,
        });

        const graceEndsAt = new Date(now.getTime() + graceDays * 86_400_000);

        await BillingSubscription.updateOne(
          { _id: subscription._id },
          { $set: { status: 'past_due', graceEndsAt } }
        );

        await entitlementsService.invalidate(subscription.userId);

        await this.notify(subscription, (user, resolvedProduct) =>
          graceStarted({
            firstName: firstNameOf(user.displayName, user.email),
            planName: resolvedProduct?.name ?? subscription.productCode,
            engine: subscription.engine,
            amountXaf: subscription.priceXaf,
            graceEndsAt,
            payUrl: payUrlFor(subscription),
          })
        );

        processed += 1;
      } catch (error: any) {
        logger.error(`billing.renewal_due_failed: ${error.message}`, {
          event: 'billing.renewal_due_failed',
          subscriptionId: String(subscription._id),
        });
      }
    }

    return processed;
  }

  /** Tolérance dépassée : retour à l'offre gratuite. */
  private async expireGracePeriods(now: Date): Promise<number> {
    const expired = await BillingSubscription.find({
      status: 'past_due',
      graceEndsAt: { $lte: now },
    })
      .limit(BATCH_SIZE)
      .lean();

    let processed = 0;

    for (const subscription of expired) {
      try {
        await this.downgrade(subscription, 'expired');
        processed += 1;
      } catch (error: any) {
        logger.error(`billing.renewal_expire_failed: ${error.message}`, {
          event: 'billing.renewal_expire_failed',
          subscriptionId: String(subscription._id),
        });
      }
    }

    return processed;
  }

  /**
   * Ferme un abonnement et rend le compte à l'offre gratuite.
   *
   * Aucune donnée n'est supprimée et aucun crédit n'est repris : ce qui a été
   * payé reste acquis. Seules les limites de plan redescendent.
   */
  private async downgrade(
    subscription: BillingSubscriptionModel & { _id?: unknown },
    status: 'expired' | 'canceled'
  ): Promise<void> {
    await BillingSubscription.updateOne(
      { _id: (subscription as { _id: unknown })._id },
      { $set: { status, canceledAt: new Date() }, $unset: { graceEndsAt: '' } }
    );

    // Le palier du compte ne redescend que si plus AUCUN abonnement payant ne
    // subsiste : un client peut perdre iDeploy et garder iBusiness Cabinet.
    const remaining = await BillingSubscription.countDocuments({
      userId: subscription.userId,
      status: { $in: ['active', 'trialing'] },
      priceXaf: { $gt: 0 },
    });

    if (remaining === 0) {
      await User.updateOne({ uid: subscription.userId }, { $set: { subscription: 'free' } });
    }

    await entitlementsService.invalidate(subscription.userId);

    logger.info('billing.subscription_downgraded', {
      event: 'billing.subscription_downgraded',
      engine: subscription.engine,
      productCode: subscription.productCode,
      status,
      remainingPaid: remaining,
    });

    if (status === 'expired') {
      await this.notify(subscription, (user, product) =>
        subscriptionExpired({
          firstName: firstNameOf(user.displayName, user.email),
          planName: product?.name ?? subscription.productCode,
          engine: subscription.engine,
          payUrl: payUrlFor(subscription),
        })
      );
    }
  }

  /**
   * Compose et envoie un message lié à un abonnement.
   *
   * Un échec d'envoi n'interrompt jamais la transition d'état : l'abonnement
   * doit changer de statut même si le serveur SMTP est indisponible, sans quoi
   * un incident de messagerie figerait la facturation.
   */
  private async notify(
    subscription: { userId: string; productCode: string; engine: string },
    build: (
      user: { email: string; displayName?: string },
      product: { name: string } | null
    ) => { subject: string; html: string; text: string }
  ): Promise<boolean> {
    try {
      const user = await User.findOne({ uid: subscription.userId })
        .select('email displayName')
        .lean();

      if (!user?.email) return false;

      const product = await billingService.getProduct(subscription.productCode);
      const message = build(user as { email: string; displayName?: string }, product);

      const result = await transactionalEmailService.send({
        to: user.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        template: `subscription.${subscription.engine}`,
        relatedType: 'subscription',
        relatedId: subscription.productCode,
        userId: subscription.userId,
      });

      return result.sent;
    } catch (error: any) {
      logger.error(`billing.renewal_notify_failed: ${error.message}`, {
        event: 'billing.renewal_notify_failed',
        engine: subscription.engine,
        product: subscription.productCode,
        label: engineLabel(subscription.engine),
      });
      return false;
    }
  }
}

export const subscriptionRenewalService = new SubscriptionRenewalService();
export default subscriptionRenewalService;
