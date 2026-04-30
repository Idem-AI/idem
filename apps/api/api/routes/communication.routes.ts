import { Router } from 'express';
import {
  extractContextController,
  generateCalendarStreamController,
  generateFlyerController,
  generateStrategyStreamController,
  getCommunicationController,
  regenerateFlyerController,
  updateCalendarItemController,
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
 * /project/communication/{projectId}/flyer/{contentId}/regenerate:
 *   post:
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
