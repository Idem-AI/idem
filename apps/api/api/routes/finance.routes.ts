import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import {
  aiFillAllController,
  aiFillAllStreamController,
  aiFillSectionController,
  applyChatIntentController,
  appendAISuggestionsController,
  deleteFinanceController,
  generateFinancePdfController,
  getFinanceController,
  getFinanceSummaryController,
  parseChatIntentController,
  recomputeFinanceController,
  replaceFinanceController,
  simulateFinanceController,
  updateFinanceSectionController,
} from '../controllers/finance.controller';
import { checkQuota } from '../middleware/quota.middleware';
import { checkPolicyAcceptance } from '../middleware/policyCheck.middleware';

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
financeRoutes.get(`/${resource}/:projectId/summary`, authenticate, getFinanceSummaryController);

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
financeRoutes.post(`/${resource}/:projectId/recompute`, authenticate, recomputeFinanceController);

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

// =====================================================================
// IA — auto-fill + chat conversationnel
// =====================================================================

/**
 * @openapi
 * /project/finance/{projectId}/ai-fill-all:
 *   post:
 *     tags: [Finance]
 *     summary: Auto-fill IA global de toutes les sections cohérentes ensemble
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.post(
  `/${resource}/:projectId/ai-fill-all`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  aiFillAllController
);

/**
 * @openapi
 * /project/finance/{projectId}/ai-fill-stream:
 *   get:
 *     tags: [Finance]
 *     summary: Auto-fill IA global SOURCÉ en streaming (SSE) — équipe d'agents de recherche
 *     description: Diffuse en temps réel l'activité des agents (recherche web sourcée) puis cale les prévisions financières sur les benchmarks réels collectés.
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.get(
  `/${resource}/:projectId/ai-fill-stream`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  aiFillAllStreamController
);

/**
 * @openapi
 * /project/finance/{projectId}/ai-fill/{section}:
 *   post:
 *     tags: [Finance]
 *     summary: Auto-fill IA d'une section précise
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.post(
  `/${resource}/:projectId/ai-fill/:section`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  aiFillSectionController
);

/**
 * @openapi
 * /project/finance/{projectId}/chat/parse:
 *   post:
 *     tags: [Finance]
 *     summary: Parse une intention finance depuis un message utilisateur (sans appliquer)
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.post(
  `/${resource}/:projectId/chat/parse`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  parseChatIntentController
);

/**
 * @openapi
 * /project/finance/{projectId}/chat/apply:
 *   post:
 *     tags: [Finance]
 *     summary: Applique une intention de modification précédemment confirmée
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.post(`/${resource}/:projectId/chat/apply`, authenticate, applyChatIntentController);

// =====================================================================
// Rapport PDF
// =====================================================================

const pdfTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(180000);
  res.setTimeout(180000);
  next();
};

/**
 * @openapi
 * /project/finance/{projectId}/pdf:
 *   get:
 *     tags: [Finance]
 *     summary: Génère et télécharge le rapport financier PDF complet
 *     security: [{ bearerAuth: [] }]
 */
financeRoutes.get(
  `/${resource}/:projectId/pdf`,
  authenticate,
  pdfTimeout,
  generateFinancePdfController
);
