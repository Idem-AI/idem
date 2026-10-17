/**
 * PASSERELLE INTERNE D'iDOMAIN — `/internal/idomain/*`.
 *
 * iDomain (`apps/idomain/api`) vend les noms de domaine d'IDEM. Il n'a pas de portefeuille à lui :
 * une commande se paie depuis le portefeuille IDEM de l'utilisateur, en francs, aux mêmes règles
 * que le reste de la plateforme (le mobile money ne vend que la recharge).
 *
 *   billing/charge   débit d'une commande, IDEMPOTENT par `reference` (registre `idomain_charges`) ;
 *   billing/refund   restitution de tout ou partie d'un débit, une fois par `refundReference`,
 *                    jamais au-delà du montant débité ;
 *   billing/account  solde, et droit aux domaines au coût (forfait Entreprise).
 *
 * Accès : l'en-tête `x-idomain-key` (= `IDOMAIN_SERVICE_KEY`). Clé DÉDIÉE, distincte de
 * `INTERNAL_API_KEY` et de `IVISION_SERVICE_KEY` : elle n'ouvre que ces routes.
 */
import { NextFunction, Request, Response, Router } from 'express';
import logger from '../config/logger';
import { paymentRequiredBody } from '../middleware/billing.middleware';
import { IdomainCharge } from '../schemas/idomain-charge.schema';
import { entitlementsService } from '../services/billing/entitlements.service';
import { walletService } from '../services/billing/wallet.service';
import { setTraceUserId } from '../utils/trace.util';
import { safeEqual } from '../utils/safe-equal.util';

const router = Router();

/** Plafond d'un débit unique : cinq domaines sur dix ans restent en dessous. */
const MAX_CHARGE_XAF = 1_000_000;
const ACTIONS = new Set(['domain_register', 'domain_renew', 'domain_transfer']);
/** Un débit resté « en cours » au-delà est douteux (processus arrêté entre deux écritures). */
const STALE_PENDING_MS = 2 * 60_000;

function requireIdomainKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.IDOMAIN_SERVICE_KEY;
  const provided = req.headers['x-idomain-key'];
  if (!expected) {
    logger.error('idomain.gateway_unconfigured', { event: 'idomain.gateway_unconfigured' });
    res.status(503).json({ error: 'gateway_unconfigured' });
    return;
  }
  if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
    logger.warn('idomain.gateway_denied', { event: 'idomain.gateway_denied', path: req.path, ip: req.ip });
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response): void => {
    fn(req, res).catch((error: Error) => {
      logger.error('idomain.gateway_failed', { event: 'idomain.gateway_failed', path: req.path, error });
      if (!res.headersSent) res.status(502).json({ error: 'upstream_failed', message: error.message });
    });
  };

router.use(requireIdomainKey);

router.post(
  '/billing/charge',
  route(async (req, res) => {
    const userId = text(req.body?.userId, 128);
    const reference = text(req.body?.reference, 120);
    const amountXaf = req.body?.amountXaf;
    const action = text(req.body?.action, 40);
    if (!userId || !reference || !ACTIONS.has(action) || typeof amountXaf !== 'number' || !Number.isInteger(amountXaf) || amountXaf <= 0 || amountXaf > MAX_CHARGE_XAF) {
      res.status(400).json({ error: 'invalid_charge' });
      return;
    }
    setTraceUserId(userId);

    // La référence est réservée AVANT le débit : deux appels simultanés ne débitent qu'une fois.
    let claim;
    try {
      claim = await IdomainCharge.create({ reference, userId, amountXaf, status: 'pending' });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await IdomainCharge.findOne({ reference }).lean();
      if (!existing || existing.userId !== userId || existing.amountXaf !== amountXaf) {
        res.status(409).json({ error: 'reference_conflict', message: 'Cette référence a déjà servi pour un autre débit.' });
        return;
      }
      if (existing.status === 'charged') {
        res.json({ charged: true, chargedXaf: existing.amountXaf, balanceXaf: await walletService.balance(userId), ledgerEntryId: existing.ledgerEntryId, replayed: true });
        return;
      }
      const stale = Date.now() - new Date(existing.updatedAt).getTime() > STALE_PENDING_MS;
      if (stale) logger.error('idomain.charge_in_doubt', { event: 'idomain.charge_in_doubt', alert: 'critical', reference, userId, amountXaf });
      res.status(409).json({ error: stale ? 'charge_in_doubt' : 'charge_in_progress', message: 'Ce paiement est déjà en cours de traitement.' });
      return;
    }

    const spend = await walletService.spend(userId, { priceXaf: amountXaf, label: text(req.body?.label, 120) || 'Nom de domaine', action, feature: 'idomain', element: reference });
    if (!spend.allowed) {
      // Rien n'a été débité : la référence est libérée, le client pourra payer après une recharge.
      await IdomainCharge.deleteOne({ _id: claim._id, status: 'pending' });
      res.status(402).json(
        await paymentRequiredBody({ action, label: text(req.body?.label, 120) || 'Nom de domaine', priceXaf: spend.dueXaf, balanceXaf: spend.balanceXaf, missingXaf: spend.missingXaf })
      );
      return;
    }
    await IdomainCharge.updateOne({ _id: claim._id }, { status: 'charged', ledgerEntryId: spend.ledgerEntryId });
    await entitlementsService.invalidate(userId);
    res.json({ charged: true, chargedXaf: spend.chargedXaf, balanceXaf: spend.balanceXaf, ledgerEntryId: spend.ledgerEntryId });
  })
);

router.post(
  '/billing/refund',
  route(async (req, res) => {
    const userId = text(req.body?.userId, 128);
    const chargeReference = text(req.body?.chargeReference, 120);
    const refundReference = text(req.body?.refundReference, 160);
    const amountXaf = req.body?.amountXaf;
    if (!userId || !chargeReference || !refundReference || typeof amountXaf !== 'number' || !Number.isInteger(amountXaf) || amountXaf <= 0) {
      res.status(400).json({ error: 'invalid_refund' });
      return;
    }
    const charge = await IdomainCharge.findOne({ reference: chargeReference, userId, status: 'charged' }).lean();
    if (!charge) {
      res.status(404).json({ error: 'charge_not_found' });
      return;
    }
    if (charge.refunds.some((r) => r.reference === refundReference)) {
      res.json({ ok: true, refunded: false, replayed: true, balanceXaf: await walletService.balance(userId) });
      return;
    }
    // Réservation atomique : la restitution n'est inscrite que si elle ne dépasse pas le débit
    // et que sa référence n'a pas encore servi.
    const reserved = await IdomainCharge.findOneAndUpdate(
      { _id: charge._id, 'refunds.reference': { $ne: refundReference }, refundedXaf: { $lte: charge.amountXaf - amountXaf } },
      { $inc: { refundedXaf: amountXaf }, $push: { refunds: { reference: refundReference, amountXaf, at: new Date() } } },
      { new: true }
    ).lean();
    if (!reserved) {
      res.status(409).json({ error: 'refund_exceeds_charge', message: 'Cette restitution dépasserait le montant payé.' });
      return;
    }
    let balanceXaf: number;
    try {
      balanceXaf = await walletService.refund(userId, amountXaf, { action: 'domain_refund', feature: 'idomain', note: text(req.body?.note, 160) || 'Domaine non enregistré — montant restitué' });
    } catch (error) {
      // L'argent n'est pas rendu : la réservation est retirée, la reprise d'iDomain pourra rejouer.
      await IdomainCharge.updateOne({ _id: charge._id }, { $inc: { refundedXaf: -amountXaf }, $pull: { refunds: { reference: refundReference } } });
      throw error;
    }
    await entitlementsService.invalidate(userId);
    res.json({ ok: true, refunded: true, balanceXaf });
  })
);

router.get(
  '/billing/account',
  route(async (req, res) => {
    const userId = text(req.query.userId, 128);
    if (!userId) {
      res.status(400).json({ error: 'user_required' });
      return;
    }
    const { offer } = await entitlementsService.resolve(userId);
    // Domaines au coût : le forfait Entreprise (plan économique §9.3).
    res.json({ walletXaf: offer.walletXaf, atCost: Boolean(offer.passes?.entreprise) });
  })
);

export default router;
