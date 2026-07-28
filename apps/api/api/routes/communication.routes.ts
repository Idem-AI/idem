import { Router } from 'express';
import {
  createMomentController,
  extractContextController,
  generateCalendarStreamController,
  generateFlyerController,
  generateStrategyStreamController,
  getCommunicationController,
  getFlyerImageController,
  getMomentSuggestionsController,
  preparePublicationController,
  regenerateFlyerController,
  updateCalendarItemController,
  updatePublicationController,
  updateStrategyController,
} from '../controllers/communication.controller';
import { authenticate } from '../services/auth.service';
import { checkPolicyAcceptance } from '../middleware/policyCheck.middleware';
import { checkQuota } from '../middleware/quota.middleware';

export const communicationRoutes = Router();

const resource = 'communication';

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
  regenerateFlyerController
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
