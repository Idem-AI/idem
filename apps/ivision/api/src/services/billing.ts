/**
 * Les crédits, vus d'iVision : le portefeuille business de l'utilisateur IDEM, aux prix d'IDEM.
 *
 * Le prix est calculé ICI par le même code qu'IDEM (`video.pricing`, jauge de créativité du
 * paquet partagé) à partir du barème lu chez IDEM (`/billing/prices`, relu toutes les 10 min) ;
 * le débit est fait par IDEM, aux mêmes règles que ses propres routes (mode d'application,
 * refus 402 avec offres). Une génération qui échoue après le débit est restituée.
 */
import { creativityCost, CreativityLevel } from '../../../core/src/creativity/levels';
import { normalizeScope, videoCost } from '../../../core/src/video/video.pricing';
import logger from '../config/logger';
import { IdemGatewayError, idem } from './idem.client';

const prices = { flyer: 2, revision: 1 };

export async function syncBasePrices(): Promise<void> {
  try {
    const p = await idem.billing.prices();
    prices.flyer = p.flyer;
    prices.revision = p.revision;
  } catch (error) {
    logger.warn('pricing.sync_failed', { event: 'pricing.sync_failed', error });
  }
}

export const quote = {
  video: (scope: unknown, level: CreativityLevel) => ({ action: 'motion_video', cost: creativityCost(videoCost(normalizeScope(scope)), level), note: `creativity:${level}` }),
  visual: (level: CreativityLevel) => ({ action: 'flyer', cost: creativityCost(prices.flyer, level), note: `creativity:${level}` }),
};

export interface Charge {
  action: string;
  cost: number;
  /** Faux quand rien n'a été débité (facturation en observation, action incluse). */
  charged: boolean;
}

/** Le refus d'IDEM (solde insuffisant), tel quel : coût, solde, offres. */
export class PaymentRequired extends Error {
  constructor(readonly body: Record<string, unknown>) {
    super('payment_required');
  }
}

export async function charge(userId: string, q: { action: string; cost: number; note?: string }, element?: string): Promise<Charge> {
  try {
    const res = await idem.billing.charge({ userId, action: q.action, cost: q.cost, note: q.note, element });
    return { action: q.action, cost: res.charged ? res.cost : 0, charged: res.charged };
  } catch (error) {
    if (error instanceof IdemGatewayError && error.status === 402) throw new PaymentRequired(error.body || {});
    throw error;
  }
}

export async function refund(userId: string, c: Charge | undefined, note: string): Promise<void> {
  if (!c?.charged || c.cost <= 0) return;
  try {
    await idem.billing.refund({ userId, cost: c.cost, action: c.action, note });
  } catch (error) {
    // L'utilisateur a payé sans livrable : tracé fort pour une régularisation.
    logger.error('billing.refund_failed', { event: 'billing.refund_failed', alert: 'critical', userId, cost: c.cost, action: c.action, error });
  }
}
