import { Router } from 'express';
import {
  getPitchDeckController,
  deletePitchDeckController,
  generatePitchDeckStreamingController,
  generatePitchDeckPdfController,
  savePitchDeckSectionsController,
  aiEditPitchDeckSectionController,
} from '../controllers/pitchDeck.controller';
import { authenticate } from '../services/auth.service';
import { checkQuota } from '../middleware/quota.middleware';
import { checkPolicyAcceptance } from '../middleware/policyCheck.middleware';

export const pitchDeckRoutes = Router();
const resourceName = 'pitchDecks';

const pdfTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(180000);
  res.setTimeout(180000);
  next();
};

/**
 * @openapi
 * /pitchDecks/generate/{projectId}:
 *   get:
 *     tags:
 *       - Pitch Deck
 *     summary: Generate a pitch deck with real-time streaming (SSE)
 *     security:
 *       - bearerAuth: []
 */
pitchDeckRoutes.get(
  `/${resourceName}/generate/:projectId`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  generatePitchDeckStreamingController
);

/**
 * @openapi
 * /pitchDecks/{projectId}:
 *   get:
 *     tags:
 *       - Pitch Deck
 *     summary: Retrieve pitch deck for a project
 */
pitchDeckRoutes.get(`/${resourceName}/:projectId`, authenticate, getPitchDeckController);

/**
 * @openapi
 * /pitchDecks/{projectId}:
 *   delete:
 *     tags:
 *       - Pitch Deck
 *     summary: Delete pitch deck for a project
 */
pitchDeckRoutes.delete(`/${resourceName}/:projectId`, authenticate, deletePitchDeckController);

/**
 * @openapi
 * /pitchDecks/{projectId}/sections:
 *   put:
 *     tags: [Pitch Deck]
 *     summary: Save edited pitch deck slides (WYSIWYG editor)
 *     security: [{ bearerAuth: [] }]
 */
pitchDeckRoutes.put(
  `/${resourceName}/:projectId/sections`,
  authenticate,
  savePitchDeckSectionsController
);

/**
 * @openapi
 * /pitchDecks/{projectId}/sections/{sectionId}/ai-edit:
 *   post:
 *     tags: [Pitch Deck]
 *     summary: AI-assisted edit of a single pitch deck slide
 *     security: [{ bearerAuth: [] }]
 */
pitchDeckRoutes.post(
  `/${resourceName}/:projectId/sections/:sectionId/ai-edit`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  aiEditPitchDeckSectionController
);

/**
 * @openapi
 * /pitchDecks/pdf/{projectId}:
 *   get:
 *     tags:
 *       - Pitch Deck
 *     summary: Download pitch deck as 16:9 PDF
 */
pitchDeckRoutes.get(
  `/${resourceName}/pdf/:projectId`,
  authenticate,
  pdfTimeout,
  generatePitchDeckPdfController
);
