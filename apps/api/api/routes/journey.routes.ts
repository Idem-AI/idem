/**
 * LA BOUCLE IDEM — `/journey/*`, appelée par chaque application avec la session de l'utilisateur.
 *
 *   POST /journey/events     un geste vient d'avoir lieu → ses recommandations
 *   GET  /journey/next       les recommandations du moment pour une page
 *   POST /journey/feedback   ce que l'utilisateur en a fait (affichée, suivie, écartée)
 *
 * Aucune donnée libre n'est stockée : types d'événements, applications, destinations et identifiants de
 * règles sont des listes fermées, le projet doit appartenir à l'utilisateur.
 */
import { Response, Router } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { authenticate } from '../services/auth.service';
import { projectService } from '../services/project.service';
import { isDestination, isIdemApp, isJourneyEvent, journeyService } from '../services/journey/journey.service';
import { JOURNEY_RULES } from '../../../../packages/shared-journey/src';

export const journeyRoutes = Router();

const RULE_IDS = new Set(JOURNEY_RULES.map((rule) => rule.id));
const FEEDBACK = new Set(['shown', 'clicked', 'dismissed']);

const limitOf = (value: unknown): number => Math.min(3, Math.max(1, Number(value) || 1));
const projectIdOf = (value: unknown): string | undefined => {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 128 && /^[\w.-]+$/.test(id) ? id : undefined;
};

/**
 * Le projet, s'il est bien celui de l'utilisateur (sinon : traité comme absent). iDeploy web ne connaît que
 * l'application : son projet est retrouvé par la mise en ligne qui l'a créée (`appUuid`).
 */
async function ownedProject(userId: string, value: unknown, appUuid?: unknown): Promise<string | undefined> {
  if (!value && typeof appUuid === 'string' && /^[\w-]{1,64}$/.test(appUuid)) {
    return (await journeyService.projectOfApp(userId, appUuid))?.projectId;
  }
  const projectId = projectIdOf(value);
  if (!projectId) return undefined;
  const project = await projectService.getUserProjectById(userId, projectId).catch(() => null);
  return project ? projectId : undefined;
}

const handle =
  (fn: (req: CustomRequest, res: Response, userId: string) => Promise<void>) =>
  async (req: CustomRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: 'Unauthenticated.' });
      return;
    }
    try {
      await fn(req, res, userId);
    } catch (error: any) {
      logger.error('journey.route_failed', { event: 'journey.route_failed', path: req.path, userId, error: error?.message });
      // Jamais d'erreur bloquante pour un écran : pas de recommandation, c'est tout.
      if (!res.headersSent) res.status(200).json({ recommendations: [] });
    }
  };

journeyRoutes.post(
  '/events',
  authenticate,
  handle(async (req, res, userId) => {
    const { type, app, projectId, appUuid, place, limit } = (req.body ?? {}) as Record<string, unknown>;
    if (!isJourneyEvent(type) || !isIdemApp(app)) {
      res.status(400).json({ message: 'Invalid event.' });
      return;
    }
    const owned = await ownedProject(userId, projectId, appUuid);
    if (!owned && appUuid) {
      res.status(200).json({ recommendations: [] });
      return;
    }
    const recommendations = await journeyService.record(userId, { type, app, projectId: owned, place: isDestination(place) ? place : undefined, limit: limitOf(limit) });
    res.status(200).json({ recommendations });
  })
);

journeyRoutes.get(
  '/next',
  authenticate,
  handle(async (req, res, userId) => {
    const { app, projectId, appUuid, place, limit, ambient } = req.query as Record<string, unknown>;
    if (!isIdemApp(app)) {
      res.status(400).json({ message: 'Invalid app.' });
      return;
    }
    const owned = await ownedProject(userId, projectId, appUuid);
    // Une application sans projet IDEM connu : rien à proposer (jamais une carte sur le mauvais projet).
    if (!owned && appUuid) {
      res.status(200).json({ recommendations: [] });
      return;
    }
    const recommendations = await journeyService.next(userId, {
      app,
      projectId: owned,
      place: isDestination(place) ? place : undefined,
      limit: limitOf(limit),
      ambient: ambient === '1' || ambient === 'true',
    });
    res.status(200).json({ recommendations });
  })
);

journeyRoutes.post(
  '/feedback',
  authenticate,
  handle(async (req, res, userId) => {
    const { id, action } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || !RULE_IDS.has(id) || typeof action !== 'string' || !FEEDBACK.has(action)) {
      res.status(400).json({ message: 'Invalid feedback.' });
      return;
    }
    await journeyService.feedback(userId, id, action as 'shown' | 'clicked' | 'dismissed');
    res.status(204).end();
  })
);
