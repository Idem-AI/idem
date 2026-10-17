import { Router, Request, Response } from 'express';
import { CREATIVITY_LEVELS } from '../models/creativity.model';
import { COMMUNICATION_PRICES, DELIVERABLES, SIGNATURE_PRICE_XAF, isDeliverable } from '../models/offer.model';
import billingController from '../controllers/billing.controller';
import offerController from '../controllers/offer.controller';
import { ownershipService } from '../services/billing/ownership.service';
import { entitlementsService } from '../services/billing/entitlements.service';
import { authenticate } from '../services/auth.service';
import { verifyApiKey } from '../middleware/verifyApiKey';
import { rateLimitByUser, rateLimitByIP } from '../middleware/rate-limit.middleware';

/**
 * Routes de facturation.
 *
 * Trois régimes d'accès :
 *  - `/billing/*` : utilisateur authentifié ;
 *  - `/billing/webhooks/*` : pawaPay, non authentifié (voir le contrôleur pour
 *    les trois protections qui remplacent la session) ;
 *  - `/internal/billing/*` : panel admin, par clé de service.
 */

const router = Router();

/**
 * Limite de lancement de paiement : 5 par minute et par utilisateur.
 *
 * Assez large pour réessayer après un code refusé, assez serré pour qu'un
 * script ne puisse pas noyer l'opérateur de demandes — chacune faisant sonner
 * le téléphone d'un abonné.
 */
const checkoutLimit = rateLimitByUser({
  windowMs: 60_000,
  maxRequests: 5,
  keyPrefix: 'ratelimit:checkout',
});

/** La détection d'opérateur est appelée à chaque frappe : plus permissive. */
const predictLimit = rateLimitByUser({
  windowMs: 60_000,
  maxRequests: 30,
  keyPrefix: 'ratelimit:predict',
});

// ============================================
// CATALOGUE ET DROITS
// ============================================

/**
 * @openapi
 * /billing/catalog:
 *   get:
 *     tags: [Billing]
 *     summary: Catalogue des offres actives
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Produits, pays et devise de référence }
 */
router.get('/catalog', authenticate, (req: Request, res: Response) =>
  billingController.getCatalog(req as any, res)
);

/**
 * @openapi
 * /billing/me:
 *   get:
 *     tags: [Billing]
 *     summary: Offre et soldes de l'utilisateur
 *     description: Abonnements par moteur, crédits, passes en cours, statut bêta.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Droits courants }
 */
router.get('/me', authenticate, (req: Request, res: Response) =>
  billingController.getMe(req as any, res)
);

/**
 * @openapi
 * /billing/payment-methods:
 *   get:
 *     tags: [Billing]
 *     summary: Opérateurs Mobile Money disponibles dans un pays
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: country
 *         schema: { type: string, example: CMR }
 *     responses:
 *       '200': { description: Opérateurs, bornes de montant et disponibilité }
 */
router.get('/payment-methods', authenticate, (req: Request, res: Response) =>
  billingController.getPaymentMethods(req as any, res)
);

// Tarification effective, publique : les prix ne sont pas un secret, et la page
// d'offres doit pouvoir les afficher avant toute connexion.
router.get('/pricing', (req: Request, res: Response) => billingController.getPricing(req, res));

/**
 * @openapi
 * /billing/predict-provider:
 *   post:
 *     tags: [Billing]
 *     summary: Devine l'opérateur d'un numéro
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Opérateur et numéro normalisé, ou valeurs nulles }
 */
router.post('/predict-provider', authenticate, predictLimit, (req: Request, res: Response) =>
  billingController.predictProvider(req as any, res)
);

/**
 * @openapi
 * /billing/quote:
 *   get:
 *     tags: [Billing]
 *     summary: Prix d'une offre dans la devise du pays
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: productCode
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: Montant à payer }
 *       '404': { description: Offre inconnue }
 */
router.get('/quote', authenticate, (req: Request, res: Response) =>
  billingController.getQuote(req as any, res)
);

// ============================================
// PAIEMENT
// ============================================

/**
 * @openapi
 * /billing/checkout:
 *   post:
 *     tags: [Billing]
 *     summary: Lance un paiement Mobile Money
 *     description: >
 *       Le montant n'est jamais fourni par le client : il est calculé à partir
 *       du code produit. Envoyer un en-tête `Idempotency-Key` évite qu'un
 *       double-clic ne débite deux fois.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productCode, phoneNumber]
 *             properties:
 *               productCode: { type: string }
 *               phoneNumber: { type: string }
 *               country: { type: string }
 *               provider: { type: string }
 *               engine: { type: string, enum: [business, appgen, ideploy] }
 *               projectId: { type: string }
 *               interval: { type: string, enum: [month, year] }
 *     responses:
 *       '202': { description: Paiement lancé, à suivre par sa référence }
 *       '400': { description: Requête invalide ou opérateur inutilisable }
 *       '409': { description: Offre déjà détenue }
 *       '503': { description: Paiements suspendus }
 */
router.post('/checkout', authenticate, checkoutLimit, (req: Request, res: Response) =>
  billingController.checkout(req as any, res)
);

/**
 * @openapi
 * /billing/consume:
 *   post:
 *     tags: [Billing]
 *     summary: Autorise et débite une action facturable
 *     description: >
 *       Appelé par les services IDEM qui génèrent hors de cette API (AppGen),
 *       avec le jeton de l'utilisateur. Le barème, le quota de générations
 *       offertes et le débit restent ici : un second exemplaire de ces règles
 *       finirait par diverger.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [engine, action]
 *             properties:
 *               engine: { type: string, enum: [business, appgen, ideploy] }
 *               action: { type: string, example: build }
 *               projectId: { type: string }
 *     responses:
 *       '200': { description: Action autorisée (débit effectué le cas échéant) }
 *       '402': { description: Crédits insuffisants ou quota du jour atteint }
 */
router.post('/consume', authenticate, (req: Request, res: Response) =>
  billingController.consume(req as any, res)
);

/**
 * @openapi
 * /billing/payments/{reference}:
 *   get:
 *     tags: [Billing]
 *     summary: Statut d'un paiement
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Statut courant }
 *       '404': { description: Paiement introuvable }
 */
router.get('/payments/:reference', authenticate, (req: Request, res: Response) =>
  billingController.getPayment(req as any, res)
);

/**
 * @openapi
 * /billing/payments:
 *   get:
 *     tags: [Billing]
 *     summary: Historique des paiements de l'utilisateur
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Paiements, du plus récent au plus ancien }
 */
router.get('/payments', authenticate, (req: Request, res: Response) =>
  billingController.listPayments(req as any, res)
);

/**
 * @openapi
 * /billing/credits:
 *   get:
 *     tags: [Billing]
 *     summary: Relevé de crédits
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Écritures du grand livre }
 */
router.get('/credits', authenticate, (req: Request, res: Response) =>
  billingController.getCreditStatement(req as any, res)
);

/**
 * @openapi
 * /billing/quotas:
 *   get:
 *     tags: [Billing]
 *     summary: Quotas d'usage IA de l'utilisateur
 *     description: >
 *       Par groupe de fonctionnalités (aides IA, retouches, créations, livrables complets,
 *       vidéos, applications iCode, modifications iCode, simulations) : utilisé, limite de
 *       l'offre et renouvellement pour le jour, la semaine (ISO, lundi) et le mois (UTC).
 *       `capacity` donne, en pourcentage, la part consommée du plafond de dépense IA.
 *       Une génération refusée par un quota répond 429 `quota_exceeded`.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: État des quotas }
 */
router.get('/quotas', authenticate, (req: Request, res: Response) =>
  billingController.getQuotas(req as any, res)
);

/**
 * @openapi
 * /billing/creativity/{projectId}:
 *   get:
 *     tags: [Billing]
 *     summary: Ce que coûte un contenu à chaque cran de la jauge de créativité
 *     description: >
 *       La jauge ne change plus le prix : Low à High coûtent pareil. Un livrable non possédé
 *       se génère en ESQUISSE gratuite ; possédé, sa version finale est déjà payée. Ultra
 *       correspond à la version Signature (+1 000 F). Les contenus de communication gardent
 *       leur prix unitaire, inclus avec le forfait Croissance.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: query, name: action, required: true, schema: { type: string } }
 */
const CREATIVITY_UNITS: Record<string, number> = {
  flyer: COMMUNICATION_PRICES.flyer,
  carousel: COMMUNICATION_PRICES.carousel,
};
router.get('/creativity/:projectId', authenticate, async (req: Request, res: Response) => {
  const action = String(req.query.action || '');
  const userId = (req as any).user!.uid as string;
  const projectId = String(req.params.projectId);

  if (isDeliverable(action)) {
    // Générer ne se paie jamais au cran : une esquisse est gratuite, une version finale a été
    // payée au déblocage. Ultra ne force les modèles les plus puissants qu'en version Signature
    // (débloquée à part, +1 000 F) ; sinon la génération tourne au cran High.
    const owned = await ownershipService.isOwned(userId, projectId, action);
    res.json({
      action,
      mode: owned ? 'final' : 'draft',
      owned,
      unlockPriceXaf: DELIVERABLES[action].priceXaf,
      signaturePriceXaf: SIGNATURE_PRICE_XAF,
      baseCost: 0,
      costs: Object.fromEntries(CREATIVITY_LEVELS.map((level) => [level, 0])),
    });
    return;
  }

  const unit = CREATIVITY_UNITS[action];
  if (unit === undefined) {
    res.status(400).json({ error: 'unknown_action' });
    return;
  }
  const offer = (await entitlementsService.resolve(userId)).offer;
  const price = offer.croissance ? 0 : unit;
  res.json({
    action,
    mode: offer.croissance ? 'included' : 'paid',
    baseCost: price,
    costs: Object.fromEntries(CREATIVITY_LEVELS.map((level) => [level, price])),
  });
});

// ============================================
// PORTEFEUILLE ET OFFRES
// ============================================

// Les prix du modèle, publics comme `/pricing` : la landing les affiche sans connexion.
router.get('/offers', (req: Request, res: Response) => offerController.getOffers(req, res));

/**
 * @openapi
 * /billing/wallet:
 *   get:
 *     tags: [Billing]
 *     summary: Portefeuille en francs, forfaits actifs, droits prépayés et relevé
 *     security: [{ bearerAuth: [] }]
 */
router.get('/wallet', authenticate, (req: Request, res: Response) => offerController.getWallet(req as any, res));

/**
 * @openapi
 * /billing/offers/buy:
 *   post:
 *     tags: [Billing]
 *     summary: Achète une offre avec le portefeuille
 *     description: >
 *       `kind` : pass (croissance, entreprise, createur), pack (lancement, lancement_domaine,
 *       a_plusieurs), unlock (projectId + deliverable, tier final|signature),
 *       icode_project_pass, icode_pack_100, domain. Un solde insuffisant répond 402 avec la
 *       recharge (`topupXaf`) qui couvre le manque.
 *     security: [{ bearerAuth: [] }]
 */
router.post('/offers/buy', authenticate, checkoutLimit, (req: Request, res: Response) =>
  offerController.buy(req as any, res)
);

// iCode : le projet est-il possédé (Pass Projet, forfait, bêta) ? Lu par l'atelier AppGen.
router.get('/access/appgen/:projectId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.uid as string;
    const entitlements = await entitlementsService.resolve(userId);
    const unlocked = entitlements.beta.active || (await entitlementsService.hasProjectAccess(userId, String(req.params.projectId)));
    res.json({ unlocked, projectPassVouchers: entitlements.offer.projectPassVouchers, modifications: entitlements.offer.modifications });
  } catch {
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/projects/:projectId/ownership', authenticate, (req: Request, res: Response) =>
  offerController.getOwnership(req as any, res)
);

router.post('/codes/redeem', authenticate, checkoutLimit, (req: Request, res: Response) =>
  offerController.redeemCode(req as any, res)
);
router.get('/codes', authenticate, (req: Request, res: Response) => offerController.listCodes(req as any, res));

router.post('/domains/order', authenticate, checkoutLimit, (req: Request, res: Response) =>
  offerController.orderDomain(req as any, res)
);
router.get('/domains', authenticate, (req: Request, res: Response) => offerController.listDomains(req as any, res));

// Compteurs iDeploy : une application = un compteur, payé au jour depuis le portefeuille.
router.get('/deploy/meters', authenticate, (req: Request, res: Response) => offerController.listMeters(req as any, res));
router.put('/deploy/meters/:appUuid', authenticate, (req: Request, res: Response) =>
  offerController.configureMeter(req as any, res)
);
router.post('/deploy/meters/:appUuid/wake', authenticate, (req: Request, res: Response) =>
  offerController.wakeMeter(req as any, res)
);

/**
 * @openapi
 * /billing/invoices:
 *   get:
 *     tags: [Billing]
 *     summary: Factures de l'utilisateur
 *     description: >
 *       Les factures sont émises à chaque encaissement et à chaque
 *       renouvellement. Les brouillons ne sont pas exposés.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Factures, de la plus récente à la plus ancienne }
 */
router.get('/invoices', authenticate, (req: Request, res: Response) =>
  billingController.listInvoices(req as any, res)
);

// ============================================
// WEBHOOK PAWAPAY
// ============================================

/**
 * @openapi
 * /billing/webhooks/pawapay/deposits:
 *   post:
 *     tags: [Billing]
 *     summary: Callback de dépôt pawaPay
 *     description: >
 *       Non authentifié par construction. Protégé par liste blanche d'IP,
 *       signature RFC 9421 et, surtout, relecture du statut avant livraison.
 *     responses:
 *       '200': { description: Callback accepté }
 *       '403': { description: Origine ou signature refusée }
 */
router.post(
  '/webhooks/pawapay/deposits',
  // Limite par IP : la liste blanche filtre déjà, ceci borne le reste.
  rateLimitByIP({ windowMs: 60_000, maxRequests: 300, keyPrefix: 'ratelimit:callback' }),
  (req: Request, res: Response) => billingController.depositCallback(req, res)
);

// ============================================
// ENDPOINTS INTERNES
// ============================================

router.get('/internal/health', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalHealth(req, res)
);

router.post('/internal/payments/:reference/recheck', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalRecheck(req, res)
);

router.post(
  '/internal/payments/:reference/resend-callback',
  verifyApiKey,
  (req: Request, res: Response) => billingController.internalResendCallback(req, res)
);

router.post('/internal/payments/:reference/fulfill', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalFulfill(req, res)
);

router.post('/internal/payments/:reference/refund', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalRefund(req, res)
);

// --- Bêta premium ----------------------------------------------------------
// Le panel admin tient la liste ; l'ouverture des droits et l'envoi des
// invitations restent ici, où vivent la facturation et les crédits.

router.get('/internal/beta/testers', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalBetaList(req, res)
);

router.post('/internal/beta/import', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalBetaImport(req, res)
);

router.post('/internal/beta/testers', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalBetaAdd(req, res)
);

router.post('/internal/beta/invite', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalBetaInvite(req, res)
);

router.post('/internal/beta/revoke', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalBetaRevoke(req, res)
);

// --- Réglages et crédits ---------------------------------------------------

router.get('/internal/settings', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalGetSettings(req, res)
);

router.put('/internal/settings', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalUpdateSettings(req, res)
);

router.post('/internal/credits/adjust', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalAdjustCredits(req, res)
);

// --- Quotas d'usage ----------------------------------------------------------
//
// Les limites se règlent dans les réglages (`usageQuotas`, PUT /internal/settings) ;
// ici, l'état d'un compte et la remise à zéro de ses compteurs.

router.get('/internal/quotas/:userId', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalGetUserQuotas(req, res)
);

router.post('/internal/quotas/reset', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalResetQuotas(req, res)
);

// --- Synchronisation iDeploy -----------------------------------------------
//
// Un plan payé ici doit arriver dans une autre base. Quand la propagation
// échoue, elle doit être visible et rejouable — sinon le client est le seul à
// s'apercevoir qu'il paie un plan qu'il n'a pas.

router.get('/internal/sync-jobs', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalSyncJobs(req, res)
);

router.post('/internal/sync-jobs/:jobId/retry', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalSyncJobRetry(req, res)
);

// --- Tarification ------------------------------------------------------------
//
// Le panel lit les valeurs par défaut du fichier, les surcharges et les
// anomalies ; il écrit des surcharges, jamais le fichier.

router.get('/internal/pricing', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalGetPricing(req, res)
);

router.put('/internal/pricing', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalUpdatePricing(req, res)
);

router.get('/internal/pricing/history', verifyApiKey, (req: Request, res: Response) =>
  billingController.internalPricingHistory(req, res)
);

export { router as billingRoutes };
// Modèle « au portefeuille » : codes, compteurs (les domaines sont chez iDomain : /admin/v1).
router.post('/internal/codes', verifyApiKey, (req: Request, res: Response) =>
  offerController.internalGenerateCodes(req, res)
);
router.get('/internal/codes/agents/:agentId', verifyApiKey, (req: Request, res: Response) =>
  offerController.internalAgentReport(req, res)
);
router.post('/internal/meters/run', verifyApiKey, (_req: Request, res: Response) =>
  offerController.internalRunMeters(_req, res)
);

export default router;
