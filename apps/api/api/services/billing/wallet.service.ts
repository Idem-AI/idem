import logger from '../../config/logger';
import { LEGACY_CREDIT_XAF, WALLET_ACCOUNT, topupBonusXaf } from '../../models/offer.model';
import { creditLedgerService, LedgerContext } from './credit-ledger.service';

/**
 * Le portefeuille en francs : un solde, pour tous les services.
 *
 * Il vit dans le même grand livre que les anciens crédits (compte `wallet`), donc avec les mêmes
 * garanties : débit conditionnel atomique (le contrôle de solde est le filtre de la mise à jour),
 * historique append-only, restitution d'une génération en échec.
 *
 * **Les plafonds.** Un achat peut se rattacher à un plafond (`kit:<projet>`, `croissance:2026-10`) :
 * on ne débite alors que ce qui reste sous le plafond, et l'appelant apprend qu'il est atteint —
 * c'est lui qui accorde le Kit ou le forfait. L'utilisateur ne paie ainsi jamais plus que l'offre
 * complète, sans avoir eu à la choisir.
 *
 * **Les anciens crédits.** Les crédits iBusiness restants sont convertis en francs (13 F le crédit)
 * au premier accès au portefeuille : la bascule se fait toute seule, sans script ni perte.
 */

export interface CapRef {
  /** `kit:<projet>`, `croissance:2026-10`, `createur:2026-10`. */
  key: string;
  /** Montant au-delà duquel tout est inclus. */
  capXaf: number;
}

export interface SpendInput {
  priceXaf: number;
  /** Ce qui est acheté, lisible au relevé. */
  label: string;
  /** Action technique (barème historique, analyse). */
  action: string;
  projectId?: string;
  element?: string;
  feature?: string;
  cap?: CapRef;
}

export type SpendResult =
  | {
      allowed: true;
      /** Montant réellement débité (moins que le prix quand le plafond l'absorbe). */
      chargedXaf: number;
      balanceXaf: number;
      ledgerEntryId?: string;
      /** Vrai quand ce paiement atteint (ou avait déjà atteint) le plafond. */
      capReached: boolean;
    }
  | {
      allowed: false;
      chargedXaf: 0;
      balanceXaf: number;
      /** Ce qui manque au portefeuille pour cet achat. */
      missingXaf: number;
      /** Montant qui aurait été débité. */
      dueXaf: number;
    };

export class WalletService {
  /** Solde en francs, après conversion éventuelle des anciens crédits. */
  async balance(userId: string): Promise<number> {
    await this.convertLegacyCredits(userId);
    return creditLedgerService.getBalance(userId, WALLET_ACCOUNT);
  }

  /**
   * Convertit les crédits iBusiness restants en francs.
   *
   * Idempotent : le solde de crédits passe à zéro dans la même opération, une seconde conversion
   * ne trouve plus rien à convertir. Les crédits iCode ne sont PAS convertis : ils deviennent des
   * modifications incluses (1 crédit = 1 modification), ce qui est plus généreux pour leur
   * détenteur.
   */
  async convertLegacyCredits(userId: string): Promise<number> {
    try {
      const credits = await creditLedgerService.getBalance(userId, 'business');
      if (credits <= 0) return 0;

      const debit = await creditLedgerService.debit(userId, 'business', credits, {
        action: 'conversion',
        reason: 'conversion',
        note: `Conversion en francs : ${credits} crédits × ${LEGACY_CREDIT_XAF} F`,
      });
      if (!debit.allowed) return 0;

      const amount = credits * LEGACY_CREDIT_XAF;
      await creditLedgerService.grant(userId, WALLET_ACCOUNT, amount, 'conversion', {
        note: `${credits} crédits iBusiness convertis (${LEGACY_CREDIT_XAF} F le crédit)`,
      });
      logger.info('wallet.legacy_converted', { event: 'wallet.legacy_converted', userId, credits, amountXaf: amount });
      return amount;
    } catch (error: any) {
      logger.error(`wallet.legacy_conversion_failed: ${error.message}`, { event: 'wallet.legacy_conversion_failed', userId });
      return 0;
    }
  }

  /** Recharge, bonus de palier compris. Renvoie le solde après recharge. */
  async topUp(userId: string, amountXaf: number, context: LedgerContext = {}): Promise<{ balanceXaf: number; bonusXaf: number }> {
    let balanceXaf = await creditLedgerService.grant(userId, WALLET_ACCOUNT, amountXaf, 'topup', {
      ...context,
      note: context.note ?? `Recharge de ${amountXaf} F`,
    });
    const bonusXaf = topupBonusXaf(amountXaf);
    if (bonusXaf > 0) {
      balanceXaf = await creditLedgerService.grant(userId, WALLET_ACCOUNT, bonusXaf, 'bonus', {
        ...context,
        note: `Bonus de recharge (+${bonusXaf} F)`,
      });
    }
    return { balanceXaf, bonusXaf };
  }

  /** Versement au portefeuille hors paiement (geste commercial, code, remboursement de commande). */
  async credit(userId: string, amountXaf: number, reason: 'bonus' | 'topup' | 'refund', context: LedgerContext = {}): Promise<number> {
    if (reason === 'refund') return creditLedgerService.refundDebit(userId, WALLET_ACCOUNT, amountXaf, context);
    return creditLedgerService.grant(userId, WALLET_ACCOUNT, amountXaf, reason, context);
  }

  /** Ce qui a déjà été payé sous un plafond. */
  async spentUnderCap(userId: string, capKey: string): Promise<number> {
    return creditLedgerService.spentUnderCap(userId, WALLET_ACCOUNT, capKey);
  }

  /**
   * Débite un achat, en tenant compte de son plafond.
   *
   * Sous plafond, on ne débite que ce qui reste : un projet dont le Kit est déjà payé ne coûte
   * plus rien. La lecture de ce qui a été payé et le débit ne sont pas une seule opération
   * atomique ; deux achats concurrents sur le même plafond peuvent donc le dépasser d'au plus
   * un achat. Le prix d'un livrable étant inférieur au plafond, l'écart reste borné et visible
   * au relevé.
   */
  async spend(userId: string, input: SpendInput): Promise<SpendResult> {
    await this.convertLegacyCredits(userId);

    let due = Math.max(0, Math.round(input.priceXaf));
    let spentBefore = 0;
    if (input.cap) {
      spentBefore = await this.spentUnderCap(userId, input.cap.key);
      due = Math.min(due, Math.max(0, input.cap.capXaf - spentBefore));
    }

    const capReached = Boolean(input.cap && spentBefore + due >= input.cap.capXaf);

    if (due === 0) {
      return { allowed: true, chargedXaf: 0, balanceXaf: await creditLedgerService.getBalance(userId, WALLET_ACCOUNT), capReached };
    }

    const result = await creditLedgerService.debit(userId, WALLET_ACCOUNT, due, {
      action: input.action,
      projectId: input.projectId,
      element: input.element,
      feature: input.feature,
      note: input.label,
      capKey: input.cap?.key,
    });

    if (!result.allowed) {
      return { allowed: false, chargedXaf: 0, balanceXaf: result.balance, missingXaf: due - result.balance, dueXaf: due };
    }
    return { allowed: true, chargedXaf: due, balanceXaf: result.balance, ledgerEntryId: result.ledgerEntryId, capReached };
  }

  /**
   * Restitue un débit (génération en échec, commande refusée). La clé de plafond est reprise :
   * ce qui est restitué ne compte plus comme payé sous ce plafond.
   */
  async refund(userId: string, amountXaf: number, context: LedgerContext & { action: string }): Promise<number> {
    if (amountXaf <= 0) return creditLedgerService.getBalance(userId, WALLET_ACCOUNT);
    return creditLedgerService.refundDebit(userId, WALLET_ACCOUNT, amountXaf, {
      ...context,
      note: context.note ?? 'Génération en échec — montant restitué',
    });
  }

  /** Relevé du portefeuille (et des comptes prépayés), du plus récent au plus ancien. */
  async statement(userId: string, limit = 100): Promise<Record<string, unknown>[]> {
    return creditLedgerService.getStatement(userId, WALLET_ACCOUNT, limit);
  }
}

export const walletService = new WalletService();
export default walletService;
