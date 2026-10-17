/**
 * Les commandes : du prix garanti au paiement.
 *
 *   1. `createPriceSession` — le client choisit un nom : son prix est revérifié et FIGÉ pour la
 *      durée de la session (30 min par défaut). Ce prix ne bougera plus, même si le catalogue change.
 *   2. `createOrder` — avec une clé d'idempotence (le même clic rejoué rend la même commande) :
 *      contrôle du titulaire, revalidation de la disponibilité et des coûts AU PRIX CONVENU, puis
 *      débit du portefeuille IDEM. Rien n'est enregistré avant le paiement confirmé.
 *   3. L'enregistrement chez le fournisseur se fait dans le worker (`execution.service`).
 *
 * Un solde insuffisant laisse la commande « en attente de paiement » : après une recharge, le
 * client la paie sans tout recommencer (`payOrder`).
 */
import { z } from 'zod';
import { Db, one, query, withTransaction } from '../../config/db';
import logger from '../../config/logger';
import { HttpError } from '../../middleware/error';
import { enqueueOrderItem } from '../../queue/queues';
import { normalizeDomain } from '../../utils/domain-name';
import { audit } from '../audit/audit.service';
import { defaultContact } from '../contacts/contacts.service';
import { activeCatalog } from '../pricing/catalog.service';
import { publicPriceXaf } from '../pricing/engine';
import { publicQuote, quoteDomains, revalidate } from '../pricing/quote.service';
import { activeRules } from '../pricing/rules.service';
import { chargeOrder, hasAtCostPricing, PaymentRequired } from '../payments/wallet.service';

export type OrderStatus = 'awaiting_contact' | 'awaiting_payment' | 'paid' | 'processing' | 'completed' | 'on_hold' | 'needs_review' | 'failed' | 'refunded' | 'cancelled';

export interface OrderRow {
  id: string;
  owner_uid: string;
  status: OrderStatus;
  total_xaf: number;
  payment_method: 'wallet' | 'prepaid';
  source: string;
  session_id: string | null;
  idempotency_key: string;
  status_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  domain_name: string;
  tld: string;
  operation: 'register' | 'renew' | 'transfer';
  years: number;
  price_xaf: number;
  renewal_xaf: number | null;
  at_cost: boolean;
  price_session_id: string | null;
  catalog_id: string | null;
  rules_id: string | null;
  promotion_id: string | null;
  status: 'pending' | 'registering' | 'registered' | 'on_hold' | 'needs_review' | 'failed';
  provider_code: string | null;
  provider_cost: string | null;
  provider_currency: string | null;
  provider_cost_xaf: number | null;
  second_provider_code: string | null;
  second_cost_xaf: number | null;
  margin_xaf: number | null;
  domain_id: string | null;
  auth_code: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── Session de prix ───────────────────────────────────────────────────────

export const priceSessionInput = z.object({
  domain: z.string().min(3).max(253),
  years: z.number().int().min(1).max(10).default(1),
});

export async function createPriceSession(ownerUid: string, input: z.infer<typeof priceSessionInput>) {
  const parsed = normalizeDomain(input.domain);
  if (!parsed) throw new HttpError(422, 'invalid_domain', 'Ce nom de domaine n’est pas valide.');
  const { rules } = await activeRules();
  if (input.years > rules.maxYears) throw new HttpError(422, 'years_out_of_range', `Jusqu’à ${rules.maxYears} ans.`);
  const atCost = await hasAtCostPricing(ownerUid);
  const [quote] = await quoteDomains([parsed.name], { years: input.years, atCost, context: 'session', record: () => true });
  if (!quote || quote.state !== 'available' || !quote.priceXaf || !quote.catalogId) {
    throw new HttpError(409, `domain_${quote?.state ?? 'unknown'}`, messageFor(quote?.state), { quote: quote ? publicQuote(quote) : null });
  }
  const row = await one<{ id: string; expires_at: Date }>(
    `INSERT INTO price_sessions (owner_uid, domain_name, operation, years, price_xaf, renewal_xaf, at_cost, catalog_id, rules_id, promotion_id, expires_at)
     VALUES ($1, $2, 'register', $3, $4, $5, $6, $7, $8, $9, now() + make_interval(mins => $10)) RETURNING id, expires_at`,
    [ownerUid, quote.domain, quote.years, quote.priceXaf, quote.renewalXaf, quote.atCost, quote.catalogId, quote.rulesId, quote.promotion?.id ?? null, rules.priceSessionMinutes]
  );
  return { id: row!.id, expiresAt: row!.expires_at, ...publicQuote(quote) };
}

function messageFor(state?: string): string {
  switch (state) {
    case 'taken':
      return 'Ce nom vient d’être pris. Essayez une variante.';
    case 'premium':
      return 'Ce nom est premium : son prix est fixé par le registre, il n’est pas proposé ici.';
    case 'not_sold':
      return 'Cette extension n’est pas encore proposée.';
    case 'unknown':
      return 'Impossible de vérifier ce nom pour l’instant. Réessayez dans un instant.';
    default:
      return 'Ce nom ne peut pas être commandé pour l’instant. Réessayez plus tard.';
  }
}

// ─── Commande ───────────────────────────────────────────────────────────────

export const orderInput = z.object({
  /** Une ligne par nom (une seule pour l'instant dans l'interface, plusieurs prévues). */
  priceSessionIds: z.array(z.string().uuid()).min(1).max(5),
  idempotencyKey: z.string().min(8).max(120),
  /** Parcours ouvert par iDeploy ou iCode : la commande y est rattachée. */
  domainSessionId: z.string().uuid().optional(),
  /** Relier le domaine à cette application dès qu'il est enregistré. */
  connectAppUuid: z.string().max(64).optional(),
});

export async function createOrder(ownerUid: string, input: z.infer<typeof orderInput>): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
  const existing = await one<OrderRow>(`SELECT * FROM orders WHERE owner_uid = $1 AND idempotency_key = $2`, [ownerUid, input.idempotencyKey]);
  if (existing) return { order: existing, items: await orderItems(existing.id) };

  const contact = await defaultContact(ownerUid);
  if (!contact) throw new HttpError(409, 'contact_required', 'Indiquez d’abord le titulaire du domaine (nom, adresse, téléphone).');

  const sessions = await query<{ id: string; domain_name: string; years: number; price_xaf: number; renewal_xaf: number | null; at_cost: boolean; catalog_id: string; rules_id: string; promotion_id: string | null; expired: boolean }>(
    `SELECT id, domain_name, years, price_xaf, renewal_xaf, at_cost, catalog_id, rules_id, promotion_id, expires_at < now() AS expired
       FROM price_sessions WHERE id = ANY($1::uuid[]) AND owner_uid = $2`,
    [input.priceSessionIds, ownerUid]
  );
  if (sessions.length !== input.priceSessionIds.length) throw new HttpError(404, 'price_session_not_found', 'Ce prix n’est plus disponible. Relancez la recherche.');
  if (sessions.some((s) => s.expired)) throw new HttpError(410, 'price_session_expired', 'Le prix garanti a expiré. Relancez la recherche pour le confirmer à nouveau.');

  let domainSession: { id: string; source: string } | null = null;
  if (input.domainSessionId) {
    domainSession = await one<{ id: string; source: string }>(`SELECT id, source FROM domain_sessions WHERE id = $1 AND owner_uid = $2 AND expires_at > now()`, [input.domainSessionId, ownerUid]);
    if (!domainSession) throw new HttpError(404, 'domain_session_not_found', 'Ce parcours a expiré. Revenez depuis votre application.');
  }

  // Revalidation au moment de payer : disponibilité réelle et coûts du moment, au prix convenu.
  for (const s of sessions) {
    const tld = normalizeDomain(s.domain_name)!.tld;
    const check = await revalidate(s.domain_name, tld, 'register', s.years, s.price_xaf, { funded: s.at_cost || Boolean(s.promotion_id), promotionId: s.promotion_id ? Number(s.promotion_id) : null });
    if (check.taken) throw new HttpError(409, 'domain_taken', `${s.domain_name} vient d’être pris. Essayez une variante.`);
    if (!check.selection.selected) throw new HttpError(409, 'domain_unavailable_now', `${s.domain_name} ne peut pas être commandé pour l’instant. Réessayez plus tard.`);
  }

  const total = sessions.reduce((sum, s) => sum + s.price_xaf, 0);
  const created = await withTransaction(async (client) => {
    for (const s of sessions) {
      // Un même nom ne peut pas être en cours dans deux commandes (verrou par nom, jusqu'à la fin de la transaction).
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [s.domain_name]);
      const busy = await one<{ id: string }>(
        `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE oi.domain_name = $1 AND oi.status IN ('pending', 'registering', 'on_hold', 'needs_review') AND o.status NOT IN ('cancelled', 'failed', 'refunded')
          UNION ALL SELECT id FROM domains WHERE name = $1 AND status <> 'failed' LIMIT 1`,
        [s.domain_name],
        client
      );
      if (busy) throw new HttpError(409, 'domain_in_progress', `${s.domain_name} est déjà en cours de commande.`);
    }
    const order = await one<OrderRow>(
      `INSERT INTO orders (owner_uid, status, total_xaf, payment_method, source, session_id, idempotency_key)
       VALUES ($1, 'awaiting_payment', $2, 'wallet', $3, $4, $5) RETURNING *`,
      [ownerUid, total, domainSession?.source ?? 'idomain', domainSession?.id ?? null, input.idempotencyKey],
      client
    );
    const items: OrderItemRow[] = [];
    for (const s of sessions) {
      const item = await one<OrderItemRow>(
        `INSERT INTO order_items (order_id, domain_name, tld, operation, years, price_xaf, renewal_xaf, at_cost, price_session_id, catalog_id, rules_id, promotion_id)
         VALUES ($1, $2, $3, 'register', $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [order!.id, s.domain_name, normalizeDomain(s.domain_name)!.tld, s.years, s.price_xaf, s.renewal_xaf, s.at_cost, s.id, s.catalog_id, s.rules_id, s.promotion_id],
        client
      );
      items.push(item!);
      if (s.promotion_id) await client.query(`UPDATE promotions SET uses = uses + 1 WHERE id = $1`, [s.promotion_id]);
    }
    await audit({ actorKind: 'user', actorId: ownerUid, action: 'order.created', targetType: 'order', targetId: order!.id, data: { domains: sessions.map((s) => s.domain_name), totalXaf: total } }, client);
    return { order: order!, items };
  });

  if (input.connectAppUuid) {
    // La connexion attend le domaine : elle démarrera d'elle-même à l'enregistrement.
    const { requestConnection } = await import('../connections/connections.service');
    for (const item of created.items) {
      await requestConnection(ownerUid, { host: item.domain_name, appUuid: input.connectAppUuid, domainSessionId: domainSession?.id, orderItemId: item.id }).catch((error) =>
        logger.warn('order.connection_request_failed', { event: 'order.connection_request_failed', orderId: created.order.id, error })
      );
    }
  }

  return payOrder(ownerUid, created.order.id);
}

/** Débite le portefeuille et confie les lignes au worker. Rejouable : un débit réussi ne se refait pas. */
export async function payOrder(ownerUid: string, orderId: string): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
  const order = await one<OrderRow>(`SELECT * FROM orders WHERE id = $1 AND owner_uid = $2`, [orderId, ownerUid]);
  if (!order) throw new HttpError(404, 'order_not_found');
  if (order.status !== 'awaiting_payment') return { order, items: await orderItems(order.id) };
  const items = await orderItems(order.id);
  const label = items.length === 1 ? `Domaine ${items[0].domain_name} — ${items[0].years} an${items[0].years > 1 ? 's' : ''}` : `${items.length} domaines`;
  try {
    await chargeOrder(order, label, 'domain_register');
  } catch (error) {
    if (error instanceof PaymentRequired) {
      await setOrderStatus(order.id, 'awaiting_payment', 'insufficient_funds');
      throw new HttpError(402, 'payment_required', 'Votre portefeuille ne suffit pas pour cette commande. Rechargez-le, puis validez à nouveau.', { orderId: order.id, ...error.body });
    }
    throw error;
  }
  await setOrderStatus(order.id, 'paid', null);
  for (const item of items) await enqueueOrderItem(item.id);
  return { order: (await one<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [order.id]))!, items };
}

/** Annuler une commande pas encore payée (ou suspendue, avec restitution des lignes non enregistrées). */
export async function cancelOrder(ownerUid: string, orderId: string): Promise<OrderRow> {
  const order = await one<OrderRow>(`SELECT * FROM orders WHERE id = $1 AND owner_uid = $2`, [orderId, ownerUid]);
  if (!order) throw new HttpError(404, 'order_not_found');
  if (order.status === 'awaiting_payment' || order.status === 'awaiting_contact') {
    await setOrderStatus(order.id, 'cancelled', 'cancelled_by_user');
    await audit({ actorKind: 'user', actorId: ownerUid, action: 'order.cancelled', targetType: 'order', targetId: order.id });
    return (await one<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [order.id]))!;
  }
  if (order.status === 'on_hold') {
    const { abandonOrder } = await import('./execution.service');
    await abandonOrder(order.id, 'Commande annulée par le client — montant restitué');
    return (await one<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [order.id]))!;
  }
  throw new HttpError(409, 'order_not_cancellable', 'Cette commande est déjà en cours d’enregistrement.');
}

// ─── Commandes venues d'IDEM (pack Lancement + domaine) ───────────────────

export const prepaidInput = z.object({
  userId: z.string().min(1).max(128),
  domain: z.string().min(3).max(253),
  /** Référence de l'appelant : la même référence ne crée jamais deux commandes. */
  reference: z.string().min(4).max(120),
  source: z.enum(['pack', 'pass', 'idem']).default('pack'),
  appUuid: z.string().max(64).optional(),
});

/**
 * Une commande PAYÉE AILLEURS (le pack, débité par IDEM) : au prix du pack, sans débit ici. Elle
 * attend le titulaire s'il manque, puis suit le même chemin que les autres.
 */
export async function createPrepaidOrder(input: z.infer<typeof prepaidInput>): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
  const parsed = normalizeDomain(input.domain);
  if (!parsed) throw new HttpError(422, 'invalid_domain', 'Ce nom de domaine n’est pas valide.');
  const key = `prepaid:${input.reference}`;
  const existing = await one<OrderRow>(`SELECT * FROM orders WHERE owner_uid = $1 AND idempotency_key = $2`, [input.userId, key]);
  if (existing) return { order: existing, items: await orderItems(existing.id) };

  const catalog = await activeCatalog(parsed.tld);
  if (!catalog?.on_sale || !catalog.pack_xaf) throw new HttpError(422, 'tld_not_in_pack', `Les domaines en .${parsed.tld} ne sont pas proposés dans un pack.`);
  const { id: rulesId } = await activeRules();
  const price = publicPriceXaf(catalog, 'register', 1, { atCost: true })!;
  const contact = await defaultContact(input.userId);

  const created = await withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [parsed.name]);
    const order = await one<OrderRow>(
      `INSERT INTO orders (owner_uid, status, total_xaf, payment_method, source, idempotency_key, status_reason)
       VALUES ($1, $2, $3, 'prepaid', $4, $5, $6) RETURNING *`,
      [input.userId, contact ? 'paid' : 'awaiting_contact', price, input.source, key, contact ? null : 'contact_required'],
      client
    );
    const item = await one<OrderItemRow>(
      `INSERT INTO order_items (order_id, domain_name, tld, operation, years, price_xaf, renewal_xaf, at_cost, catalog_id, rules_id)
       VALUES ($1, $2, $3, 'register', 1, $4, $5, true, $6, $7) RETURNING *`,
      [order!.id, parsed.name, parsed.tld, price, catalog.renew_xaf, catalog.id, rulesId],
      client
    );
    await audit({ actorKind: 'service', actorId: 'idem-api', action: 'order.prepaid_created', targetType: 'order', targetId: order!.id, data: { userId: input.userId, domain: parsed.name, reference: input.reference } }, client);
    return { order: order!, items: [item!] };
  });
  if (input.appUuid) {
    const { requestConnection } = await import('../connections/connections.service');
    await requestConnection(input.userId, { host: parsed.name, appUuid: input.appUuid, orderItemId: created.items[0].id }).catch(() => undefined);
  }
  if (created.order.status === 'paid') await enqueueOrderItem(created.items[0].id);
  return created;
}

/** Le titulaire vient d'être renseigné : les commandes qui l'attendaient repartent. */
export async function resumeAwaitingContact(ownerUid: string): Promise<number> {
  const orders = await query<{ id: string }>(`UPDATE orders SET status = 'paid', status_reason = NULL, updated_at = now() WHERE owner_uid = $1 AND status = 'awaiting_contact' RETURNING id`, [ownerUid]);
  for (const o of orders) for (const item of await orderItems(o.id)) await enqueueOrderItem(item.id);
  return orders.length;
}

// ─── Lecture ────────────────────────────────────────────────────────────────

export async function orderItems(orderId: string, db?: Db): Promise<OrderItemRow[]> {
  return query<OrderItemRow>(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at`, [orderId], db);
}

export async function setOrderStatus(orderId: string, status: OrderStatus, reason: string | null, db?: Db): Promise<void> {
  await query(`UPDATE orders SET status = $2, status_reason = $3, updated_at = now() WHERE id = $1`, [orderId, status, reason], db);
}

/** Ce que le client voit d'une commande : ni fournisseur, ni coût, ni marge. */
export function publicOrder(order: OrderRow, items: OrderItemRow[]) {
  return {
    id: order.id,
    status: order.status,
    statusReason: order.status_reason,
    totalXaf: order.total_xaf,
    paymentMethod: order.payment_method,
    source: order.source,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((i) => ({
      id: i.id,
      domain: i.domain_name,
      operation: i.operation,
      years: i.years,
      priceXaf: i.price_xaf,
      renewalXaf: i.renewal_xaf,
      atCost: i.at_cost,
      status: i.status,
      domainId: i.domain_id,
    })),
  };
}

export async function getOrder(ownerUid: string, orderId: string) {
  const order = await one<OrderRow>(`SELECT * FROM orders WHERE id = $1 AND owner_uid = $2`, [orderId, ownerUid]);
  if (!order) throw new HttpError(404, 'order_not_found');
  return publicOrder(order, await orderItems(order.id));
}

export async function listOrders(ownerUid: string, limit = 50) {
  const orders = await query<OrderRow>(`SELECT * FROM orders WHERE owner_uid = $1 ORDER BY created_at DESC LIMIT $2`, [ownerUid, limit]);
  const items = orders.length ? await query<OrderItemRow>(`SELECT * FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY created_at`, [orders.map((o) => o.id)]) : [];
  return orders.map((o) => publicOrder(o, items.filter((i) => i.order_id === o.id)));
}
