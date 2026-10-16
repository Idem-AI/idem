import logger from '../../config/logger';
import { ICODE, PASSES, PassCode, endOfMonth } from '../../models/offer.model';
import { BillingPurchase } from '../../schemas/billing.schema';
import { creditLedgerService } from './credit-ledger.service';
import { walletService, SpendResult } from './wallet.service';

/**
 * Les forfaits du mois : IDEM Croissance, IDEM Entreprise, iVision Créateur.
 *
 * Un forfait est une période d'accès (`billing_purchases`, `kind: day_pass`, `pass-<code>`), qui
 * s'obtient de trois façons :
 *  - **acheté** depuis le portefeuille, au mois ou à l'année ;
 *  - **gagné** par le plafond automatique : les achats du mois qui atteignent son prix ;
 *  - **offert** : 7 jours de Croissance à l'inscription, accès bêta.
 *
 * Il n'y a pas de renouvellement automatique : le mobile money ne prélève pas sans action du
 * client. Un rappel prévient avant la fin, et le plafond automatique reprend le relais si
 * l'utilisateur continue à acheter à l'unité.
 */

export const PASS_PRODUCT_PREFIX = 'pass-';

export interface ActivePasses {
  croissance?: Date;
  entreprise?: Date;
  createur?: Date;
}

const DAY_MS = 86_400_000;

export class PassService {
  /** Fin de chaque forfait actif (le plus lointain s'il y en a plusieurs). */
  async active(userId: string, at = new Date()): Promise<ActivePasses> {
    const rows = await BillingPurchase.find({
      userId,
      kind: 'day_pass',
      productCode: { $in: Object.keys(PASSES).map((code) => `${PASS_PRODUCT_PREFIX}${code}`) },
      expiresAt: { $gt: at },
    })
      .select('productCode expiresAt')
      .lean();

    const passes: ActivePasses = {};
    for (const row of rows as { productCode: string; expiresAt: Date }[]) {
      const code = row.productCode.slice(PASS_PRODUCT_PREFIX.length) as PassCode;
      if (!passes[code] || passes[code]! < row.expiresAt) passes[code] = row.expiresAt;
    }
    return passes;
  }

  /** Accorde un forfait jusqu'à une date (prolonge s'il est déjà actif). */
  async grant(
    userId: string,
    code: PassCode,
    until: Date,
    source: { provider: 'manual' | 'welcome' | 'beta'; priceXaf?: number; note?: string }
  ): Promise<Date> {
    const now = new Date();
    if (until <= now) return until;

    await BillingPurchase.create({
      userId,
      productCode: `${PASS_PRODUCT_PREFIX}${code}`,
      kind: 'day_pass',
      engine: null,
      priceXaf: source.priceXaf ?? 0,
      creditsGranted: 0,
      expiresAt: until,
      provider: source.provider,
      day: now.toISOString().slice(0, 10),
    });

    // Les modifications iCode incluses dans le forfait, valables jusqu'à sa fin.
    if (code === 'croissance' || code === 'entreprise') {
      // Au prorata des jours (7 jours offerts → 5 modifications), un mois au moins pour un achat.
      const days = (until.getTime() - now.getTime()) / DAY_MS;
      const modifications = Math.max(1, Math.round((ICODE.croissanceModificationsPerMonth * days) / 30));
      await creditLedgerService.grant(userId, 'appgen', modifications, 'pass_grant', {
        expiresAt: until,
        note: `${PASSES[code].label} : modifications iCode incluses`,
      });
    }

    logger.info('billing.pass_granted', { event: 'billing.pass_granted', userId, code, until: until.toISOString(), provider: source.provider });
    return until;
  }

  /**
   * Achète un forfait depuis le portefeuille. Prolonge la période en cours plutôt que de la
   * remplacer : payer deux fois le même mois n'en offre pas un seul.
   */
  async buy(userId: string, code: PassCode, interval: 'month' | 'year'): Promise<SpendResult & { until?: Date }> {
    const offer = PASSES[code];
    const price = interval === 'year' ? offer.annualXaf : offer.monthlyXaf;
    const spend = await walletService.spend(userId, {
      priceXaf: price,
      label: `${offer.label} — ${interval === 'year' ? '12 mois' : '1 mois'}`,
      action: `pass_${code}`,
    });
    if (!spend.allowed) return spend;

    const current = (await this.active(userId))[code];
    const start = current && current > new Date() ? current : new Date();
    const until = new Date(start.getTime() + (interval === 'year' ? 365 : 30) * DAY_MS);
    await this.grant(userId, code, until, { provider: 'manual', priceXaf: price, note: 'Acheté depuis le portefeuille' });
    return { ...spend, until };
  }

  /** Le plafond du mois est atteint : le forfait court jusqu'à la fin du mois. */
  async grantFromCap(userId: string, code: 'croissance' | 'createur'): Promise<void> {
    const current = (await this.active(userId))[code];
    const until = endOfMonth();
    if (current && current >= until) return;
    await this.grant(userId, code, until, { provider: 'manual', note: 'Plafond du mois atteint' });
  }
}

export const passService = new PassService();
export default passService;
