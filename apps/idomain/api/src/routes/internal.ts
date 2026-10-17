/**
 * Les routes de SERVICE appelées par l'API IDEM (`/internal/v1`, clé `IDOMAIN_SERVICE_KEY`).
 *
 * iDomain est désormais la seule source des domaines : l'API IDEM ne garde ni prix ni commandes,
 * elle relaie ici le pack Lancement + domaine (payé chez elle) et ses anciennes routes
 * `/billing/domains` (liste, prix affichés).
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireKey } from '../middleware/auth';
import { asyncRoute } from '../middleware/error';
import { validate } from '../middleware/validate';
import { listDomains } from '../modules/domains/domains.service';
import { createPrepaidOrder, listOrders, prepaidInput, publicOrder } from '../modules/orders/orders.service';
import { listCatalog } from '../modules/pricing/catalog.service';

export const internal = Router();
internal.use(requireKey('service'));

/** Les prix publics, au format que lisait l'API IDEM (`DOMAIN_PRICES`). */
internal.get(
  '/catalog',
  asyncRoute(async (_req, res) => {
    const rows = await listCatalog();
    res.json({ currency: 'XAF', domains: Object.fromEntries(rows.map((r) => [r.tld, { priceXaf: r.register_xaf, renewalXaf: r.renew_xaf, packXaf: r.pack_xaf }])) });
  })
);

/** Une commande payée par IDEM (pack) : idempotente par `reference`. */
internal.post(
  '/orders/prepaid',
  validate({ body: prepaidInput }),
  asyncRoute(async (req, res) => {
    const { order, items } = await createPrepaidOrder(req.body);
    res.status(201).json(publicOrder(order, items));
  })
);

internal.get(
  '/users/:uid/domains',
  validate({ params: z.object({ uid: z.string().min(1).max(128) }) }),
  asyncRoute(async (req, res) => {
    res.json({ domains: await listDomains(String(req.params.uid)), orders: await listOrders(String(req.params.uid), 100) });
  })
);
