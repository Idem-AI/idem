/**
 * L'API d'administration (`/admin/v1`, clé `IDOMAIN_ADMIN_KEY`), appelée par l'API d'idem-admin,
 * de serveur à serveur. La console elle-même vit dans idem-admin (décision du 17/10/2026).
 * Chaque écriture porte l'identité de l'administrateur (`x-admin-actor`) dans le journal d'audit.
 */
import { Request, Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db';
import { requireKey } from '../middleware/auth';
import { asyncRoute } from '../middleware/error';
import { validate } from '../middleware/validate';
import { dashboard, pricingGrid } from '../modules/admin/metrics.service';
import { catalogHistory, catalogInput, createPromotion, endPromotion, listCatalog, listPromotions, promotionInput, setCatalogPrice } from '../modules/pricing/catalog.service';
import { activeRules, rulesSchema, updateRules } from '../modules/pricing/rules.service';
import { checkProviderHealth, manualCostInput, providerPatch, setFxRate, setManualCost, syncProviderCosts, updateProvider } from '../modules/providers/providers.service';
import { abandonOrder, retryItem } from '../modules/orders/execution.service';
import { orderItems } from '../modules/orders/orders.service';

export const admin = Router();
admin.use(requireKey('admin'));

const actor = (req: Request): string => String(req.headers['x-admin-actor'] || 'idem-admin').slice(0, 128);

admin.get('/dashboard', validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).optional() }) }), asyncRoute(async (req, res) => {
  res.json(await dashboard(req.query.days ? Number(req.query.days) : 30));
}));

// ─── Prix publics, règles, promotions ─────────────────────────────────────

admin.get('/pricing', asyncRoute(async (_req, res) => {
  res.json({ rules: await activeRules(), grid: await pricingGrid(), catalog: await listCatalog(false) });
}));

admin.put('/catalog/:tld', validate({ body: catalogInput.omit({ tld: true }) }), asyncRoute(async (req, res) => {
  res.json(await setCatalogPrice({ ...req.body, tld: String(req.params.tld).toLowerCase() }, actor(req)));
}));

admin.get('/catalog/:tld/history', asyncRoute(async (req, res) => {
  res.json({ history: await catalogHistory(String(req.params.tld).toLowerCase()) });
}));

admin.put('/rules', validate({ body: rulesSchema.partial() }), asyncRoute(async (req, res) => {
  res.json(await updateRules(req.body, actor(req)));
}));

admin.get('/promotions', asyncRoute(async (_req, res) => {
  res.json({ promotions: await listPromotions() });
}));

admin.post('/promotions', validate({ body: promotionInput }), asyncRoute(async (req, res) => {
  res.status(201).json(await createPromotion(req.body, actor(req)));
}));

admin.post('/promotions/:id/end', validate({ params: z.object({ id: z.coerce.number().int().positive() }) }), asyncRoute(async (req, res) => {
  await endPromotion(Number(req.params.id), actor(req));
  res.json({ ok: true });
}));

// ─── Fournisseurs ───────────────────────────────────────────────────────────

admin.get('/providers', asyncRoute(async (_req, res) => {
  // Les identifiants ne quittent jamais le serveur : seul l'état « configuré » est montré.
  const { registrar } = await import('../integrations/registrars');
  const rows = await query<Record<string, unknown> & { code: string }>(`SELECT * FROM registrar_providers ORDER BY priority`);
  res.json({ providers: rows.map((r) => ({ ...r, configured: Boolean(registrar(r.code)) })) });
}));

admin.patch('/providers/:code', validate({ body: providerPatch }), asyncRoute(async (req, res) => {
  await updateProvider(String(req.params.code), req.body, actor(req));
  res.json({ ok: true });
}));

admin.put('/providers/:code/costs', validate({ body: manualCostInput }), asyncRoute(async (req, res) => {
  await setManualCost(String(req.params.code), req.body, actor(req));
  res.json({ ok: true });
}));

admin.post('/providers/sync', asyncRoute(async (_req, res) => {
  const synced = await syncProviderCosts();
  await checkProviderHealth();
  res.json({ synced });
}));

admin.put('/fx/:currency', validate({ body: z.object({ xafPerUnit: z.number().positive().max(100_000) }) }), asyncRoute(async (req, res) => {
  await setFxRate(String(req.params.currency), req.body.xafPerUnit, actor(req));
  res.json({ ok: true });
}));

// ─── Commandes et opérations ──────────────────────────────────────────────

admin.get('/orders', validate({ query: z.object({ status: z.string().max(20).optional() }) }), asyncRoute(async (req, res) => {
  const rows = await query(
    `SELECT o.*, (SELECT json_agg(oi ORDER BY oi.created_at) FROM order_items oi WHERE oi.order_id = o.id) AS items
       FROM orders o WHERE ($1::text IS NULL OR o.status = $1) ORDER BY o.updated_at DESC LIMIT 200`,
    [req.query.status ?? null]
  );
  res.json({ orders: rows });
}));

admin.get('/orders/:id', asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  const [items, payments, operations, auditLog] = await Promise.all([
    orderItems(id),
    query(`SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at`, [id]),
    query(`SELECT id, order_item_id, kind, provider_code, status, attempts, error_code, error, created_at, updated_at FROM domain_operations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1) ORDER BY created_at`, [id]),
    query(`SELECT * FROM audit_logs WHERE target_id = $1 OR data->>'orderId' = $1 ORDER BY created_at`, [id]),
  ]);
  res.json({ items: items.map(({ auth_code, ...rest }) => ({ ...rest, hasAuthCode: Boolean(auth_code) })), payments, operations, audit: auditLog });
}));

admin.post('/order-items/:id/retry', asyncRoute(async (req, res) => {
  await retryItem(String(req.params.id));
  res.json({ ok: true });
}));

admin.post('/orders/:id/refund', asyncRoute(async (req, res) => {
  await abandonOrder(String(req.params.id), `Commande remboursée par l'équipe (${actor(req)})`);
  res.json({ ok: true });
}));

admin.get('/connections', asyncRoute(async (_req, res) => {
  res.json({ connections: await query(`SELECT * FROM domain_connections WHERE status NOT IN ('active', 'detached') ORDER BY updated_at DESC LIMIT 200`) });
}));

admin.get('/audit', validate({ query: z.object({ targetId: z.string().max(128).optional() }) }), asyncRoute(async (req, res) => {
  res.json({ audit: await query(`SELECT * FROM audit_logs WHERE ($1::text IS NULL OR target_id = $1) ORDER BY created_at DESC LIMIT 300`, [req.query.targetId ?? null]) });
}));

admin.get('/webhooks', asyncRoute(async (_req, res) => {
  res.json({ deliveries: await query(`SELECT id, event, target, status, attempts, last_status, last_error, created_at, delivered_at FROM webhook_deliveries ORDER BY created_at DESC LIMIT 200`) });
}));
