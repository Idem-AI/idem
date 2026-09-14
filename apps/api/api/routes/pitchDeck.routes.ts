import { Router } from 'express';
import {
  getPitchDeckController,
  deletePitchDeckController,
  generatePitchDeckStreamingController,
  generatePitchDeckPdfController,
  savePitchDeckSectionsController,
  aiEditPitchDeckSectionController,
  getPitchDeckTypesController,
  listPitchDeckDocumentsController,
  createPitchDeckDocumentController,
  renamePitchDeckDocumentController,
  deletePitchDeckDocumentController,
} from '../controllers/pitchDeck.controller';
import { authenticate } from '../services/auth.service';
import { checkQuota } from '../middleware/quota.middleware';
import { checkPolicyAcceptance } from '../middleware/policyCheck.middleware';

export const pitchDeckRoutes = Router();
const resourceName = 'pitchDecks';

const pdfTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(900000); // 15 min — le raisonnement triple la durée d'un appel
  res.setTimeout(900000);
  next();
};

/*
 * Un projet garde PLUSIEURS decks (levée, banque, présentation commerciale…).
 * Les routes par projet acceptent `?documentId=` pour désigner le deck ; sans
 * lui, elles agissent sur le deck le plus récemment modifié.
 */

/**
 * @openapi
 * /pitchDecks/generate/{projectId}:
 *   get:
 *     tags:
 *       - Pitch Deck
 *     summary: Generate a pitch deck with real-time streaming (SSE)
 *     description: >
 *       Generates the slides of the deck designated by `documentId`. Without it, the
 *       most recently updated deck is used, and a project with no deck gets an
 *       investor deck.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: documentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sections
 *         description: Comma-separated slide names to regenerate.
 *         schema:
 *           type: string
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
 * /pitchDecks/types:
 *   get:
 *     tags:
 *       - Pitch Deck
 *     summary: List the available pitch deck types
 *     description: >
 *       Investor, bank, sales, partnership, competition and elevator decks, each with
 *       its ordered slides and typical speaking time. Labels are i18n keys resolved by
 *       the client.
 *     security:
 *       - bearerAuth: []
 */
pitchDeckRoutes.get(`/${resourceName}/types`, authenticate, getPitchDeckTypesController);

/**
 * @openapi
 * /pitchDecks/{projectId}/documents:
 *   get:
 *     tags:
 *       - Pitch Deck
 *     summary: List the pitch decks of a project (summaries, without slide HTML)
 *     security:
 *       - bearerAuth: []
 *   post:
 *     tags:
 *       - Pitch Deck
 *     summary: Create an empty pitch deck of a given type
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *               name:
 *                 type: string
 */
pitchDeckRoutes.get(
  `/${resourceName}/:projectId/documents`,
  authenticate,
  listPitchDeckDocumentsController
);
pitchDeckRoutes.post(
  `/${resourceName}/:projectId/documents`,
  authenticate,
  createPitchDeckDocumentController
);

/**
 * @openapi
 * /pitchDecks/{projectId}/documents/{documentId}:
 *   patch:
 *     tags:
 *       - Pitch Deck
 *     summary: Rename a pitch deck
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     tags:
 *       - Pitch Deck
 *     summary: Delete a pitch deck
 *     security:
 *       - bearerAuth: []
 */
pitchDeckRoutes.patch(
  `/${resourceName}/:projectId/documents/:documentId`,
  authenticate,
  renamePitchDeckDocumentController
);
pitchDeckRoutes.delete(
  `/${resourceName}/:projectId/documents/:documentId`,
  authenticate,
  deletePitchDeckDocumentController
);

/**
 * @openapi
 * /pitchDecks/{projectId}:
 *   get:
 *     tags:
 *       - Pitch Deck
 *     summary: Retrieve a pitch deck of a project (`documentId` query, primary deck by default)
 */
pitchDeckRoutes.get(`/${resourceName}/:projectId`, authenticate, getPitchDeckController);

/**
 * @openapi
 * /pitchDecks/{projectId}:
 *   delete:
 *     tags:
 *       - Pitch Deck
 *     summary: Delete the pitch deck designated by the required `documentId` query
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
 *     summary: Download a pitch deck as 16:9 PDF (`documentId` query, primary deck by default)
 */
pitchDeckRoutes.get(
  `/${resourceName}/pdf/:projectId`,
  authenticate,
  pdfTimeout,
  generatePitchDeckPdfController
);
