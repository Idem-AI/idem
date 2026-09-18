import { Router } from 'express';
import {
  getLegalDocsCatalogController,
  getLegalDocsController,
  getLegalDocsRequirementsController,
  deleteLegalDocController,
  clearLegalDocsController,
  generateLegalDocsStreamingController,
  generateLegalDocPdfController,
} from '../controllers/legalDocs.controller';
import { authenticate } from '../services/auth.service';
import { checkQuota } from '../middleware/quota.middleware';
import { checkPolicyAcceptance } from '../middleware/policyCheck.middleware';
import { firstThenRevision, requireCredits } from '../middleware/billing.middleware';

export const legalDocsRoutes = Router();
const resourceName = 'legalDocs';

const pdfTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(180000);
  res.setTimeout(180000);
  next();
};

/** Public catalog (requires auth but no project) */
legalDocsRoutes.get(`/${resourceName}/catalog`, authenticate, getLegalDocsCatalogController);

/** Required fields for a selection of types: /legalDocs/requirements?types=cgu,cgv */
legalDocsRoutes.get(
  `/${resourceName}/requirements`,
  authenticate,
  getLegalDocsRequirementsController
);

/** Generate legal documents with streaming (POST body or GET query params ?types=...&context=base64json) */
/**
 * Le modèle économique facture le **kit** OHADA (65 crédits), pas chaque
 * document : une fois le kit payé sur un projet, régénérer une pièce vaut une
 * révision.
 */
const chargeLegalKit = requireCredits('business', 'legal_kit', {
  resolve: firstThenRevision('business', 'legal_kit', 'revision'),
});

legalDocsRoutes.post(
  `/${resourceName}/generate/:projectId`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  chargeLegalKit,
  generateLegalDocsStreamingController
);

legalDocsRoutes.get(
  `/${resourceName}/generate/:projectId`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  chargeLegalKit,
  generateLegalDocsStreamingController
);

/** Download PDF for a single document */
legalDocsRoutes.get(
  `/${resourceName}/:projectId/documents/:documentId/pdf`,
  authenticate,
  pdfTimeout,
  generateLegalDocPdfController
);

/** Delete a single document */
legalDocsRoutes.delete(
  `/${resourceName}/:projectId/documents/:documentId`,
  authenticate,
  deleteLegalDocController
);

/** Clear all legal documents for a project */
legalDocsRoutes.delete(`/${resourceName}/:projectId`, authenticate, clearLegalDocsController);

/** Get all legal docs for a project */
legalDocsRoutes.get(`/${resourceName}/:projectId`, authenticate, getLegalDocsController);
