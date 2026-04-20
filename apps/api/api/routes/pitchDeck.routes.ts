import { Router } from 'express';
import {
  getPitchDeckController,
  deletePitchDeckController,
  generatePitchDeckStreamingController,
  generatePitchDeckPdfController,
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
