import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import {
  appendAISuggestionsController,
  deleteFinanceController,
  getFinanceController,
  getFinanceSummaryController,
  recomputeFinanceController,
  replaceFinanceController,
  simulateFinanceController,
  updateFinanceSectionController,
} from '../controllers/finance.controller';

export const financeRoutes = Router();

const resource = 'finance';

/**
 * @openapi
 * /project/finance/{projectId}:
 *   get:
 *     tags: [Finance]
 *     summary: Récupère le modèle Finance complet d'un projet (avec snapshot calculé)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: FinanceModel }
 *       '404': { description: Not found }
 */
financeRoutes.get(`/${resource}/:projectId`, authenticate, getFinanceController);

/**
 * @openapi
 * /project/finance/{projectId}/summary:
 *   get:
 *     tags: [Finance]
 *     summary: Résumé synthétique pour le dashboard et le business advisor
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.get(
  `/${resource}/:projectId/summary`,
  authenticate,
  getFinanceSummaryController
);

/**
 * @openapi
 * /project/finance/{projectId}:
 *   put:
 *     tags: [Finance]
 *     summary: Remplace l'intégralité du modèle Finance (auto-fill global IA)
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.put(`/${resource}/:projectId`, authenticate, replaceFinanceController);

/**
 * @openapi
 * /project/finance/{projectId}/section/{section}:
 *   patch:
 *     tags: [Finance]
 *     summary: Met à jour une section précise (products, salesObjectives, ...)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: section
 *         required: true
 *         schema:
 *           type: string
 *           enum: [products, salesObjectives, revenueParams, variableCharges, fixedCharges, taxesParams, investments, financing, ratiosParams]
 */
financeRoutes.patch(
  `/${resource}/:projectId/section/:section`,
  authenticate,
  updateFinanceSectionController
);

/**
 * @openapi
 * /project/finance/{projectId}/ai-suggestions:
 *   post:
 *     tags: [Finance]
 *     summary: Ajoute des justifications IA (issues d'un auto-fill)
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.post(
  `/${resource}/:projectId/ai-suggestions`,
  authenticate,
  appendAISuggestionsController
);

/**
 * @openapi
 * /project/finance/{projectId}/recompute:
 *   post:
 *     tags: [Finance]
 *     summary: Force un recalcul complet des sorties financières
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.post(
  `/${resource}/:projectId/recompute`,
  authenticate,
  recomputeFinanceController
);

/**
 * @openapi
 * /project/finance/simulate:
 *   post:
 *     tags: [Finance]
 *     summary: Simule les calculs sans persistance (preview temps réel)
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.post(`/${resource}/simulate`, authenticate, simulateFinanceController);

/**
 * @openapi
 * /project/finance/{projectId}:
 *   delete:
 *     tags: [Finance]
 *     summary: Supprime le module Finance d'un projet
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.delete(`/${resource}/:projectId`, authenticate, deleteFinanceController);
