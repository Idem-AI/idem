/**
 * Le paiement d'une commande : le portefeuille IDEM de l'utilisateur, en francs (décision du
 * 17/10/2026 — le mobile money ne vend que la recharge du portefeuille).
 *
 * Chaque mouvement est d'abord écrit ici (`payments`, statut `pending`) avec une RÉFÉRENCE
 * unique, puis envoyé à IDEM avec cette référence. IDEM ne débite ni ne rembourse deux fois la
 * même : une reprise après coupure rejoue la même référence sans danger.
 */
import { one, query } from '../../config/db';
import logger, { logCritical } from '../../config/logger';
import { IdemGatewayError, idem } from '../../integrations/idem.client';
import { audit } from '../audit/audit.service';

/** Ce que le client voit au refus : le solde qui manque et les offres de recharge (corps d'IDEM). */
export class PaymentRequired extends Error {
  constructor(readonly body: Record<string, unknown>) {
    super('payment_required');
  }
}

const chargeRef = (orderId: string) => `idomain:order:${orderId}:charge`;

export async function chargeOrder(order: { id: string; owner_uid: string; total_xaf: number }, label: string, action: 'domain_register' | 'domain_renew' | 'domain_transfer'): Promise<{ ledgerEntryId?: string }> {
  const reference = chargeRef(order.id);
  await query(`INSERT INTO payments (order_id, kind, amount_xaf, reference) VALUES ($1, 'charge', $2, $3) ON CONFLICT (reference) DO NOTHING`, [order.id, order.total_xaf, reference]);
  try {
    const res = await idem.billing.charge({ userId: order.owner_uid, reference, amountXaf: order.total_xaf, label, action });
    await query(`UPDATE payments SET status = 'succeeded', ledger_entry_id = $2, error = NULL WHERE reference = $1`, [reference, res.ledgerEntryId ?? null]);
    await audit({ actorKind: 'user', actorId: order.owner_uid, action: 'payment.charged', targetType: 'order', targetId: order.id, data: { amountXaf: order.total_xaf, replayed: res.replayed ?? false } });
    return { ledgerEntryId: res.ledgerEntryId };
  } catch (error) {
    const status = error instanceof IdemGatewayError ? error.status : 0;
    await query(`UPDATE payments SET status = 'failed', error = $2 WHERE reference = $1`, [reference, String((error as Error).message).slice(0, 500)]);
    if (error instanceof IdemGatewayError && status === 402) throw new PaymentRequired(error.body ?? {});
    throw error;
  }
}

/**
 * Restitue la part d'une ligne de commande (son prix), une seule fois par ligne. IDEM vérifie
 * qu'on ne rend jamais plus que ce qui a été débité sous la référence du débit. Un échec est une
 * alerte critique : le client a payé sans rien recevoir — la reprise rejoue la même référence,
 * sinon il faut régulariser à la main.
 */
export async function refundItem(order: { id: string; owner_uid: string }, item: { id: string; price_xaf: number; domain_name: string }, note: string): Promise<boolean> {
  const charge = await one<{ status: string }>(`SELECT status FROM payments WHERE reference = $1`, [chargeRef(order.id)]);
  if (!charge || charge.status !== 'succeeded' || item.price_xaf <= 0) return false;
  const reference = `idomain:order:${order.id}:refund:${item.id}`;
  await query(`INSERT INTO payments (order_id, kind, amount_xaf, reference) VALUES ($1, 'refund', $2, $3) ON CONFLICT (reference) DO NOTHING`, [order.id, item.price_xaf, reference]);
  const existing = await one<{ status: string }>(`SELECT status FROM payments WHERE reference = $1`, [reference]);
  if (existing?.status === 'succeeded') return true;
  try {
    await idem.billing.refund({ userId: order.owner_uid, chargeReference: chargeRef(order.id), refundReference: reference, amountXaf: item.price_xaf, note });
    await query(`UPDATE payments SET status = 'succeeded', error = NULL WHERE reference = $1`, [reference]);
    await audit({ actorKind: 'system', action: 'payment.refunded', targetType: 'order_item', targetId: item.id, data: { orderId: order.id, domain: item.domain_name, amountXaf: item.price_xaf, note } });
    return true;
  } catch (error) {
    await query(`UPDATE payments SET status = 'failed', error = $2 WHERE reference = $1`, [reference, String((error as Error).message).slice(0, 500)]);
    logCritical('payment.refund_failed', { orderId: order.id, itemId: item.id, userId: order.owner_uid, amountXaf: item.price_xaf, error });
    return false;
  }
}

/** Les restitutions restées en échec (IDEM injoignable) : rejouées par la maintenance, même référence. */
export async function retryPendingRefunds(): Promise<number> {
  const pending = await query<{ order_id: string; owner_uid: string; reference: string; item_id: string; price_xaf: number; domain_name: string }>(
    `SELECT p.order_id, o.owner_uid, p.reference, oi.id AS item_id, oi.price_xaf, oi.domain_name
       FROM payments p JOIN orders o ON o.id = p.order_id
       JOIN order_items oi ON p.reference = 'idomain:order:' || o.id || ':refund:' || oi.id
      WHERE p.kind = 'refund' AND p.status IN ('pending', 'failed') AND p.created_at > now() - interval '30 days'
      LIMIT 50`
  );
  let done = 0;
  for (const p of pending) {
    if (await refundItem({ id: p.order_id, owner_uid: p.owner_uid }, { id: p.item_id, price_xaf: p.price_xaf, domain_name: p.domain_name }, `Domaine ${p.domain_name} non enregistré — montant restitué`)) done++;
  }
  return done;
}

/** Droit aux domaines au coût (forfait Entreprise) : demandé à IDEM, cru une minute. */
const atCostCache = new Map<string, { value: boolean; at: number }>();
export async function hasAtCostPricing(uid: string): Promise<boolean> {
  const hit = atCostCache.get(uid);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  try {
    const { atCost } = await idem.billing.account(uid);
    atCostCache.set(uid, { value: atCost, at: Date.now() });
    if (atCostCache.size > 10_000) atCostCache.clear();
    return atCost;
  } catch (error) {
    // IDEM injoignable : le prix normal, jamais un prix au coût supposé.
    logger.warn('wallet.entitlements_unavailable', { event: 'wallet.entitlements_unavailable', error });
    return false;
  }
}
