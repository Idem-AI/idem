import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import { rateLimitByEndpoint } from '../middleware/rate-limit.middleware';
import {
  listCoherenceAlertsController,
  runCoherenceCheckController,
  applyCoherenceProposalController,
  dismissCoherenceAlertController,
} from '../controllers/coherence.controller';

/**
 * Coherence Guard — synchronisation intelligente entre artefacts (business
 * plan ↔ finance, …). Détection automatique à chaque modification, application
 * explicite par l'utilisateur (le hook Chronicle reconnaît une écriture issue
 * d'un apply via un flag explicite posé par CoherenceService, pas via ce
 * chemin d'URL — voir utils/revision-context.util.ts).
 */
export const coherenceRoutes = Router();

/**
 * @openapi
 * /project/coherence/{projectId}:
 *   get:
 *     tags: [Coherence Guard]
 *     summary: Alertes de cohérence du projet (ouvertes par défaut, ?status= pour filtrer)
 *     security:
 *       - bearerAuth: []
 */
coherenceRoutes.get('/coherence/:projectId', authenticate, listCoherenceAlertsController);

/**
 * @openapi
 * /project/coherence/{projectId}/check:
 *   post:
 *     tags: [Coherence Guard]
 *     summary: Force un audit de cohérence immédiat (toutes règles ou ruleId précis)
 *     security:
 *       - bearerAuth: []
 */
coherenceRoutes.post(
  '/coherence/:projectId/check',
  authenticate,
  // Cette route appelle le LLM avec skipQuotaCheck (audit système, pas de coût
  // pour le quota utilisateur) — sans limite dédiée, un appel répété martelé
  // devient un vecteur d'appels Gemini gratuits illimités pour la plateforme.
  rateLimitByEndpoint('coherence-check', { windowMs: 60_000, maxRequests: 5 }),
  runCoherenceCheckController
);

/**
 * @openapi
 * /project/coherence/{projectId}/{alertId}/apply:
 *   post:
 *     tags: [Coherence Guard]
 *     summary: Applique une proposition de synchronisation (ex. autofill finance depuis le BP)
 *     security:
 *       - bearerAuth: []
 */
coherenceRoutes.post(
  '/coherence/:projectId/:alertId/apply',
  authenticate,
  applyCoherenceProposalController
);

/**
 * @openapi
 * /project/coherence/{projectId}/{alertId}/dismiss:
 *   post:
 *     tags: [Coherence Guard]
 *     summary: Rejette une alerte de cohérence
 *     security:
 *       - bearerAuth: []
 */
coherenceRoutes.post(
  '/coherence/:projectId/:alertId/dismiss',
  authenticate,
  dismissCoherenceAlertController
);
