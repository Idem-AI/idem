import { randomUUID } from 'crypto';
import logger from '../../config/logger';
import {
  ACTIVE_BETA_STATUSES,
  BetaImportReport,
  BetaImportRow,
  BetaTesterModel,
  isValidEmail,
  monthKey,
  normalizeEmail,
} from '../../models/beta.model';
import { BillingEngine } from '../../models/billing.model';
import { BetaTester } from '../../schemas/betaTester.schema';
import { BillingSubscription } from '../../schemas/billing.schema';
import { User } from '../../schemas/user.schema';
import { billingService } from '../billing.service';
import { firstNameOf } from '../email/email-layout';
import { transactionalEmailService } from '../email/email.service';
import { betaEnding, betaInvitation } from '../email/templates';
import { billingSettingsService } from './billing-settings.service';
import { creditLedgerService } from './credit-ledger.service';
import { entitlementsService } from './entitlements.service';

/**
 * Programme bêta premium : ouvrir le haut de gamme, gratuitement, jusqu'à une
 * date décidée par l'équipe.
 *
 * Trois principes tiennent l'implémentation :
 *
 * **1. Un accès offert n'est pas une vente.** Les abonnements créés portent
 * `provider: 'beta'`, un prix nul et le statut `trialing` : ils n'entrent donc
 * ni dans le chiffre d'affaires ni dans le MRR, et le tableau de bord de
 * rentabilité continue de dire la vérité.
 *
 * **2. Le coût est borné.** Les bêta-testeurs reçoivent les crédits du plan
 * (1 500 + 1 500 par mois), rechargés mensuellement — pas un accès illimité.
 * C'est ce qui rend le programme finançable : le coût d'inférence a un
 * plafond connu, par personne et par mois.
 *
 * **3. La fin du programme est prévue dès le début.** Rien n'est supprimé, les
 * crédits acquis restent, et chacun est prévenu une semaine avant. Une bêta
 * qui s'arrête brutalement transforme des ambassadeurs en mécontents.
 */

export class BetaService {
  // ============================================
  // LISTE
  // ============================================

  /**
   * Importe une liste d'adresses.
   *
   * En simulation (`dryRun`), rien n'est écrit : le panel admin affiche le
   * rapport — combien d'adresses ont un compte, combien sont en doublon,
   * lesquelles sont invalides — et l'administrateur confirme ensuite. Importer
   * un fichier de plusieurs centaines de lignes sans voir ce qu'il contient
   * serait le meilleur moyen d'inviter n'importe qui.
   */
  async importList(
    rows: BetaImportRow[],
    options: { dryRun?: boolean; addedBy?: string } = {}
  ): Promise<BetaImportReport> {
    const dryRun = options.dryRun ?? true;

    const report: BetaImportReport = {
      received: rows.length,
      accepted: 0,
      matched: 0,
      pending: 0,
      duplicates: 0,
      invalid: [],
      dryRun,
    };

    const seen = new Set<string>();
    const candidates: { email: string; name?: string; message?: string }[] = [];

    for (const row of rows) {
      const email = normalizeEmail(row.email ?? '');

      if (!email) {
        report.invalid.push({ email: String(row.email ?? ''), reason: 'Adresse vide' });
        continue;
      }
      if (!isValidEmail(email)) {
        report.invalid.push({ email, reason: 'Adresse invalide' });
        continue;
      }
      if (seen.has(email)) {
        report.duplicates += 1;
        continue;
      }

      seen.add(email);
      candidates.push({ email, name: row.name?.trim(), message: row.message?.trim() });
    }

    if (candidates.length === 0) return report;

    const emails = candidates.map((candidate) => candidate.email);

    // Rapprochement insensible à la casse : les adresses des comptes sont
    // stockées telles que saisies à l'inscription.
    const [existingTesters, users] = await Promise.all([
      BetaTester.find({ email: { $in: emails } })
        .select('email')
        .lean(),
      User.find({ email: { $in: emails.map((email) => new RegExp(`^${escapeRegex(email)}$`, 'i')) } })
        .select('uid email')
        .lean(),
    ]);

    const alreadyListed = new Set(existingTesters.map((tester) => tester.email));
    const accountByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.uid]));

    const batchId = randomUUID();

    for (const candidate of candidates) {
      if (alreadyListed.has(candidate.email)) {
        report.duplicates += 1;
        continue;
      }

      const userId = accountByEmail.get(candidate.email);
      report.accepted += 1;

      if (userId) report.matched += 1;
      else report.pending += 1;

      if (dryRun) continue;

      await BetaTester.updateOne(
        { email: candidate.email },
        {
          $setOnInsert: {
            email: candidate.email,
            name: candidate.name,
            personalMessage: candidate.message,
            source: 'csv',
            importBatchId: batchId,
            status: userId ? 'account_found' : 'pending_account',
            userId,
            addedBy: options.addedBy,
          },
        },
        { upsert: true }
      );
    }

    if (!dryRun) {
      report.batchId = batchId;
      logger.info('beta.list_imported', {
        event: 'beta.list_imported',
        batchId,
        accepted: report.accepted,
        matched: report.matched,
        pending: report.pending,
      });
    }

    return report;
  }

  /** Ajoute une adresse à la main. */
  async addTester(
    email: string,
    options: { name?: string; message?: string; addedBy?: string } = {}
  ): Promise<BetaTesterModel> {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) throw new Error(`Adresse invalide : ${email}`);

    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(normalized)}$`, 'i') })
      .select('uid')
      .lean();

    await BetaTester.updateOne(
      { email: normalized },
      {
        $setOnInsert: {
          email: normalized,
          name: options.name,
          personalMessage: options.message,
          source: 'manual',
          status: user ? 'account_found' : 'pending_account',
          userId: user?.uid,
          addedBy: options.addedBy,
        },
      },
      { upsert: true }
    );

    const tester = await BetaTester.findOne({ email: normalized }).lean();
    return { ...tester, id: String(tester!._id) } as BetaTesterModel;
  }

  async list(filters: { status?: string; search?: string; limit?: number } = {}): Promise<BetaTesterModel[]> {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.search) query.email = new RegExp(escapeRegex(filters.search.toLowerCase()), 'i');

    const testers = await BetaTester.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(filters.limit ?? 200, 1), 1000))
      .lean();

    return testers.map((tester) => ({ ...tester, id: String(tester._id) }) as BetaTesterModel);
  }

  // ============================================
  // OCTROI DES DROITS
  // ============================================

  /**
   * Ouvre les offres premium à un compte et envoie l'invitation.
   *
   * Idempotent : ré-inviter quelqu'un ne crée pas de second abonnement (l'index
   * unique par moteur l'interdirait de toute façon) et ne recharge pas ses
   * crédits deux fois dans le même mois.
   */
  async grantAccess(
    email: string,
    options: { sendEmail?: boolean } = {}
  ): Promise<{ granted: boolean; reason?: string }> {
    const normalized = normalizeEmail(email);
    const tester = await BetaTester.findOne({ email: normalized });

    if (!tester) return { granted: false, reason: 'Adresse absente de la liste' };
    if (tester.status === 'revoked') return { granted: false, reason: 'Accès retiré' };

    const settings = await billingSettingsService.get();
    if (!settings.beta.enabled) return { granted: false, reason: 'Programme bêta désactivé' };

    const user =
      (tester.userId ? await User.findOne({ uid: tester.userId }).select('uid email displayName').lean() : null) ??
      (await User.findOne({ email: new RegExp(`^${escapeRegex(normalized)}$`, 'i') })
        .select('uid email displayName')
        .lean());

    if (!user) {
      // Cas normal : l'adresse a été inscrite avant la création du compte.
      // L'invitation partira automatiquement à l'inscription.
      await BetaTester.updateOne({ email: normalized }, { $set: { status: 'pending_account' } });
      return { granted: false, reason: 'Aucun compte IDEM pour cette adresse' };
    }

    const endsAt = settings.beta.endsAt ?? null;

    // La période d'accès s'arrête à la fin du programme : sans cela, un
    // abonnement offert survivrait à la bêta elle-même.
    const periodEnd = endsAt ?? new Date(Date.now() + 365 * 86_400_000);

    const opened: string[] = [];

    for (const productCode of settings.beta.planCodes) {
      try {
        const product = await billingService.getProduct(productCode);
        if (!product) {
          logger.warn('beta.unknown_plan', { event: 'beta.unknown_plan', productCode });
          continue;
        }

        await billingService.subscribe(user.uid, productCode, {
          provider: 'beta',
          priceOverrideXaf: 0,
          status: 'trialing',
        });

        // La période suit la bêta, pas le mois calendaire.
        await BillingSubscription.updateOne(
          { userId: user.uid, productCode, status: 'trialing' },
          { $set: { currentPeriodEnd: periodEnd } }
        );

        opened.push(product.name);
      } catch (error: any) {
        logger.error(`beta.grant_plan_failed: ${error.message}`, {
          event: 'beta.grant_plan_failed',
          productCode,
        });
      }
    }

    await this.topUpCredits(user.uid, settings.beta.monthlyCredits);

    await BetaTester.updateOne(
      { email: normalized },
      {
        $set: {
          status: 'invited',
          userId: user.uid,
          grantedAt: new Date(),
          lastCreditedMonth: monthKey(),
        },
      }
    );

    await entitlementsService.invalidate(user.uid);

    logger.info('beta.access_granted', {
      event: 'beta.access_granted',
      userId: user.uid,
      plans: opened,
      endsAt,
    });

    if (options.sendEmail !== false) {
      await this.sendInvitation(normalized, user, opened, settings.beta, tester.personalMessage);
    }

    return { granted: true };
  }

  /** Crédite les compteurs du mois. Sans bonus de fidélité : c'est un cadeau, pas une ancienneté. */
  private async topUpCredits(
    userId: string,
    monthlyCredits: { business: number; appgen: number }
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 2);

    const grants: [BillingEngine, number][] = [
      ['business', monthlyCredits.business],
      ['appgen', monthlyCredits.appgen],
    ];

    for (const [engine, amount] of grants) {
      if (amount > 0) {
        await creditLedgerService.grant(userId, engine, amount, 'plan_grant', {
          note: 'Crédits bêta premium du mois',
          expiresAt,
        });
      }
    }
  }

  private async sendInvitation(
    email: string,
    user: { uid: string; email: string; displayName?: string },
    plans: string[],
    beta: { monthlyCredits: { business: number; appgen: number }; endsAt: Date | null },
    personalMessage?: string
  ): Promise<void> {
    // Valeur mensuelle affichée dans l'invitation : calculée depuis le
    // catalogue, jamais écrite en dur — un prix ajusté doit s'y refléter.
    const settings = await billingSettingsService.get();
    let monthlyValueXaf = 0;

    for (const productCode of settings.beta.planCodes) {
      const product = await billingService.getProduct(productCode);
      if (product?.interval === 'month') monthlyValueXaf += product.priceXaf;
    }

    const message = betaInvitation({
      firstName: firstNameOf(user.displayName, user.email),
      plans,
      monthlyCredits: beta.monthlyCredits,
      endsAt: beta.endsAt,
      personalMessage,
      monthlyValueXaf: monthlyValueXaf > 0 ? monthlyValueXaf : undefined,
    });

    const result = await transactionalEmailService.send({
      to: user.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      template: 'beta.invitation',
      relatedType: 'beta',
      relatedId: email,
      userId: user.uid,
    });

    await BetaTester.updateOne(
      { email },
      {
        $set: {
          invitedAt: new Date(),
          email_state: {
            sentAt: result.sent ? new Date() : undefined,
            messageId: result.messageId,
            error: result.error,
            attempts: result.attempts,
          },
        },
      }
    );
  }

  /** Retire quelqu'un du programme. Les crédits déjà accordés restent acquis. */
  async revoke(email: string, reason: string, adminId?: string): Promise<boolean> {
    const normalized = normalizeEmail(email);
    const tester = await BetaTester.findOne({ email: normalized }).lean();
    if (!tester) return false;

    if (tester.userId) {
      await BillingSubscription.updateMany(
        { userId: tester.userId, provider: 'beta', status: { $in: ['active', 'trialing'] } },
        { $set: { status: 'canceled', canceledAt: new Date() } }
      );
      await User.updateOne({ uid: tester.userId }, { $set: { subscription: 'free' } });
      await entitlementsService.invalidate(tester.userId);
    }

    await BetaTester.updateOne(
      { email: normalized },
      { $set: { status: 'revoked', revokedAt: new Date(), revokedReason: reason } }
    );

    logger.warn('beta.access_revoked', {
      event: 'beta.access_revoked',
      userId: tester.userId,
      reason,
      adminId,
    });

    return true;
  }

  // ============================================
  // INSCRIPTION
  // ============================================

  /**
   * Rattache un compte qui vient d'être créé, si son adresse est sur la liste.
   *
   * Appelée à la création de compte. L'invitation part immédiatement quand le
   * réglage l'autorise : quelqu'un qui s'inscrit après avoir reçu une promesse
   * d'accès premium doit le constater dès sa première connexion, pas le
   * lendemain.
   */
  async matchOnSignup(userId: string, email: string): Promise<boolean> {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;

    const tester = await BetaTester.findOne({ email: normalized }).lean();
    if (!tester || tester.status === 'revoked' || tester.status === 'expired') return false;

    await BetaTester.updateOne(
      { email: normalized },
      { $set: { userId, status: tester.status === 'pending_account' ? 'account_found' : tester.status } }
    );

    const settings = await billingSettingsService.get();
    if (!settings.beta.enabled || !settings.beta.autoInviteOnSignup) return false;
    if (!(await billingSettingsService.isBetaWindowOpen())) return false;

    logger.info('beta.matched_on_signup', { event: 'beta.matched_on_signup', userId });

    const result = await this.grantAccess(normalized);
    return result.granted;
  }

  // ============================================
  // ENTRETIEN DU PROGRAMME
  // ============================================

  /**
   * Passage périodique : recharge du mois, avertissement à J-7, clôture.
   *
   * Les trois opérations tiennent dans la même tâche parce qu'elles partagent
   * la même question — où en est la bêta ? — et qu'aucune n'est coûteuse.
   */
  async run(now = new Date()): Promise<{ credited: number; warned: number; expired: number }> {
    const settings = await billingSettingsService.get();
    const report = { credited: 0, warned: 0, expired: 0 };

    if (!settings.beta.enabled) return report;

    const endsAt = settings.beta.endsAt;
    const windowOpen = !endsAt || endsAt.getTime() > now.getTime();

    if (!windowOpen) {
      report.expired = await this.closeProgram(endsAt!, now);
      return report;
    }

    report.credited = await this.creditCurrentMonth(settings.beta.monthlyCredits, now);

    if (endsAt) {
      const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft === 7) report.warned = await this.warnEnding(endsAt, daysLeft);
    }

    return report;
  }

  /** Recharge les compteurs des testeurs actifs, une fois par mois. */
  private async creditCurrentMonth(
    monthlyCredits: { business: number; appgen: number },
    now: Date
  ): Promise<number> {
    const month = monthKey(now);

    const testers = await BetaTester.find({
      status: { $in: ACTIVE_BETA_STATUSES },
      userId: { $exists: true },
      lastCreditedMonth: { $ne: month },
    })
      .limit(500)
      .lean();

    let credited = 0;

    for (const tester of testers) {
      try {
        await this.topUpCredits(tester.userId!, monthlyCredits);
        await BetaTester.updateOne({ _id: tester._id }, { $set: { lastCreditedMonth: month } });
        await entitlementsService.invalidate(tester.userId!);
        credited += 1;
      } catch (error: any) {
        logger.error(`beta.credit_failed: ${error.message}`, {
          event: 'beta.credit_failed',
          userId: tester.userId,
        });
      }
    }

    if (credited > 0) {
      logger.info('beta.monthly_credits', { event: 'beta.monthly_credits', month, credited });
    }

    return credited;
  }

  /** Prévient les testeurs une semaine avant la fin. */
  private async warnEnding(endsAt: Date, daysLeft: number): Promise<number> {
    const testers = await BetaTester.find({ status: { $in: ACTIVE_BETA_STATUSES } })
      .limit(500)
      .lean();

    let warned = 0;

    for (const tester of testers) {
      if (!tester.userId) continue;

      const user = await User.findOne({ uid: tester.userId }).select('email displayName').lean();
      if (!user?.email) continue;

      const message = betaEnding({
        firstName: firstNameOf(user.displayName, user.email),
        endsAt,
        daysLeft,
        plansUrl: `${process.env.IDEM_FRONTEND_URL || 'https://console.idem.africa'}/billing/plans`,
      });

      const result = await transactionalEmailService.send({
        to: user.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        template: 'beta.ending',
        relatedType: 'beta',
        relatedId: tester.email,
        userId: tester.userId,
      });

      if (result.sent) warned += 1;
    }

    return warned;
  }

  /**
   * Clôture : les accès offerts prennent fin, rien n'est supprimé.
   *
   * Les crédits déjà accordés restent utilisables jusqu'à leur expiration —
   * ils ont été donnés, les reprendre serait une rupture de parole.
   */
  private async closeProgram(endsAt: Date, now: Date): Promise<number> {
    const testers = await BetaTester.find({ status: { $in: ACTIVE_BETA_STATUSES } })
      .limit(500)
      .lean();

    let closed = 0;

    for (const tester of testers) {
      try {
        if (tester.userId) {
          await BillingSubscription.updateMany(
            { userId: tester.userId, provider: 'beta', status: { $in: ['active', 'trialing'] } },
            { $set: { status: 'expired', canceledAt: now } }
          );

          const remainingPaid = await BillingSubscription.countDocuments({
            userId: tester.userId,
            status: { $in: ['active', 'trialing'] },
            priceXaf: { $gt: 0 },
          });

          if (remainingPaid === 0) {
            await User.updateOne({ uid: tester.userId }, { $set: { subscription: 'free' } });
          }

          await entitlementsService.invalidate(tester.userId);

          const user = await User.findOne({ uid: tester.userId })
            .select('email displayName')
            .lean();

          if (user?.email) {
            const message = betaEnding({
              firstName: firstNameOf(user.displayName, user.email),
              endsAt,
              daysLeft: 0,
              plansUrl: `${process.env.IDEM_FRONTEND_URL || 'https://console.idem.africa'}/billing/plans`,
            });

            await transactionalEmailService.send({
              to: user.email,
              subject: message.subject,
              html: message.html,
              text: message.text,
              template: 'beta.ended',
              relatedType: 'beta',
              relatedId: tester.email,
              userId: tester.userId,
            });
          }
        }

        await BetaTester.updateOne({ _id: tester._id }, { $set: { status: 'expired' } });
        closed += 1;
      } catch (error: any) {
        logger.error(`beta.close_failed: ${error.message}`, {
          event: 'beta.close_failed',
          userId: tester.userId,
        });
      }
    }

    if (closed > 0) {
      logger.info('beta.program_closed', { event: 'beta.program_closed', closed, endsAt });
    }

    return closed;
  }
}

/** Échappe une saisie utilisateur avant de l'employer dans une expression régulière. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const betaService = new BetaService();
export default betaService;
