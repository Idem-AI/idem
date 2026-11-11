import { Request, Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { verifySessionForRequest } from '../services/sessionCookie.service';
import { entitlementsService } from '../services/billing/entitlements.service';
import { PromotionError, promotionService } from '../services/billing/promotion.service';

/**
 * Promotions : lecture publique (prix barrés), saisie d'un code promo, et administration depuis le
 * panel (`/billing/internal/promotions`, clé de service). Le panel transmet l'adresse de
 * l'administrateur dans `by`, gardée pour l'audit.
 */

function fail(res: Response, error: unknown, fallback: string): void {
  if (error instanceof PromotionError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }
  logger.error(`promotions.request_failed: ${(error as Error)?.message}`, { event: 'promotions.request_failed', stack: (error as Error)?.stack });
  res.status(500).json({ error: 'internal_error', message: fallback });
}

/** Le visiteur connecté, s'il l'est — sans jamais refuser la requête (la page de prix est publique). */
async function softUserId(req: Request): Promise<string | null> {
  const token = (req as CustomRequest).cookies?.session;
  if (!token) return null;
  try {
    return (await verifySessionForRequest(req, token)).uid;
  } catch {
    return null;
  }
}

function by(req: Request): string | undefined {
  const value = (req.body?.by ?? req.query.by) as unknown;
  return typeof value === 'string' && value ? value.slice(0, 200) : undefined;
}

export class PromotionController {
  // ── Public ────────────────────────────────────────────────────────────────

  publicList = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = await softUserId(req);
      // Une réponse personnalisée (coupon saisi) ne doit pas être mise en cache partagé.
      res.setHeader('Cache-Control', userId ? 'private, max-age=30' : 'public, max-age=30');
      res.json(await promotionService.publicSnapshot(userId));
    } catch (error) {
      fail(res, error, 'Impossible de charger les promotions.');
    }
  };

  claim = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const result = await promotionService.claim(userId, String(req.body?.code ?? ''));
      await entitlementsService.invalidate(userId);
      res.json({ ok: true, ...result });
    } catch (error) {
      fail(res, error, 'Impossible d’utiliser ce code pour le moment.');
    }
  };

  mine = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const [snapshot, coupons] = await Promise.all([promotionService.publicSnapshot(userId), promotionService.claimsOf(userId)]);
      res.json({ ...snapshot, coupons });
    } catch (error) {
      fail(res, error, 'Impossible de charger vos promotions.');
    }
  };

  // ── Panel admin ───────────────────────────────────────────────────────────

  internalList = async (_req: Request, res: Response): Promise<void> => {
    try {
      const [promotions, overview] = await Promise.all([promotionService.list(), promotionService.overview()]);
      res.json({ promotions, overview, catalog: promotionService.catalog() });
    } catch (error) {
      fail(res, error, 'Impossible de charger les promotions.');
    }
  };

  internalGet = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json(await promotionService.get(String(req.params.id)));
    } catch (error) {
      fail(res, error, 'Impossible de charger la promotion.');
    }
  };

  internalCreate = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(201).json(await promotionService.create(req.body ?? {}, by(req)));
    } catch (error) {
      fail(res, error, 'Création impossible.');
    }
  };

  internalUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json(await promotionService.update(String(req.params.id), req.body ?? {}, by(req)));
    } catch (error) {
      fail(res, error, 'Mise à jour impossible.');
    }
  };

  internalSetState = async (req: Request, res: Response): Promise<void> => {
    try {
      const state = req.body?.state === 'paused' ? 'paused' : 'active';
      res.json(await promotionService.setState(String(req.params.id), state, by(req)));
    } catch (error) {
      fail(res, error, 'Changement d’état impossible.');
    }
  };

  internalEnd = async (req: Request, res: Response): Promise<void> => {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;
      res.json(await promotionService.end(String(req.params.id), by(req), reason));
    } catch (error) {
      fail(res, error, 'Impossible de mettre fin à la promotion.');
    }
  };

  internalDuplicate = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(201).json(await promotionService.duplicate(String(req.params.id), by(req)));
    } catch (error) {
      fail(res, error, 'Duplication impossible.');
    }
  };

  internalRemove = async (req: Request, res: Response): Promise<void> => {
    try {
      await promotionService.remove(String(req.params.id));
      res.status(204).end();
    } catch (error) {
      fail(res, error, 'Suppression impossible.');
    }
  };

  internalQuotaPreset = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json(promotionService.quotaPreset(Number(req.query.times) || 5));
    } catch (error) {
      fail(res, error, 'Calcul impossible.');
    }
  };
}

export const promotionController = new PromotionController();
export default promotionController;
