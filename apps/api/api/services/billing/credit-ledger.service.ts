import logger from '../../config/logger';
import { creditsDebitedTotal } from '../../config/metrics';
import { BILLING_ENGINES, BillingEngine, CreditEntryReason } from '../../models/billing.model';
import { CreditLedgerEntry } from '../../schemas/billing.schema';
import { CreditBalance } from '../../schemas/payment.schema';

/**
 * Compteurs de crédits : le solde d'abord, l'historique ensuite.
 *
 * Le grand livre `credit_ledger` reste ce qu'il était — append-only, avec le
 * solde résultant sur chaque écriture — mais il ne PORTE plus le solde
 * courant. Celui-ci vit dans `credit_balances`, un document par
 * (utilisateur, moteur), et c'est ce changement qui rend le débit juste.
 *
 * **Pourquoi c'était faux avant.** `debitCredits()` lisait le solde, vérifiait
 * qu'il suffisait, puis écrivait. Entre la lecture et l'écriture, un second
 * appel pouvait lire le même solde : deux générations de business plan lancées
 * dans la même seconde étaient facturées une fois. `docs/BILLING.md` signalait
 * la faille en indiquant qu'elle deviendrait réelle à l'activation du débit —
 * ce moment est arrivé.
 *
 * **Pourquoi pas une transaction.** MongoDB ne tourne pas en replica set ici
 * (`docker-compose.dev.yml`, `mongo:7.0` sans `--replSet`), donc pas de
 * transaction possible. Un `findOneAndUpdate` conditionnel suffit : MongoDB
 * garantit l'atomicité d'une mise à jour sur un document unique. La condition
 * `balance >= cost` fait partie du filtre, donc deux débits concurrents ne
 * peuvent pas passer tous les deux.
 *
 * **Ce qui reste possible.** L'écriture du livre suit le mouvement du solde ;
 * un incident entre les deux laisserait un solde à jour sans ligne d'historique.
 * C'est le bon sens du compromis : on préfère perdre une ligne d'historique
 * (détectable en rapprochant les deux collections) que débiter deux fois.
 */

/** Jour UTC `YYYY-MM-DD`, comme partout ailleurs en facturation. */
function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export interface LedgerContext {
  action?: string;
  projectId?: string;
  feature?: string;
  element?: string;
  aiUsageEventId?: string;
  subscriptionId?: string;
  purchaseId?: string;
  paymentTransactionId?: string;
  note?: string;
  expiresAt?: Date;
}

export interface DebitResult {
  allowed: boolean;
  cost: number;
  /** Solde après l'opération, ou solde constaté en cas de refus. */
  balance: number;
  /** Écriture produite, pour pouvoir la contrepasser si la génération échoue. */
  ledgerEntryId?: string;
}

export class CreditLedgerService {
  /**
   * Solde d'un moteur.
   *
   * Si le document de solde n'existe pas encore (compte antérieur à cette
   * mécanique), il est reconstruit depuis le livre puis mémorisé. La migration
   * se fait donc toute seule, au premier accès, sans script de bascule.
   */
  async getBalance(userId: string, engine: BillingEngine): Promise<number> {
    const doc = await CreditBalance.findOne({ userId, engine }).select('balance').lean();
    if (doc) return doc.balance;

    return this.rebuildBalance(userId, engine);
  }

  async getAllBalances(userId: string): Promise<Record<BillingEngine, number>> {
    const balances = await Promise.all(
      BILLING_ENGINES.map(async (engine) => [engine, await this.getBalance(userId, engine)] as const)
    );
    return Object.fromEntries(balances) as Record<BillingEngine, number>;
  }

  /**
   * Reconstruit le solde à partir du grand livre.
   *
   * Somme des mouvements plutôt que dernier `balanceAfter` : si des écritures
   * concurrentes ont produit des `balanceAfter` identiques par le passé, la
   * somme reste la vérité comptable.
   */
  async rebuildBalance(userId: string, engine: BillingEngine): Promise<number> {
    const [row] = await CreditLedgerEntry.aggregate([
      { $match: { userId, engine } },
      { $group: { _id: null, total: { $sum: '$delta' } } },
    ]);

    const total = Math.max(row?.total ?? 0, 0);

    await CreditBalance.updateOne(
      { userId, engine },
      { $setOnInsert: { userId, engine, balance: total } },
      { upsert: true }
    );

    return total;
  }

  /**
   * Crédite un compteur. `$inc` sur un document unique : sûr sous concurrence,
   * et le solde renvoyé par `findOneAndUpdate` est celui d'après l'opération —
   * c'est lui qui est inscrit au livre.
   */
  async grant(
    userId: string,
    engine: BillingEngine,
    amount: number,
    reason: CreditEntryReason,
    context: LedgerContext = {}
  ): Promise<number> {
    if (amount <= 0) throw new Error('Un octroi de crédits doit être positif');

    // Garantit l'existence du document avant l'incrément, sans écraser un
    // solde déjà présent.
    await CreditBalance.updateOne(
      { userId, engine },
      { $setOnInsert: { userId, engine, balance: 0 } },
      { upsert: true }
    );

    const updated = await CreditBalance.findOneAndUpdate(
      { userId, engine },
      { $inc: { balance: amount } },
      { new: true }
    ).lean();

    const balanceAfter = updated?.balance ?? amount;

    await this.appendEntry(userId, engine, amount, balanceAfter, reason, context);

    logger.info('billing.credits_granted', {
      event: 'billing.credits_granted',
      engine,
      amount,
      reason,
      balanceAfter,
    });

    return balanceAfter;
  }

  /**
   * Débite un compteur si le solde suffit.
   *
   * Le contrôle de solde EST le filtre de la mise à jour : aucune fenêtre entre
   * la vérification et l'écriture. Un refus ne produit aucune écriture, donc
   * aucune trace comptable d'un débit qui n'a pas eu lieu.
   */
  async debit(
    userId: string,
    engine: BillingEngine,
    cost: number,
    context: LedgerContext = {}
  ): Promise<DebitResult> {
    if (cost <= 0) {
      // Une action gratuite est autorisée sans mouvement : inscrire un débit
      // nul polluerait le relevé de l'utilisateur.
      return { allowed: true, cost: 0, balance: await this.getBalance(userId, engine) };
    }

    // S'assure que le document existe (et donc que le solde reconstruit d'un
    // ancien compte est pris en compte) avant la mise à jour conditionnelle.
    await this.getBalance(userId, engine);

    const updated = await CreditBalance.findOneAndUpdate(
      { userId, engine, balance: { $gte: cost } },
      { $inc: { balance: -cost } },
      { new: true }
    ).lean();

    if (!updated) {
      const balance = await this.getBalance(userId, engine);
      logger.warn('billing.credits_insufficient', {
        event: 'billing.credits_insufficient',
        engine,
        action: context.action,
        cost,
        balance,
      });
      return { allowed: false, cost, balance };
    }

    const entryId = await this.appendEntry(
      userId,
      engine,
      -cost,
      updated.balance,
      'consumption',
      context
    );

    creditsDebitedTotal.inc(
      { engine, action: context.action ?? 'unknown', service: 'idem-api' },
      cost
    );

    logger.info('billing.credits_debited', {
      event: 'billing.credits_debited',
      engine,
      action: context.action,
      cost,
      balanceAfter: updated.balance,
    });

    return { allowed: true, cost, balance: updated.balance, ledgerEntryId: entryId };
  }

  /**
   * Contrepasse un débit dont la contrepartie n'a pas été livrée.
   *
   * Appelé quand une génération échoue après le débit. Le geste commercial
   * n'est pas une faveur : l'utilisateur a payé un livrable qu'il n'a pas reçu.
   * L'écriture porte la raison `refund` et référence le débit d'origine, pour
   * que le relevé se lise comme une paire.
   */
  async refundDebit(
    userId: string,
    engine: BillingEngine,
    amount: number,
    context: LedgerContext = {}
  ): Promise<number> {
    if (amount <= 0) return this.getBalance(userId, engine);

    const updated = await CreditBalance.findOneAndUpdate(
      { userId, engine },
      { $inc: { balance: amount } },
      { new: true, upsert: true }
    ).lean();

    const balanceAfter = updated?.balance ?? amount;

    await this.appendEntry(userId, engine, amount, balanceAfter, 'refund', {
      ...context,
      note: context.note ?? 'Génération en échec — crédits restitués',
    });

    logger.info('billing.credits_refunded', {
      event: 'billing.credits_refunded',
      engine,
      amount,
      action: context.action,
      balanceAfter,
    });

    return balanceAfter;
  }

  /**
   * Ajuste manuellement un solde (geste commercial, correction de litige).
   *
   * Un motif est exigé : une écriture non motivée sur un compteur de crédits
   * est inauditable, et c'est exactement ce qu'un administrateur doit pouvoir
   * justifier six mois plus tard.
   */
  async adjust(
    userId: string,
    engine: BillingEngine,
    delta: number,
    note: string,
    adminId?: string
  ): Promise<number> {
    if (!note?.trim()) throw new Error('Un ajustement manuel exige un motif');
    if (delta === 0) return this.getBalance(userId, engine);

    await this.getBalance(userId, engine);

    // Un retrait ne peut pas rendre le solde négatif : on plafonne au solde
    // disponible plutôt que de créer une dette que rien ne saurait recouvrer.
    const filter =
      delta < 0
        ? { userId, engine, balance: { $gte: Math.abs(delta) } }
        : { userId, engine };

    const updated = await CreditBalance.findOneAndUpdate(
      filter,
      { $inc: { balance: delta } },
      { new: true }
    ).lean();

    if (!updated) {
      throw new Error(
        `Solde insuffisant pour retirer ${Math.abs(delta)} crédits ${engine} à ${userId}`
      );
    }

    await this.appendEntry(userId, engine, delta, updated.balance, 'manual_adjustment', {
      note: adminId ? `${note} (par ${adminId})` : note,
    });

    logger.warn('billing.credits_adjusted', {
      event: 'billing.credits_adjusted',
      engine,
      delta,
      adminId,
      balanceAfter: updated.balance,
    });

    return updated.balance;
  }

  /**
   * Inscrit une action **incluse dans un livrable déjà payé**, sans mouvement.
   *
   * Les déclinaisons d'un logo font partie des 60 crédits de la charte : les
   * refacturer serait faire payer deux fois le même livrable. Mais ne rien
   * écrire du tout aurait deux défauts — le relevé de l'utilisateur ne
   * montrerait pas ce qu'il a obtenu, et le système ne saurait pas que
   * l'inclusion a été consommée, donc la relance suivante passerait elle aussi
   * pour gratuite.
   *
   * Une écriture à delta zéro règle les deux : elle se lit « inclus », et elle
   * sert de marqueur.
   */
  async recordIncluded(
    userId: string,
    engine: BillingEngine,
    action: string,
    context: LedgerContext = {}
  ): Promise<void> {
    const balance = await this.getBalance(userId, engine);

    await this.appendEntry(userId, engine, 0, balance, 'consumption', {
      ...context,
      action,
      note: context.note ?? 'Inclus dans le livrable déjà facturé',
    });
  }

  /**
   * Cette action a-t-elle déjà été facturée sur ce projet ?
   *
   * Sert au barème « plein tarif la première fois, révision ensuite » : le
   * modèle économique facture un livrable, pas chaque appel au moteur. Générer
   * la charte puis ajuster ses couleurs ne doit pas coûter deux fois 60
   * crédits.
   */
  async hasChargedAction(
    userId: string,
    engine: BillingEngine,
    action: string,
    projectId?: string
  ): Promise<boolean> {
    const filter: Record<string, unknown> = {
      userId,
      engine,
      action,
      reason: 'consumption',
    };
    if (projectId) filter.projectId = projectId;

    const existing = await CreditLedgerEntry.exists(filter);
    return Boolean(existing);
  }

  /**
   * Périme les crédits reportés au-delà de leur validité.
   *
   * Le modèle économique annonce un report de deux mois : ne jamais périmer
   * reviendrait à offrir des crédits illimités dans le temps, et fausserait
   * autant la marge que la promesse commerciale.
   *
   * Deux précautions rendent l'opération juste :
   *
   *  - **on ne périme jamais plus que le solde**. Un octroi de 150 crédits
   *    déjà consommé ne doit pas creuser le compteur : le montant retiré est
   *    plafonné au solde disponible.
   *  - **chaque octroi traité est marqué**, qu'il ait donné lieu à un retrait
   *    ou non. Sans marqueur, la tâche rejouerait éternellement les mêmes
   *    écritures — `expiresAt` restant dans le passé.
   */
  async expireDueGrants(
    now = new Date(),
    limit = 500
  ): Promise<{ accounts: number; credits: number }> {
    const due = await CreditLedgerEntry.find({
      delta: { $gt: 0 },
      expiresAt: { $lte: now },
      expiredAt: { $exists: false },
    })
      .limit(limit)
      .select('_id userId engine delta')
      .lean();

    if (due.length === 0) return { accounts: 0, credits: 0 };

    // Regroupement par compteur : un utilisateur peut avoir plusieurs octrois
    // échus le même jour sur le même moteur.
    const groups = new Map<string, { userId: string; engine: BillingEngine; total: number; ids: unknown[] }>();

    for (const entry of due) {
      const key = `${entry.userId}:${entry.engine}`;
      const group = groups.get(key) ?? {
        userId: entry.userId,
        engine: entry.engine as BillingEngine,
        total: 0,
        ids: [],
      };
      group.total += entry.delta;
      group.ids.push(entry._id);
      groups.set(key, group);
    }

    let credits = 0;

    for (const group of groups.values()) {
      try {
        const balance = await this.getBalance(group.userId, group.engine);
        const amount = Math.min(balance, group.total);

        if (amount > 0) {
          const updated = await CreditBalance.findOneAndUpdate(
            { userId: group.userId, engine: group.engine, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
          ).lean();

          if (updated) {
            await this.appendEntry(
              group.userId,
              group.engine,
              -amount,
              updated.balance,
              'rollover_expiry',
              { note: 'Crédits reportés arrivés à expiration' }
            );
            credits += amount;
          }
        }

        await CreditLedgerEntry.updateMany(
          { _id: { $in: group.ids } },
          { $set: { expiredAt: now } }
        );
      } catch (error: any) {
        logger.error(`billing.credit_expiry_failed: ${error.message}`, {
          event: 'billing.credit_expiry_failed',
          engine: group.engine,
        });
      }
    }

    if (credits > 0) {
      logger.info('billing.credits_expired', {
        event: 'billing.credits_expired',
        accounts: groups.size,
        credits,
      });
    }

    return { accounts: groups.size, credits };
  }

  /** Relevé d'un moteur, le plus récent d'abord. */
  async getStatement(
    userId: string,
    engine?: BillingEngine,
    limit = 100
  ): Promise<Record<string, unknown>[]> {
    const filter: Record<string, unknown> = { userId };
    if (engine) filter.engine = engine;

    return CreditLedgerEntry.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .lean();
  }

  /** Écriture au grand livre. Ne bloque jamais le mouvement de solde. */
  private async appendEntry(
    userId: string,
    engine: BillingEngine,
    delta: number,
    balanceAfter: number,
    reason: CreditEntryReason,
    context: LedgerContext
  ): Promise<string | undefined> {
    try {
      const entry = await CreditLedgerEntry.create({
        userId,
        engine,
        delta,
        balanceAfter,
        reason,
        day: dayKey(),
        ...context,
      });
      return String(entry._id);
    } catch (error: any) {
      // Le solde, lui, est déjà bon. On journalise fort : un écart entre
      // `credit_balances` et la somme du livre se détecte par ce message.
      logger.error(`billing.ledger_write_failed: ${error.message}`, {
        event: 'billing.ledger_write_failed',
        engine,
        delta,
        reason,
      });
      return undefined;
    }
  }
}

export const creditLedgerService = new CreditLedgerService();
export default creditLedgerService;
