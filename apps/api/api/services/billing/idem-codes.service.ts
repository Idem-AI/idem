import { randomBytes, randomUUID } from 'crypto';
import logger from '../../config/logger';
import { IdemCodeKind, PACKS } from '../../models/offer.model';
import { IdemCode } from '../../schemas/offer.schema';
import { walletService } from './wallet.service';

/**
 * Les codes IDEM : la recharge en espèces et le cadeau.
 *
 *  - Un **code portefeuille** se vend en espèces chez un agent mobile money ou un kiosque, comme
 *    une carte de recharge téléphonique : saisi dans IDEM, il crédite le portefeuille. L'agent
 *    touche une commission sur les codes de son lot.
 *  - Un **code pack** vaut un Pack Lancement : c'est ce que reçoit l'acheteur d'un pack
 *    « À plusieurs » (association, tontine, coopérative) pour l'offrir à ses membres.
 *
 * Un code se saisit une seule fois : la consommation est un `findOneAndUpdate` conditionnel.
 */

/** Alphabet sans caractères ambigus (ni 0/O, ni 1/I/L) : un code se dicte au téléphone. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomCode(): string {
  const bytes = randomBytes(10);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `IDEM-${chars.slice(0, 5)}-${chars.slice(5, 10)}`;
}

export function normalizeCode(input: string): string {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^IDEM/, '')
    .replace(/^(.{5})(.{5})$/, 'IDEM-$1-$2');
}

export type RedeemOutcome =
  | { ok: true; kind: 'wallet'; valueXaf: number; balanceXaf: number }
  | { ok: true; kind: 'pack_lancement'; code: string }
  | { ok: false; reason: 'unknown_code' | 'already_redeemed' | 'expired' };

export class IdemCodesService {
  /** Crée un lot de codes (administration, agent, ou pack « À plusieurs »). */
  async generate(input: {
    kind: IdemCodeKind;
    valueXaf: number;
    count: number;
    createdBy: string;
    agentId?: string;
    expiresAt?: Date;
  }): Promise<{ batchId: string; codes: string[] }> {
    const batchId = randomUUID();
    const codes: string[] = [];
    while (codes.length < input.count) {
      const code = randomCode();
      try {
        await IdemCode.create({ code, kind: input.kind, valueXaf: input.valueXaf, batchId, createdBy: input.createdBy, agentId: input.agentId, expiresAt: input.expiresAt });
        codes.push(code);
      } catch (error: any) {
        // Collision improbable sur 31^10 combinaisons : on retire un code.
        if (error?.code !== 11000) throw error;
      }
    }
    logger.info('billing.codes_generated', { event: 'billing.codes_generated', batchId, kind: input.kind, count: codes.length, agentId: input.agentId });
    return { batchId, codes };
  }

  /**
   * Réserve un code pour un utilisateur. Un code portefeuille crédite tout de suite ; un code
   * pack est appliqué par l'appelant (il faut un projet), qui le libère s'il échoue.
   */
  async claim(userId: string, rawCode: string, projectId?: string): Promise<RedeemOutcome> {
    const code = normalizeCode(rawCode);
    const now = new Date();
    const claimed = await IdemCode.findOneAndUpdate(
      { code, redeemedBy: { $exists: false }, $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $set: { redeemedBy: userId, redeemedAt: now, ...(projectId ? { redeemedProjectId: projectId } : {}) } },
      { new: true }
    ).lean();

    if (!claimed) {
      const existing = await IdemCode.findOne({ code }).lean();
      if (!existing) return { ok: false, reason: 'unknown_code' };
      if (existing.redeemedBy) return { ok: false, reason: 'already_redeemed' };
      return { ok: false, reason: 'expired' };
    }

    if (claimed.kind === 'wallet') {
      const balanceXaf = await walletService.credit(userId, claimed.valueXaf, 'topup', { note: `Code IDEM ${code}`, action: 'code_redeem' });
      return { ok: true, kind: 'wallet', valueXaf: claimed.valueXaf, balanceXaf };
    }
    return { ok: true, kind: 'pack_lancement', code };
  }

  /** Rend un code pack dont l'application a échoué. */
  async release(code: string): Promise<void> {
    await IdemCode.updateOne({ code }, { $unset: { redeemedBy: '', redeemedAt: '', redeemedProjectId: '' } });
  }

  /** Codes créés par un utilisateur (pack « À plusieurs »), pour qu'il les distribue. */
  async listCreatedBy(userId: string) {
    return IdemCode.find({ createdBy: userId }).sort({ createdAt: -1 }).limit(200).select('code kind valueXaf redeemedAt createdAt').lean();
  }

  /** Lots d'un agent, avec ce qui a été utilisé (pour sa commission). */
  async agentReport(agentId: string) {
    const rows = await IdemCode.aggregate([
      { $match: { agentId } },
      { $group: { _id: '$batchId', total: { $sum: 1 }, redeemed: { $sum: { $cond: [{ $ifNull: ['$redeemedBy', false] }, 1, 0] } }, valueXaf: { $sum: '$valueXaf' } } },
    ]);
    return rows;
  }
}

export const idemCodesService = new IdemCodesService();
export const PACK_CODE_VALUE_XAF = PACKS.lancement.priceXaf;
export default idemCodesService;
