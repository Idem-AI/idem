import { Router } from "express";
import {
  getBusinessPlanByIdController,
  updateBusinessPlanController,
  deleteBusinessPlanController,
  generateBusinessPlanStreamingController,
  generateBusinessPlanPdfController,
  setAdditionalInfoController,
} from "../controllers/businessPlan.controller";
import { authenticate } from "../services/auth.service";
import { checkQuota } from "../middleware/quota.middleware";
import { checkPolicyAcceptance } from "../middleware/policyCheck.middleware";
import multer from "multer";

export const businessPlanRoutes = Router();

const resourceName = "businessPlans";

// Configuration multer pour l'upload d'images des team members
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
    files: 20, // Max 20 files (team members)
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Generate a new business plan for a project (streaming)
/**
 * @openapi
 * /businessPlans/generate/{projectId}:
 *   get:
 *     tags:
 *       - Business Plans
 *     summary: Generate a business plan with real-time streaming
 *     description: Creates a business plan with streaming progress based on the project's existing data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project for which to generate the business plan
 *     responses:
 *       '200':
 *         description: Server-Sent Events stream with business plan generation progress
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: SSE stream with JSON messages containing step progress and final business plan result
 *             examples:
 *               progress:
 *                 summary: Progress event
 *                 value: 'data: {"type":"progress","step":"Analyse du marché","content":"...","progress":25}\n\n'
 *               complete:
 *                 summary: Completion event
 *                 value: 'data: {"type":"complete","businessPlan":{"executiveSummary":"...","marketAnalysis":"..."}}\n\n'
 *               error:
 *                 summary: Error event
 *                 value: 'data: {"error":"Error message"}\n\n'
 *       '400':
 *         description: Bad request - Invalid project ID
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: 'data: {"error":"Project ID is required"}\n\n'
 *       '401':
 *         description: Unauthorized - Authentication required
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: 'data: {"error":"User not authenticated"}\n\n'
 *       '429':
 *         description: Too many requests - Quota exceeded
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: 'data: {"error":"Quota exceeded"}\n\n'
 *       '500':
 *         description: Internal server error
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: 'data: {"error":"Failed to generate business plan"}\n\n'
 */
businessPlanRoutes.get(
  `/${resourceName}/generate/:projectId`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  generateBusinessPlanStreamingController
);

// Get a specific business plan by its project ID
/**
 * @openapi
 * /businessPlans/{projectId}:
 *   get:
 *     tags:
 *       - Business Plans
 *     summary: Retrieve a specific business plan by its project ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the business plan to retrieve.
 *     responses:
 *       '200':
 *         description: Details of the business plan.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessPlanModel'
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Business plan not found.
 *       '500':
 *         description: Internal server error.
 */
businessPlanRoutes.get(
  `/${resourceName}/:projectId`,
  authenticate,
  getBusinessPlanByIdController
);

// Update a specific business plan by its project ID
/**
 * @openapi
 * /businessPlans/{projectId}:
 *   put:
 *     tags:
 *       - Business Plans
 *     summary: Update an existing business plan by its project ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the business plan to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBusinessPlanDto'
 *     responses:
 *       '200':
 *         description: Business plan updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessPlanModel'
 *       '400':
 *         description: Bad request (e.g., validation error).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Business plan not found.
 *       '500':
 *         description: Internal server error.
 */
businessPlanRoutes.put(
  `/${resourceName}/:projectId`,
  authenticate,
  updateBusinessPlanController
);

// Delete a specific business plan by its project ID
/**
 * @openapi
 * /businessPlans/{projectId}:
 *   delete:
 *     tags:
 *       - Business Plans
 *     summary: Delete a business plan by its project ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the business plan to delete.
 *     responses:
 *       '200':
 *         description: Business plan deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Business plan deleted successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Business plan not found.
 *       '500':
 *         description: Internal server error.
 */
businessPlanRoutes.delete(
  `/${resourceName}/:projectId`,
  authenticate,
  deleteBusinessPlanController
);

// Generate PDF from business plan sections
/**
 * @openapi
 * /businessPlans/pdf/{projectId}:
 *   get:
 *     tags:
 *       - Business Plans
 *     summary: Generate and download a PDF document from business plan sections
 *     description: Creates a PDF document containing all business plan sections for a project in A4 format
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project whose business plan sections will be converted to PDF
 *     responses:
 *       '200':
 *         description: PDF generated and returned successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             description: Attachment with filename
 *             schema:
 *               type: string
 *               example: 'attachment; filename="business-plan-{projectId}.pdf"'
 *           Content-Type:
 *             description: MIME type of the response
 *             schema:
 *               type: string
 *               example: 'application/pdf'
 *       '400':
 *         description: Bad request - Project ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Project ID is required"
 *       '401':
 *         description: Unauthorized - User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not authenticated"
 *       '404':
 *         description: Project not found or no business plan sections available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No business plan sections found for project {projectId}"
 *       '500':
 *         description: Internal server error during PDF generation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error generating business plan PDF"
 *                 error:
 *                   type: string
 *                   description: Detailed error message
 */
// Middleware pour augmenter le timeout pour la génération PDF
const pdfTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(180000); // 3 minutes
  res.setTimeout(180000); // 3 minutes
  next();
};

businessPlanRoutes.get(
  `/${resourceName}/pdf/:projectId`,
  authenticate,
  pdfTimeout,
  generateBusinessPlanPdfController
);

// Set additional information for a business plan project (with team member images upload)
/**
 * @openapi
 * /businessPlans/set-additional-info/{projectId}:
 *   post:
 *     tags:
 *       - Business Plans
 *     summary: Set additional information for a business plan project
 *     description: Updates the additional company information including team members and their profile pictures via multipart/form-data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to update
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - additionalInfos
 *             properties:
 *               additionalInfos:
 *                 type: string
 *                 description: JSON string containing additional company information
 *                 example: '{"email":"contact@company.com","phone":"+33123456789","address":"123 Rue Example","city":"Paris","country":"France","zipCode":"75001","teamMembers":[{"name":"John Doe","position":"CEO","bio":"Experienced leader"}]}'
 *               teamMemberImage_0:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture for team member at index 0
 *               teamMemberImage_1:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture for team member at index 1
 *     responses:
 *       200:
 *         description: Additional information updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Informations additionnelles mises à jour avec succès"
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *                 uploadedImages:
 *                   type: object
 *                   description: Map of uploaded image URLs by team member index
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email requis dans les informations additionnelles"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       404:
 *         description: Project not found or update failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Projet non trouvé ou échec de la mise à jour"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Erreur interne du serveur"
 */
businessPlanRoutes.post(
  `/${resourceName}/set-additional-info/:projectId`,
  authenticate,
  upload.any(), // Support multiple files with any field names
  setAdditionalInfoController
);


