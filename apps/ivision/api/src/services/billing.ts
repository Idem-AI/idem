/**
 * La facturation, vue d'iVision : le portefeuille IDEM de l'utilisateur, en francs.
 *
 * « Signé gratuitement, payé à l'export » : créer un visuel, une vidéo ou un montage est gratuit
 * (signé « Créé avec iVision », borné par le quota d'usage d'IDEM) ; l'export HD sans signature
 * se paie — 100 F un visuel, à partir de 300 F une vidéo (prix du périmètre, même code qu'IDEM) —
 * et tout est inclus au-delà du plafond Créateur du mois. Le débit est fait par IDEM, aux mêmes
 * règles que ses propres routes ; un export qui échoue après le débit est restitué.
 */
import { creativityCost, CreativityLevel } from '../../../core/src/creativity/levels';
import { normalizeScope, videoCost } from '../../../core/src/video/pricing';
import logger from '../config/logger';
import { IdemGatewayError, idem } from './idem.client';

const prices = { exportVisual: 100, revision: 100 };

export async function syncBasePrices(): Promise<void> {
  try {
    const p = await idem.billing.prices();
    prices.exportVisual = p.export_visual ?? p.flyer;
    prices.revision = p.revision;
  } catch (error) {
    logger.warn('pricing.sync_failed', { event: 'pricing.sync_failed', error });
  }
}

/** Un plan filmé par l'IA (5 s) : la seule vraie dépense média, affichée et payée à part. */
export const AI_CLIP_XAF = 1000;
/** Plans filmés par l'IA qu'une vidéo peut commander. */
export const MAX_AI_CLIPS = 4;

/** Prix de l'export HD sans signature d'un visuel. */
export const exportVisualPrice = (): number => prices.exportVisual;

/**
 * La création ne coûte rien (`cost` 0 : une place de quota seulement) ; `exportXaf` dit ce que
 * coûtera l'export HD sans signature, affiché à côté du bouton.
 */
export const quote = {
  video: (scope: unknown, level: CreativityLevel) => ({ action: 'motion_video', cost: 0, exportXaf: creativityCost(videoCost(normalizeScope(scope)), level), note: `creativity:${level}` }),
  visual: (level: CreativityLevel) => ({ action: 'flyer', cost: 0, exportXaf: prices.exportVisual, note: `creativity:${level}` }),
};

export interface Charge {
  action: string;
  cost: number;
  /** Faux quand rien n'a été débité (facturation en observation, action incluse). */
  charged: boolean;
  /** Une place a été prise dans le quota d'usage d'IDEM : elle est rendue avec l'échec. */
  quotaReserved?: boolean;
}

/**
 * Le refus d'IDEM, tel quel : 402 (solde insuffisant — coût, solde, offres) ou 429 (quota
 * d'usage atteint — groupe, fenêtre, date de renouvellement, offre supérieure).
 */
export class PaymentRequired extends Error {
  constructor(
    readonly body: Record<string, unknown>,
    readonly status: 402 | 429 = 402
  ) {
    super(status === 429 ? 'quota_exceeded' : 'payment_required');
  }
}

export async function charge(userId: string, q: { action: string; cost: number; note?: string; quantity?: number }, element?: string): Promise<Charge> {
  try {
    const res = await idem.billing.charge({ userId, action: q.action, cost: q.cost, note: q.note, element, ...(q.quantity ? { quantity: q.quantity } : {}) });
    return { action: q.action, cost: res.charged ? res.cost : 0, charged: res.charged, quotaReserved: res.quotaReserved };
  } catch (error) {
    if (error instanceof IdemGatewayError && (error.status === 402 || error.status === 429)) throw new PaymentRequired(error.body || {}, error.status);
    throw error;
  }
}

export async function refund(userId: string, c: Charge | undefined, note: string): Promise<void> {
  if (!c) return;
  const cost = c.charged ? Math.max(0, c.cost) : 0;
  if (cost <= 0 && !c.quotaReserved) return;
  try {
    await idem.billing.refund({ userId, cost, action: c.action, note, releaseQuota: Boolean(c.quotaReserved) });
  } catch (error) {
    // L'utilisateur a payé sans livrable : tracé fort pour une régularisation.
    logger.error('billing.refund_failed', { event: 'billing.refund_failed', alert: 'critical', userId, cost: c.cost, action: c.action, error });
  }
}
