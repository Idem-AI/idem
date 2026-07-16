import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import {
  getProjectMapController,
  getSectionController,
  searchProjectController,
  getHistoryLogController,
  getVersionController,
  getDiffController,
  getStateAtDateController,
  restoreVersionController,
} from '../controllers/context.controller';

/**
 * Context Engine + Chronicle (historique versionné) — API REST.
 * Consommée par le dashboard (timeline de versions, restauration) et par les
 * autres apps IDEM qui veulent la même vue projet que les agents IA.
 */
export const contextRoutes = Router();

/**
 * @openapi
 * /project/context/{projectId}/map:
 *   get:
 *     tags: [Context Engine]
 *     summary: Carte compacte du projet (sections, versions, dernières modifications)
 *     security:
 *       - bearerAuth: []
 */
contextRoutes.get('/context/:projectId/map', authenticate, getProjectMapController);

/**
 * @openapi
 * /project/context/{projectId}/section/{section}:
 *   get:
 *     tags: [Context Engine]
 *     summary: Contenu d'une section (résumé ou intégral, sous-chemin optionnel)
 *     security:
 *       - bearerAuth: []
 */
contextRoutes.get('/context/:projectId/section/:section', authenticate, getSectionController);

/**
 * @openapi
 * /project/context/{projectId}/search:
 *   get:
 *     tags: [Context Engine]
 *     summary: Recherche plein-texte dans toutes les sections du projet
 *     security:
 *       - bearerAuth: []
 */
contextRoutes.get('/context/:projectId/search', authenticate, searchProjectController);

/**
 * @openapi
 * /project/history/{projectId}:
 *   get:
 *     tags: [Chronicle]
 *     summary: Journal des révisions du projet (git log), filtrable par section
 *     security:
 *       - bearerAuth: []
 */
contextRoutes.get('/history/:projectId', authenticate, getHistoryLogController);

/**
 * @openapi
 * /project/history/{projectId}/{section}/version/{version}:
 *   get:
 *     tags: [Chronicle]
 *     summary: État d'une section à une version donnée (git show)
 *     security:
 *       - bearerAuth: []
 */
contextRoutes.get(
  '/history/:projectId/:section/version/:version',
  authenticate,
  getVersionController
);

/**
 * @openapi
 * /project/history/{projectId}/{section}/diff:
 *   get:
 *     tags: [Chronicle]
 *     summary: Diff entre deux versions d'une section (git diff)
 *     security:
 *       - bearerAuth: []
 */
contextRoutes.get('/history/:projectId/:section/diff', authenticate, getDiffController);

/**
 * @openapi
 * /project/history/{projectId}/{section}/at:
 *   get:
 *     tags: [Chronicle]
 *     summary: État d'une section à une date donnée (checkout temporel)
 *     security:
 *       - bearerAuth: []
 */
contextRoutes.get('/history/:projectId/:section/at', authenticate, getStateAtDateController);

/**
 * @openapi
 * /project/history/{projectId}/{section}/restore:
 *   post:
 *     tags: [Chronicle]
 *     summary: Restaure une section à une version antérieure (nouvelle révision, historique intact)
 *     security:
 *       - bearerAuth: []
 */
contextRoutes.post(
  '/history/:projectId/:section/restore',
  authenticate,
  restoreVersionController
);
