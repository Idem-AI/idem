/**
 * L'API publique d'iDomain (`/v1`), appelée par iDomain web, et par iDeploy et iCode avec le
 * cookie de session de l'utilisateur. Contrat décrit dans `GET /v1/openapi.json`.
 */
import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, authenticate } from '../middleware/auth';
import { asyncRoute } from '../middleware/error';
import { validate } from '../middleware/validate';
import { hosting } from '../integrations/ideploy.client';
import { contactInput, defaultContact, saveDefaultContact } from '../modules/contacts/contacts.service';
import { connectionInput, detachConnection, getConnection, listConnections, publicConnection, requestConnection, retryConnection } from '../modules/connections/connections.service';
import { listRecordSets, recordSetInput, saveRecordSet } from '../modules/dns/dns.service';
import { getDomain, listDomains, registrarInfo } from '../modules/domains/domains.service';
import { cancelOrder, createOrder, createPriceSession, getOrder, listOrders, orderInput, payOrder, priceSessionInput, publicOrder, resumeAwaitingContact } from '../modules/orders/orders.service';
import { hasAtCostPricing } from '../modules/payments/wallet.service';
import { listCatalog } from '../modules/pricing/catalog.service';
import { searchDomains } from '../modules/search/search.service';
import { createDomainSession, domainSessionInput, getDomainSession } from '../modules/sessions/sessions.service';
import { openApiDocument } from './openapi';

export const v1 = Router();

const uuidParam = z.object({ id: z.string().uuid() });

v1.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

/** Les prix publics, sans connexion : la page d'accueil les affiche. */
v1.get(
  '/catalog',
  asyncRoute(async (_req, res) => {
    const rows = await listCatalog();
    res.json({ currency: 'XAF', extensions: rows.map((r) => ({ tld: r.tld, registerXaf: r.register_xaf, renewXaf: r.renew_xaf, transferXaf: r.transfer_xaf })) });
  })
);

/** La recherche marche sans connexion (prix au catalogue) ; connecté, le prix au coût s'applique s'il y a droit. */
v1.get(
  '/domains/search',
  validate({ query: z.object({ q: z.string().trim().min(1).max(253), years: z.coerce.number().int().min(1).max(10).optional() }) }),
  asyncRoute(async (req, res) => {
    const uid = await optionalUid(req);
    const atCost = uid ? await hasAtCostPricing(uid) : false;
    res.json(await searchDomains(String(req.query.q), { years: req.query.years ? Number(req.query.years) : 1, atCost }));
  })
);

v1.use(authenticate);

v1.get(
  '/me',
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ user: { uid: req.user.uid, email: req.user.email, displayName: req.user.displayName }, contact: await defaultContact(req.user.uid), atCost: await hasAtCostPricing(req.user.uid) });
  })
);

// ─── Titulaire ──────────────────────────────────────────────────────────────

v1.get(
  '/contact',
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ contact: await defaultContact(req.user.uid) });
  })
);

v1.put(
  '/contact',
  validate({ body: contactInput }),
  asyncRoute(async (req: AuthedRequest, res) => {
    const contact = await saveDefaultContact(req.user.uid, req.body);
    // Des commandes (pack) attendaient le titulaire : elles repartent.
    const resumed = await resumeAwaitingContact(req.user.uid);
    res.json({ contact, resumedOrders: resumed });
  })
);

// ─── Prix garanti et commandes ─────────────────────────────────────────────

v1.post(
  '/price-sessions',
  validate({ body: priceSessionInput }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.status(201).json(await createPriceSession(req.user.uid, req.body));
  })
);

v1.post(
  '/orders',
  validate({ body: orderInput }),
  asyncRoute(async (req: AuthedRequest, res) => {
    const { order, items } = await createOrder(req.user.uid, req.body);
    res.status(201).json(publicOrder(order, items));
  })
);

v1.get(
  '/orders',
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ orders: await listOrders(req.user.uid) });
  })
);

v1.get(
  '/orders/:id',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json(await getOrder(req.user.uid, req.params.id));
  })
);

/** Payer une commande restée en attente (après une recharge du portefeuille). */
v1.post(
  '/orders/:id/pay',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    const { order, items } = await payOrder(req.user.uid, req.params.id);
    res.json(publicOrder(order, items));
  })
);

v1.post(
  '/orders/:id/cancel',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    await cancelOrder(req.user.uid, req.params.id);
    res.json(await getOrder(req.user.uid, req.params.id));
  })
);

// ─── Domaines ───────────────────────────────────────────────────────────────

v1.get(
  '/domains',
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ domains: await listDomains(req.user.uid) });
  })
);

v1.get(
  '/domains/:id',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json(await getDomain(req.user.uid, req.params.id));
  })
);

v1.get(
  '/domains/:id/status',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    const domain = await getDomain(req.user.uid, req.params.id);
    res.json({ id: domain.id, name: domain.name, status: domain.status, expiresAt: domain.expiresAt, daysLeft: domain.daysLeft, connection: domain.connection });
  })
);

/** Informations légales : le registrar (absent de l'interface ordinaire, dû au titulaire). */
v1.get(
  '/domains/:id/registrar',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json(await registrarInfo(req.user.uid, req.params.id));
  })
);

v1.get(
  '/domains/:id/dns-records',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ records: await listRecordSets(req.user.uid, req.params.id) });
  })
);

v1.post(
  '/domains/:id/dns-records',
  validate({ params: uuidParam, body: recordSetInput }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ records: await saveRecordSet(req.user.uid, req.params.id, req.body) });
  })
);

// ─── Connexion à une application ───────────────────────────────────────────

/** Les applications iDeploy de l'utilisateur (le choix « à quelle application le relier »). */
v1.get(
  '/applications',
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ applications: await hosting.applications(req.user.uid) });
  })
);

v1.post(
  '/domain-sessions',
  validate({ body: domainSessionInput }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.status(201).json(await createDomainSession(req.user.uid, req.body));
  })
);

v1.get(
  '/domain-sessions/:id',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json(await getDomainSession(req.user.uid, req.params.id));
  })
);

v1.post(
  '/domain-connections',
  validate({ body: connectionInput }),
  asyncRoute(async (req: AuthedRequest, res) => {
    const row = await requestConnection(req.user.uid, req.body);
    res.status(201).json(await publicConnection(row));
  })
);

v1.get(
  '/domain-connections',
  validate({ query: z.object({ appUuid: z.string().max(64).optional(), domainId: z.string().uuid().optional() }) }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ connections: await listConnections(req.user.uid, { appUuid: req.query.appUuid as string | undefined, domainId: req.query.domainId as string | undefined }) });
  })
);

v1.get(
  '/domain-connections/:id',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json(await getConnection(req.user.uid, req.params.id));
  })
);

v1.post(
  '/domain-connections/:id/retry',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json(await publicConnection(await retryConnection(req.user.uid, req.params.id)));
  })
);

v1.delete(
  '/domain-connections/:id',
  validate({ params: uuidParam }),
  asyncRoute(async (req: AuthedRequest, res) => {
    res.json(await publicConnection(await detachConnection(req.user.uid, req.params.id)));
  })
);

/** La recherche sans connexion : l'identité est lue si elle est là, jamais exigée. */
async function optionalUid(req: { cookies?: Record<string, string>; get(name: string): string | undefined }): Promise<string | null> {
  const cookie = req.cookies?.session;
  if (!cookie) return null;
  const { verifySession } = await import('../integrations/idem.client');
  return (await verifySession(cookie, req.get('user-agent') || '').catch(() => null))?.uid ?? null;
}
