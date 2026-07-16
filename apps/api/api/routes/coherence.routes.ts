import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import {
  listCoherenceAlertsController,
  runCoherenceCheckController,
  applyCoherenceProposalController,
  dismissCoherenceAlertController,
} from '../controllers/coherence.controller';

/**
 * Coherence Guard — synchronisation intelligente entre artefacts (business
 * plan ↔ finance, …). Détection automatique à chaque modification, application
 * explicite par l'utilisateur.
 *
 * NOTE: le chemin contient "/coherence/" — le hook Chronicle s'en sert comme
 * garde anti-boucle (les écritures issues d'un apply ne redéclenchent pas
 * d'audit).
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
coherenceRoutes.post('/coherence/:projectId/check', authenticate, runCoherenceCheckController);

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
