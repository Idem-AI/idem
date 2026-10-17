/**
 * OrderExecutionService — l'enregistrement d'une ligne payée, dans le worker.
 *
 * Le déroulé, rejouable à tout moment sans double achat :
 *   1. RÉCONCILIER — une opération restée « en cours » ou « incertaine » (délai dépassé, worker
 *      arrêté) est d'abord vérifiée chez son fournisseur : si le domaine est dans notre compte,
 *      c'est un succès, on ne relance rien.
 *   2. REVALIDER — disponibilité et coûts relus en direct, chiffrés au prix convenu avec le client ;
 *      choix du fournisseur admissible le moins cher, hors ceux déjà en échec pour cette ligne.
 *   3. ENREGISTRER — avec une clé d'idempotence par (ligne, fournisseur). Refus définitif d'un
 *      fournisseur : le suivant, si le nom est toujours libre et la marge tenue.
 *   4. CONCLURE — domaine créé, coût retenu et deuxième meilleur historisés, marge calculée ;
 *      ou restitution de la ligne si le nom a été pris entre-temps.
 *
 * Si aucun fournisseur ne tient la marge (coût devenu trop haut, panne générale), la ligne est
 * SUSPENDUE et revue plus tard : jamais vendue à perte, jamais restituée trop vite.
 */
import { one, query } from '../../config/db';
import logger, { logCritical } from '../../config/logger';
import { RegistrarError, registrar } from '../../integrations/registrars';
import { enqueueConnection, enqueueOrderItem } from '../../queue/queues';
import { audit } from '../audit/audit.service';
import { defaultContact } from '../contacts/contacts.service';
import { revalidate } from '../pricing/quote.service';
import { refundItem } from '../payments/wallet.service';
import { emit } from '../webhooks/webhooks.service';
import { OrderItemRow, OrderRow, orderItems, setOrderStatus } from './orders.service';

/** Combien de fournisseurs essayer pour une même ligne avant de suspendre. */
const MAX_PROVIDERS_PER_ITEM = 3;
/** Une ligne suspendue est revue toutes les 15 minutes, et restituée après ce délai. */
export const ON_HOLD_RETRY_MS = 15 * 60_000;
export const ON_HOLD_GIVE_UP_MS = 48 * 3600_000;

interface OperationRow {
  id: string;
  provider_code: string;
  status: 'running' | 'succeeded' | 'failed' | 'uncertain';
  error_code: string | null;
}

/** Une erreur qui demande à BullMQ de rejouer la tâche plus tard (attente croissante). */
export class RetryLater extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'RetryLater';
  }
}

/** Avant de rendre la main à BullMQ pour une reprise : la ligne redevient reprenable. */
export async function releaseItem(itemId: string): Promise<void> {
  await query(`UPDATE order_items SET status = 'pending', updated_at = now() WHERE id = $1 AND status = 'registering'`, [itemId]);
}

export async function executeItem(itemId: string): Promise<void> {
  // La ligne passe « en enregistrement » une seule fois à la fois : deux workers ne la prennent pas ensemble.
  // Une ligne « en enregistrement » depuis plus de 10 minutes vient d'un worker arrêté net : reprise.
  const item = await one<OrderItemRow>(
    `UPDATE order_items SET status = 'registering', updated_at = now()
      WHERE id = $1 AND (status IN ('pending', 'on_hold') OR (status = 'registering' AND updated_at < now() - interval '10 minutes'))
      RETURNING *`,
    [itemId]
  );
  if (!item) return;
  const order = (await one<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [item.order_id]))!;
  if (!['paid', 'processing', 'on_hold'].includes(order.status)) {
    await query(`UPDATE order_items SET status = 'pending' WHERE id = $1 AND status = 'registering'`, [item.id]);
    return;
  }
  if (order.status !== 'processing') await setOrderStatus(order.id, 'processing', null);

  // 1. Réconcilier ce qui a pu se passer lors d'une tentative précédente.
  const previous = await query<OperationRow>(`SELECT id, provider_code, status, error_code FROM domain_operations WHERE order_item_id = $1 AND kind = 'register' ORDER BY created_at`, [item.id]);
  for (const op of previous.filter((o) => o.status === 'running' || o.status === 'uncertain')) {
    const adapter = registrar(op.provider_code);
    if (!adapter) throw new RetryLater(`provider_unconfigured:${op.provider_code}`);
    let found;
    try {
      found = await adapter.getDomain(item.domain_name);
    } catch (error) {
      // Impossible de savoir : on ne relance surtout pas un enregistrement à l'aveugle.
      throw new RetryLater(`reconcile_failed:${(error as Error).message}`);
    }
    if (found) {
      await query(`UPDATE domain_operations SET status = 'succeeded', response = $2, updated_at = now() WHERE id = $1`, [op.id, JSON.stringify({ reconciled: true, ref: found.ref })]);
      // Le coût n'a pas été relu : on le reprend du dernier devis de ce fournisseur pour ce nom.
      const quote = await one<{ cost: string | null; currency: string | null; total_cost_xaf: number | null }>(
        `SELECT cost, currency, total_cost_xaf FROM provider_price_quotes WHERE provider_code = $1 AND domain_name = $2 ORDER BY created_at DESC LIMIT 1`,
        [op.provider_code, item.domain_name]
      );
      await conclude(order, item, op.provider_code, found, { cost: quote?.cost ? Number(quote.cost) : null, currency: quote?.currency ?? null, totalCostXaf: quote?.total_cost_xaf ?? null }, null);
      return;
    }
    await query(`UPDATE domain_operations SET status = 'failed', error_code = 'not_found_after_uncertain', updated_at = now() WHERE id = $1`, [op.id]);
  }

  // 2. Revalider au prix convenu, sans les fournisseurs qui ont déjà refusé définitivement.
  const refused = previous.filter((o) => o.status === 'failed' && o.error_code === 'rejected').map((o) => o.provider_code);
  const funded = item.at_cost || Boolean(item.promotion_id);
  const check = await revalidate(item.domain_name, item.tld, item.operation, item.years, item.price_xaf, { funded, exclude: refused, promotionId: item.promotion_id ? Number(item.promotion_id) : null });

  if (check.taken) return fail(order, item, 'domain_taken', `Domaine ${item.domain_name} pris entre-temps — montant restitué`);
  if (!check.selection.selected) return hold(order, item, refused.length >= MAX_PROVIDERS_PER_ITEM ? 'all_providers_refused' : 'no_admissible_provider');

  const contact = (await defaultContact(order.owner_uid)) ?? null;
  if (!contact) {
    await query(`UPDATE order_items SET status = 'pending' WHERE id = $1`, [item.id]);
    await setOrderStatus(order.id, 'awaiting_contact', 'contact_required');
    return;
  }

  // 3. Enregistrer chez le moins cher, puis le suivant en cas de refus définitif.
  const candidates = check.selection.offers
    .filter((o) => o.admissible && check.offers.find((x) => x.providerCode === o.providerCode)?.available === true)
    .sort((a, b) => (a.rankingCostXaf ?? Infinity) - (b.rankingCostXaf ?? Infinity) || a.priority - b.priority)
    .slice(0, MAX_PROVIDERS_PER_ITEM - refused.length);

  for (let i = 0; i < candidates.length; i++) {
    const chosen = candidates[i];
    const adapter = registrar(chosen.providerCode);
    if (!adapter) continue;
    const key = `register:${item.id}:${chosen.providerCode}`;
    const op = await one<{ id: string }>(
      `INSERT INTO domain_operations (order_item_id, kind, provider_code, idempotency_key, status, attempts, last_attempt_at)
       VALUES ($1, 'register', $2, $3, 'running', 1, now())
       ON CONFLICT (idempotency_key) DO UPDATE SET status = 'running', attempts = domain_operations.attempts + 1, last_attempt_at = now(), updated_at = now()
       RETURNING id`,
      [item.id, chosen.providerCode, key]
    );
    try {
      const registered = await adapter.register({ domain: item.domain_name, years: item.years, contact, idempotencyKey: key });
      await query(`UPDATE domain_operations SET status = 'succeeded', response = $2, error = NULL, error_code = NULL, updated_at = now() WHERE id = $1`, [op!.id, JSON.stringify({ ref: registered.ref, expiresAt: registered.expiresAt })]);
      const second = candidates[i + 1] ?? check.selection.second;
      await conclude(order, item, chosen.providerCode, registered, { cost: chosen.cost, currency: chosen.currency, totalCostXaf: chosen.totalCostXaf }, second && second.providerCode !== chosen.providerCode ? second : null, contact.id);
      return;
    } catch (error) {
      const e = error instanceof RegistrarError ? error : new RegistrarError('uncertain', (error as Error).message);
      await query(`UPDATE domain_operations SET status = $2, error_code = $3, error = $4, updated_at = now() WHERE id = $1`, [op!.id, e.kind === 'uncertain' ? 'uncertain' : 'failed', e.kind, e.message.slice(0, 1000)]);
      logger.warn('order.register_failed', { event: 'order.register_failed', itemId: item.id, provider: chosen.providerCode, kind: e.kind, code: e.code });
      if (e.kind === 'unavailable') return fail(order, item, 'domain_taken', `Domaine ${item.domain_name} pris entre-temps — montant restitué`);
      // Peut-être enregistré : on ne tente rien ailleurs, la reprise vérifiera chez ce fournisseur.
      if (e.kind === 'uncertain') throw new RetryLater('uncertain_result');
      if (e.kind === 'transient') throw new RetryLater('provider_transient');
      if (e.kind === 'credentials' || e.kind === 'insufficient_funds') {
        logCritical('provider.account_problem', { provider: chosen.providerCode, kind: e.kind, message: e.message });
        await query(`UPDATE registrar_providers SET health_status = 'down', health_detail = $2, health_checked_at = now() WHERE code = $1`, [chosen.providerCode, e.kind]);
      }
      // `rejected`, `unsupported`, compte en défaut : le fournisseur suivant.
      await query(`UPDATE domain_operations SET error_code = 'rejected' WHERE id = $1`, [op!.id]);
    }
  }
  return hold(order, item, 'all_providers_refused');
}

/** 4. Le domaine existe : on l'écrit, on historise le choix et la marge, on prévient. */
async function conclude(
  order: OrderRow,
  item: OrderItemRow,
  providerCode: string,
  registered: { ref: string; expiresAt: Date | null },
  cost: { cost: number | null; currency: string | null; totalCostXaf: number | null },
  second: { providerCode: string; totalCostXaf: number | null } | null,
  contactId?: string
): Promise<void> {
  const contact = contactId ?? (await defaultContact(order.owner_uid))?.id ?? null;
  const domain = await one<{ id: string }>(
    `INSERT INTO domains (owner_uid, name, tld, status, registrar_code, registrar_ref, dns_mode, contact_id, registered_at, expires_at, renewal_xaf, source)
     VALUES ($1, $2, $3, 'active', $4, $5, 'managed', $6, now(), $7, $8, $9)
     ON CONFLICT (name) WHERE status <> 'failed' DO UPDATE SET updated_at = now()
     RETURNING id`,
    [order.owner_uid, item.domain_name, item.tld, providerCode, registered.ref, contact, registered.expiresAt ?? new Date(Date.now() + item.years * 365 * 86_400_000), item.renewal_xaf, order.source]
  );
  // Ce que reste à IDEM sur cette ligne, au taux et aux règles du moment.
  const { rules } = await (await import('../pricing/rules.service')).activeRules();
  const margin = cost.totalCostXaf !== null ? Math.round(item.price_xaf * (1 - rules.paymentFeeRate - rules.fxCushionRate) - rules.supportCostXaf - cost.totalCostXaf) : null;
  await query(
    `UPDATE order_items SET status = 'registered', provider_code = $2, provider_cost = $3, provider_currency = $4, provider_cost_xaf = $5,
            second_provider_code = $6, second_cost_xaf = $7, margin_xaf = $8, domain_id = $9, updated_at = now() WHERE id = $1`,
    [item.id, providerCode, cost.cost, cost.currency, cost.totalCostXaf, second?.providerCode ?? null, second?.totalCostXaf ?? null, margin, domain!.id]
  );
  await audit({ actorKind: 'system', action: 'domain.registered', targetType: 'domain', targetId: domain!.id, data: { orderId: order.id, itemId: item.id, domain: item.domain_name, provider: providerCode, marginXaf: margin } });
  logger.info('order.item_registered', { event: 'order.item_registered', orderId: order.id, itemId: item.id, domain: item.domain_name, provider: providerCode, marginXaf: margin });
  await emit('domain.registered', { domainId: domain!.id, domain: item.domain_name, ownerUid: order.owner_uid, orderId: order.id, expiresAt: registered.expiresAt });

  // Une connexion attendait ce domaine : elle démarre.
  const waiting = await query<{ id: string }>(`UPDATE domain_connections SET domain_id = $2, status = 'pending', updated_at = now() WHERE owner_uid = $1 AND host = $3 AND status = 'awaiting_domain' RETURNING id`, [order.owner_uid, domain!.id, item.domain_name]);
  for (const c of waiting) await enqueueConnection(c.id);
  await settleOrder(order.id);
}

/** Le nom n'est plus libre : la ligne échoue et son montant est restitué. */
async function fail(order: OrderRow, item: OrderItemRow, reason: string, note: string): Promise<void> {
  await query(`UPDATE order_items SET status = 'failed', updated_at = now() WHERE id = $1`, [item.id]);
  await query(`UPDATE domain_connections SET status = 'failed', error = $2, updated_at = now() WHERE owner_uid = $1 AND host = $3 AND status = 'awaiting_domain'`, [order.owner_uid, reason, item.domain_name]);
  if (order.payment_method === 'wallet') {
    // Une restitution qui ne passe pas est rejouée par la maintenance (même référence, jamais deux fois).
    await refundItem(order, item, note);
  } else {
    // Payée dans un pack : le client doit choisir un autre nom, l'équipe reprend la main.
    logCritical('order.prepaid_item_failed', { orderId: order.id, itemId: item.id, domain: item.domain_name, reason });
  }
  await audit({ actorKind: 'system', action: 'order.item_failed', targetType: 'order_item', targetId: item.id, data: { reason, domain: item.domain_name } });
  await settleOrder(order.id, reason);
}

/** Aucune offre admissible maintenant : suspendue, revue plus tard, restituée après 48 h. */
async function hold(order: OrderRow, item: OrderItemRow, reason: string): Promise<void> {
  const age = Date.now() - new Date(order.created_at).getTime();
  if (age > ON_HOLD_GIVE_UP_MS) return fail(order, item, reason, `Domaine ${item.domain_name} non enregistré — montant restitué`);
  await query(`UPDATE order_items SET status = 'on_hold', updated_at = now() WHERE id = $1`, [item.id]);
  await setOrderStatus(order.id, 'on_hold', reason);
  logger.error('order.on_hold', { event: 'order.on_hold', orderId: order.id, itemId: item.id, domain: item.domain_name, reason });
  await enqueueOrderItem(item.id, ON_HOLD_RETRY_MS);
}

/** Le client annule une commande suspendue : chaque ligne non enregistrée est restituée. */
export async function abandonOrder(orderId: string, note: string): Promise<void> {
  const order = (await one<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [orderId]))!;
  for (const item of await orderItems(orderId)) {
    if (item.status === 'registered' || item.status === 'failed') continue;
    await query(`UPDATE order_items SET status = 'failed', updated_at = now() WHERE id = $1`, [item.id]);
    if (order.payment_method === 'wallet') await refundItem(order, item, note);
  }
  await settleOrder(orderId, 'cancelled_by_user');
}

/** L'état de la commande suit celui de ses lignes. */
export async function settleOrder(orderId: string, reason: string | null = null): Promise<void> {
  const items = await orderItems(orderId);
  if (items.some((i) => ['pending', 'registering'].includes(i.status))) return;
  if (items.some((i) => i.status === 'on_hold' || i.status === 'needs_review')) return;
  const order = (await one<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [orderId]))!;
  const registered = items.filter((i) => i.status === 'registered').length;
  const status = registered === items.length ? 'completed' : registered > 0 ? 'completed' : order.payment_method === 'wallet' ? 'refunded' : 'needs_review';
  await setOrderStatus(orderId, status, status === 'completed' && registered < items.length ? 'partially_refunded' : status === 'completed' ? null : reason);
  await emit(status === 'completed' ? 'order.completed' : 'order.failed', { orderId, ownerUid: order.owner_uid, status, domains: items.map((i) => ({ domain: i.domain_name, status: i.status })) });
}

/** Pour la console : relancer une ligne suspendue ou en revue. */
export async function retryItem(itemId: string): Promise<void> {
  await query(`UPDATE order_items SET status = 'pending', updated_at = now() WHERE id = $1 AND status IN ('on_hold', 'needs_review')`, [itemId]);
  await query(`UPDATE orders SET status = 'processing', updated_at = now() WHERE id = (SELECT order_id FROM order_items WHERE id = $1) AND status IN ('on_hold', 'needs_review')`, [itemId]);
  await enqueueOrderItem(itemId);
}

