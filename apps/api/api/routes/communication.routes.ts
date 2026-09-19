import { Router } from 'express';
import {
  addPlanItemController,
  aiEditFlyerController,
  archivePlanController,
  clearStudioController,
  createMomentController,
  createPlanController,
  createVisualController,
  declinateVisualController,
  extractContextController,
  generateCalendarStreamController,
  generateFlyerController,
  generatePlanStreamController,
  generateStrategyStreamController,
  getCommunicationController,
  getFlyerImageController,
  getMomentSuggestionsController,
  getOccasionsController,
  getStudioController,
  getVisualController,
  listPlansController,
  listVisualsController,
  preparePublicationController,
  regenerateFlyerController,
  removePlanItemController,
  saveFlyerHtmlController,
  scheduleVisualController,
  studioMessageController,
  updateCalendarItemController,
  updatePlanController,
  updatePlanItemController,
  updatePublicationController,
  updateStrategyController,
} from '../controllers/communication.controller';
import { authenticate } from '../services/auth.service';
import { checkPolicyAcceptance } from '../middleware/policyCheck.middleware';
import { checkQuota } from '../middleware/quota.middleware';
import {
  creditCost,
  firstThenRevision,
  planScope,
  requireCredits,
} from '../middleware/billing.middleware';

export const communicationRoutes = Router();

const resource = 'communication';

/** La retouche IA d'un visuel (HTML complet) dépasse le timeout par défaut. */
const extendedTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(900000); // 15 min — le raisonnement triple la durée d'un appel
  res.setTimeout(900000);
  next();
};

/**
 * @openapi
 * /project/communication/{projectId}:
 *   get:
 *     tags: [Communication]
 *     summary: Retrieve the full communication bundle (context, strategy, calendar, flyers, trends).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Communication bundle. }
 *       401: { description: Unauthorized. }
 */
communicationRoutes.get(`/${resource}/:projectId`, authenticate, getCommunicationController);

/**
 * @openapi
 * /project/communication/{projectId}/extract-context:
 *   post:
 *     tags: [Communication]
 *     summary: Extract (or refresh) the structured communication context for a project.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: force
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Extracted context. }
 */
communicationRoutes.post(
  `/${resource}/:projectId/extract-context`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  // Préparation interne, facturée au prix d'une révision.
  requireCredits('business', 'revision'),
  extractContextController
);

/**
 * @openapi
 * /project/communication/{projectId}/generate-strategy:
 *   get:
 *     tags: [Communication]
 *     summary: Stream the generation of the communication strategy (Server-Sent Events).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: force
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: SSE stream.
 *         content:
 *           text/event-stream: { schema: { type: string } }
 */
communicationRoutes.get(
  `/${resource}/:projectId/generate-strategy`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  // Stratégie de communication complète : 40 crédits au barème.
  requireCredits('business', 'communication_strategy', {
    resolve: firstThenRevision('business', 'communication_strategy', 'revision'),
  }),
  generateStrategyStreamController
);

/**
 * @openapi
 * /project/communication/{projectId}/generate-calendar:
 *   get:
 *     tags: [Communication]
 *     summary: Stream the generation of the editorial calendar (Server-Sent Events).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: rhythm
 *         schema: { type: string, enum: [weekly, biweekly, monthly] }
 *       - in: query
 *         name: horizonWeeks
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *       - in: query
 *         name: force
 *         schema: { type: boolean }
 */
communicationRoutes.get(
  `/${resource}/:projectId/generate-calendar`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  // Calendrier éditorial mensuel : 15 crédits.
  requireCredits('business', 'editorial_calendar', {
    resolve: firstThenRevision('business', 'editorial_calendar', 'revision'),
  }),
  generateCalendarStreamController
);

/**
 * @openapi
 * /project/communication/{projectId}/strategy:
 *   put:
 *     tags: [Communication]
 *     summary: Replace the current strategy blocks (editable blocks from the UI).
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.put(
  `/${resource}/:projectId/strategy`,
  authenticate,
  updateStrategyController
);

/**
 * @openapi
 * /project/communication/{projectId}/calendar/{contentId}:
 *   put:
 *     tags: [Communication]
 *     summary: Patch a single content idea inside the calendar.
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.put(
  `/${resource}/:projectId/calendar/:contentId`,
  authenticate,
  updateCalendarItemController
);

/**
 * @openapi
 * /project/communication/{projectId}/moments/suggestions:
 *   get:
 *     tags: [Communication]
 *     summary: Suggest upcoming timely occasions (holidays, hiring, promos…) for the brand.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: force
 *         schema: { type: boolean }
 */
communicationRoutes.get(
  `/${resource}/:projectId/moments/suggestions`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  requireCredits('business', 'revision'),
  getMomentSuggestionsController
);

/**
 * @openapi
 * /project/communication/{projectId}/moments:
 *   post:
 *     tags: [Communication]
 *     summary: Create a one-off "moment" (occasion-driven content) with a publishable caption.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [occasion]
 *             properties:
 *               occasion: { type: string }
 *               occasionDate: { type: string }
 *               message: { type: string }
 *               intent: { type: string }
 *               channel: { type: string }
 *               source: { type: string, enum: [suggestion, custom] }
 */
communicationRoutes.post(
  `/${resource}/:projectId/moments`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  requireCredits('business', 'revision'),
  createMomentController
);

/**
 * @openapi
 * /project/communication/{projectId}/flyer/{contentId}:
 *   post:
 *     tags: [Communication]
 *     summary: Generate a flyer ON DEMAND for one selected content idea.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [square, story, banner, post, a4]
 *               force:
 *                 type: boolean
 */
communicationRoutes.post(
  `/${resource}/:projectId/flyer/:contentId`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  // 2 crédits : le flyer repose sur un moteur de templates, pas sur une
  // génération d'image — c'est ce qui permet un visuel à 40 F.
  requireCredits('business', 'flyer'),
  generateFlyerController
);

/**
 * @openapi
 * /project/communication/{projectId}/flyer/{flyerId}/image:
 *   get:
 *     tags: [Communication]
 *     summary: Force regeneration of the flyer for one selected content idea.
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.post(
  `/${resource}/:projectId/flyer/:contentId/regenerate`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  requireCredits('business', 'flyer'),
  regenerateFlyerController
);

/**
 * @openapi
 * /project/communication/{projectId}/flyer/{flyerId}/html:
 *   put:
 *     tags: [Communication]
 *     summary: Save the flyer HTML edited in the WYSIWYG editor.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [html]
 *             properties:
 *               html: { type: string }
 */
communicationRoutes.put(
  `/${resource}/:projectId/flyer/:flyerId/html`,
  authenticate,
  saveFlyerHtmlController
);

/**
 * @openapi
 * /project/communication/{projectId}/flyer/{flyerId}/ai-edit:
 *   post:
 *     tags: [Communication]
 *     summary: AI-assisted retouch of one flyer, from a natural-language instruction.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [instruction]
 *             properties:
 *               instruction: { type: string }
 */
communicationRoutes.post(
  `/${resource}/:projectId/flyer/:flyerId/ai-edit`,
  authenticate,
  extendedTimeout,
  checkPolicyAcceptance,
  checkQuota,
  requireCredits('business', 'revision'),
  aiEditFlyerController
);

/**
 * @openapi
 * /project/communication/{projectId}/publish:
 *   post:
 *     tags: [Communication]
 *     summary: Prepare an assisted publication (caption + visual + composer deep link) and queue it.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentId, network]
 *             properties:
 *               contentId: { type: string }
 *               network: { type: string, enum: [linkedin, x] }
 *               flyerId: { type: string }
 *               scheduledFor: { type: string }
 */
communicationRoutes.post(
  `/${resource}/:projectId/publish`,
  authenticate,
  preparePublicationController
);

/**
 * @openapi
 * /project/communication/{projectId}/publish/{publicationId}:
 *   put:
 *     tags: [Communication]
 *     summary: Update a queued publication (schedule, mark as published, set external url).
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.put(
  `/${resource}/:projectId/publish/:publicationId`,
  authenticate,
  updatePublicationController
);

/**
 * @openapi
 * /project/communication/{projectId}/flyer/{flyerId}/image:
 *   get:
 *     tags: [Communication]
 *     summary: Fetch the rendered flyer image directly as a PNG.
 */
communicationRoutes.get(
  `/${resource}/:projectId/flyer/:flyerId/image`,
  getFlyerImageController
);

// ===========================================================================
// PÉRIODES
// ===========================================================================

/**
 * @openapi
 * /project/communication/{projectId}/plans:
 *   get:
 *     tags: [Communication]
 *     summary: List the communication periods of a project (active first).
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.get(`/${resource}/:projectId/plans`, authenticate, listPlansController);

/**
 * @openapi
 * /project/communication/{projectId}/plans:
 *   post:
 *     tags: [Communication]
 *     summary: Create an EMPTY period. No AI, no credit — generation is a separate, explicit step.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start, end]
 *             properties:
 *               name: { type: string }
 *               objective: { type: string }
 *               start: { type: string, format: date }
 *               end: { type: string, format: date }
 *               kind: { type: string, enum: [regular, campaign] }
 *               postsPerWeek: { type: integer, minimum: 1, maximum: 7 }
 *               channels: { type: array, items: { type: string } }
 */
communicationRoutes.post(
  `/${resource}/:projectId/plans`,
  authenticate,
  checkPolicyAcceptance,
  createPlanController
);

/**
 * @openapi
 * /project/communication/{projectId}/plans/{planId}/generate:
 *   get:
 *     tags: [Communication]
 *     summary: Stream the generation of a period — its editorial brief then its dated contents (SSE).
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.get(
  `/${resource}/:projectId/plans/:planId/generate`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  // Une période NEUVE est un livrable neuf : la portée `planScope` évite que la
  // deuxième et les suivantes tombent au tarif « révision » — douze mois de
  // planification pour 26 crédits, ce que faisait la portée par projet.
  requireCredits('business', 'communication_plan', {
    resolve: firstThenRevision('business', 'communication_plan', 'revision', planScope),
    element: planScope,
  }),
  generatePlanStreamController
);

/**
 * @openapi
 * /project/communication/{projectId}/plans/{planId}:
 *   put:
 *     tags: [Communication]
 *     summary: Rename, re-date, re-cadence or change the status of a period.
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Communication]
 *     summary: Archive a period (never a hard delete — visuals stay attached to it).
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.put(`/${resource}/:projectId/plans/:planId`, authenticate, updatePlanController);
communicationRoutes.delete(
  `/${resource}/:projectId/plans/:planId`,
  authenticate,
  archivePlanController
);

/**
 * @openapi
 * /project/communication/{projectId}/plans/{planId}/items:
 *   post:
 *     tags: [Communication]
 *     summary: Add one content to a period by hand (no AI).
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.post(
  `/${resource}/:projectId/plans/:planId/items`,
  authenticate,
  addPlanItemController
);

/**
 * @openapi
 * /project/communication/{projectId}/plans/{planId}/items/{itemId}:
 *   put:
 *     tags: [Communication]
 *     summary: Patch one content of a period (date, channel, status, caption…).
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Communication]
 *     summary: Remove one content from a period.
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.put(
  `/${resource}/:projectId/plans/:planId/items/:itemId`,
  authenticate,
  updatePlanItemController
);
communicationRoutes.delete(
  `/${resource}/:projectId/plans/:planId/items/:itemId`,
  authenticate,
  removePlanItemController
);

/**
 * @openapi
 * /project/communication/{projectId}/occasions:
 *   get:
 *     tags: [Communication]
 *     summary: Occasions (holidays, awareness days, commercial seasons) falling inside a date window.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date }
 */
communicationRoutes.get(
  `/${resource}/:projectId/occasions`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  // Une liste d'occasions sert à DÉCIDER d'une période, avant tout achat : la
  // faire payer découragerait exactement l'étape qu'on veut encourager. Le cache
  // par pays et par fenêtre en fait un appel rare.
  getOccasionsController
);

// ===========================================================================
// BIBLIOTHÈQUE DE VISUELS
// ===========================================================================

/**
 * @openapi
 * /project/communication/{projectId}/visuals:
 *   get:
 *     tags: [Communication]
 *     summary: All the visuals of a project, WITHOUT their HTML (filters: planId, format, origin).
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Communication]
 *     summary: Compose a free visual from a natural-language brief — no calendar entry required.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [brief]
 *             properties:
 *               brief: { type: string }
 *               format: { type: string, enum: [square, story, banner, post, a4] }
 *               intent: { type: string }
 *               withPhoto: { type: boolean }
 *               variants: { type: integer, minimum: 1, maximum: 3 }
 */
communicationRoutes.get(`/${resource}/:projectId/visuals`, authenticate, listVisualsController);
communicationRoutes.post(
  `/${resource}/:projectId/visuals`,
  authenticate,
  extendedTimeout,
  checkPolicyAcceptance,
  checkQuota,
  // Trois variantes du même brief coûtent le prix d'un carrousel plutôt que
  // trois visuels : explorer doit rester moins cher que recommencer.
  requireCredits('business', 'flyer', {
    resolve: async (req) => {
      const variants = Math.min(3, Math.max(1, Number(req.body?.variants) || 1));
      // Le prix vient du barème, jamais d'un nombre recopié ici : un tarif ajusté
      // dans `BUSINESS_CREDIT_COSTS` doit valoir pour toutes les routes.
      const action = variants > 1 ? 'carousel' : 'flyer';
      return { action, cost: creditCost('business', action) };
    },
  }),
  createVisualController
);

/**
 * @openapi
 * /project/communication/{projectId}/visuals/{visualId}:
 *   get:
 *     tags: [Communication]
 *     summary: One visual, HTML included — for the editor and the renderer.
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.get(
  `/${resource}/:projectId/visuals/:visualId`,
  authenticate,
  getVisualController
);

/**
 * @openapi
 * /project/communication/{projectId}/visuals/{visualId}/declinate:
 *   post:
 *     tags: [Communication]
 *     summary: Recompose an existing visual in other formats, reusing its copy.
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.post(
  `/${resource}/:projectId/visuals/:visualId/declinate`,
  authenticate,
  extendedTimeout,
  checkPolicyAcceptance,
  checkQuota,
  // Une déclinaison reprend la copie déjà écrite : c'est une révision par
  // format, pas un visuel neuf.
  requireCredits('business', 'revision', {
    resolve: async (req) => {
      const formats = Array.isArray(req.body?.formats) ? req.body.formats.length : 1;
      return {
        action: 'revision',
        cost: creditCost('business', 'revision') * Math.max(1, Math.min(4, formats)),
      };
    },
  }),
  declinateVisualController
);

/**
 * @openapi
 * /project/communication/{projectId}/visuals/{visualId}/schedule:
 *   post:
 *     tags: [Communication]
 *     summary: File a visual into a period at a given date (creates the owning content if needed).
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.post(
  `/${resource}/:projectId/visuals/:visualId/schedule`,
  authenticate,
  scheduleVisualController
);

// ===========================================================================
// ATELIER
// ===========================================================================

/**
 * @openapi
 * /project/communication/{projectId}/studio:
 *   get:
 *     tags: [Communication]
 *     summary: The studio conversation of a project.
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Communication]
 *     summary: Clear the studio conversation (the visuals it produced are kept).
 *     security: [{ bearerAuth: [] }]
 */
communicationRoutes.get(`/${resource}/:projectId/studio`, authenticate, getStudioController);
communicationRoutes.delete(`/${resource}/:projectId/studio`, authenticate, clearStudioController);

/**
 * @openapi
 * /project/communication/{projectId}/studio/message:
 *   post:
 *     tags: [Communication]
 *     summary: One turn of studio conversation (SSE). May produce visuals.
 *     description: >
 *       Credits are charged per TOOL the agent calls, not per request — talking is
 *       free, producing a visual is not. A refusal for lack of credits therefore
 *       travels inside the stream as an `error` event with code `payment_required`,
 *       since the SSE headers are already sent by then.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 */
communicationRoutes.post(
  `/${resource}/:projectId/studio/message`,
  authenticate,
  extendedTimeout,
  checkPolicyAcceptance,
  checkQuota,
  studioMessageController
);
