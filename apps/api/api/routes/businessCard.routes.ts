import { Router } from 'express';
import {
  addBusinessCardHolderController,
  aiEditBusinessCardSectionController,
  deleteBusinessCardHolderController,
  generateBusinessCardTemplateController,
  getBusinessCardController,
  renderBusinessCardController,
  saveBusinessCardSectionsController,
  updateBusinessCardHolderController,
} from '../controllers/businessCard.controller';
import { authenticate } from '../services/auth.service';
import { checkQuota } from '../middleware/quota.middleware';

export const businessCardRoutes = Router();

const resourceName = 'business-cards';

/** Génération IA et rendu Chromium dépassent le timeout par défaut. */
const extendedTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(900000); // 15 min — le raisonnement triple la durée d'un appel
  res.setTimeout(900000);
  next();
};

/**
 * @openapi
 * /project/business-cards/{projectId}:
 *   get:
 *     tags: [Business Cards]
 *     summary: Get the business card template and the list of card holders
 *     security: [{ bearerAuth: [] }]
 */
businessCardRoutes.get(`/${resourceName}/:projectId`, authenticate, getBusinessCardController);

/**
 * @openapi
 * /project/business-cards/{projectId}/generate:
 *   post:
 *     tags: [Business Cards]
 *     summary: Generate the AI business card template (front + back) from the brand identity
 *     security: [{ bearerAuth: [] }]
 */
businessCardRoutes.post(
  `/${resourceName}/:projectId/generate`,
  authenticate,
  extendedTimeout,
  checkQuota,
  generateBusinessCardTemplateController
);

/**
 * @openapi
 * /project/business-cards/{projectId}/sections:
 *   put:
 *     tags: [Business Cards]
 *     summary: Save the edited card template (WYSIWYG editor)
 *     security: [{ bearerAuth: [] }]
 */
businessCardRoutes.put(
  `/${resourceName}/:projectId/sections`,
  authenticate,
  saveBusinessCardSectionsController
);

/**
 * @openapi
 * /project/business-cards/{projectId}/sections/{sectionId}/ai-edit:
 *   post:
 *     tags: [Business Cards]
 *     summary: AI-assisted edit of one card face template
 *     security: [{ bearerAuth: [] }]
 */
businessCardRoutes.post(
  `/${resourceName}/:projectId/sections/:sectionId/ai-edit`,
  authenticate,
  extendedTimeout,
  checkQuota,
  aiEditBusinessCardSectionController
);

/**
 * @openapi
 * /project/business-cards/{projectId}/holders:
 *   post:
 *     tags: [Business Cards]
 *     summary: Add a person whose card is derived from the template
 *     security: [{ bearerAuth: [] }]
 */
businessCardRoutes.post(
  `/${resourceName}/:projectId/holders`,
  authenticate,
  addBusinessCardHolderController
);

/**
 * @openapi
 * /project/business-cards/{projectId}/holders/{holderId}:
 *   put:
 *     tags: [Business Cards]
 *     summary: Update a person's card information
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Business Cards]
 *     summary: Remove a person
 *     security: [{ bearerAuth: [] }]
 */
businessCardRoutes.put(
  `/${resourceName}/:projectId/holders/:holderId`,
  authenticate,
  updateBusinessCardHolderController
);
businessCardRoutes.delete(
  `/${resourceName}/:projectId/holders/:holderId`,
  authenticate,
  deleteBusinessCardHolderController
);

/**
 * @openapi
 * /project/business-cards/{projectId}/holders/{holderId}/render:
 *   get:
 *     tags: [Business Cards]
 *     summary: Render one face of a person's card (PNG 300dpi or print-ready PDF)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: side
 *         schema: { type: string, enum: [front, back] }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [png, pdf] }
 */
businessCardRoutes.get(
  `/${resourceName}/:projectId/holders/:holderId/render`,
  authenticate,
  extendedTimeout,
  renderBusinessCardController
);
