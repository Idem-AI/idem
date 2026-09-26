import { Router } from 'express';
import {
  getBrandingsByProjectController,
  getBrandingByIdController,
  updateBrandingController,
  deleteBrandingController,
  generateColorsAndTypographyController,
  generateColorsAndTypographyFromLogoController,
  generateLogoConceptsController,
  generateLogoConceptsStreamController,
  cancelLogoConceptsController,
  generateLogoVariationsController,
  generateLogoVariationsStreamController,
  generateBrandingStreamingController,
  generateBrandingPdfController,
  generateLogosZipController,
  generateBrandAssetsZipController,
  getSocialAssetsController,
  downloadSocialAssetController,
  editLogoController,
  saveBrandingSectionsController,
  aiEditBrandingSectionController,
  getArtDirectionController,
  regenerateArtDirectionController,
} from '../controllers/branding.controller';
import { authenticate } from '../services/auth.service'; // Updated import path
import { checkQuota } from '../middleware/quota.middleware';
import {
  firstThenRevision,
  includedThenRepeat,
  requireCredits,
} from '../middleware/billing.middleware';

export const brandingRoutes = Router();

const resourceName = 'brandings';

/**
 * Barème de l'identité visuelle.
 *
 * Le modèle économique facture **un livrable** — « logo HD + charte graphique
 * complète : 60 crédits » — et non chaque appel au moteur d'images. Il précise
 * aussi que la session de logo est bornée à 8-10 visuels, et que « toute
 * relance de 4 visuels supplémentaires est débitée 10 crédits ».
 *
 * D'où trois contrôles :
 *  - `chargeBrandSession` : 60 la première fois sur un projet, 10 par relance.
 *    Partagé par les routes de concepts (POST et flux) et par la génération de
 *    la charte complète, qui sont trois portes d'entrée du même livrable ;
 *  - `chargeVariations` : les déclinaisons du logo retenu sont incluses dans
 *    les 60 ; les regénérer coûte une relance ;
 *  - une simple révision pour tout ce qui est textuel (couleurs, typographie,
 *    direction artistique, retouche de section).
 *
 * Le poste image est le seul du barème dont la marge est basse (30-55 %) :
 * c'est précisément celui qu'il ne faut pas laisser tourner gratuitement.
 */
const chargeBrandSession = requireCredits('business', 'logo_brand', {
  resolve: firstThenRevision('business', 'logo_brand', 'logo_relaunch'),
});

const chargeVariations = requireCredits('business', 'logo_variations', {
  resolve: includedThenRepeat('business', 'logo_variations', 'logo_relaunch'),
});

// Middleware to extend connection timeout for heavy processing tasks (AI generation, PDF, etc.)
const extendedTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(900000); // 15 min — le raisonnement triple la durée d'un appel
  res.setTimeout(900000);
  next();
};


// All routes are protected and project-specific where applicable

// Generate a new branding for a project
/**
 * @openapi
 * /project/brandings/generate/{projectId}:
 *   post:
 *     tags:
 *       - Branding
 *     summary: Generate a new branding identity for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project for which to generate branding.
 *     requestBody:
 *       description: Optional initial data for branding generation.
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Optional initial name for the branding.
 *               description:
 *                 type: string
 *                 description: Optional initial description for the branding.
 *     responses:
 *       '201':
 *         description: Branding identity generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrandIdentityModel'
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project not found.
 *       '500':
 *         description: Internal server error.
 */
brandingRoutes.get(
  `/${resourceName}/generate/:projectId`,
  authenticate,
  checkQuota,
  chargeBrandSession,
  generateBrandingStreamingController
);

// Generate logo, colors, and typography for a project
/**
 * @openapi
 * /project/brandings/generate/colors-typography:
 *   post:
 *     tags:
 *       - Branding
 *     summary: Generate logo, colors, and typography based on project and theme
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *             properties:
 *               projectId:
 *                 type: string
 *                 description: The ID of the project to generate assets for.
 *               themeDescription:
 *                 type: string
 *                 description: A description of the theme or keywords to guide generation.
 *                 nullable: true
 *               brandingId:
 *                  type: string
 *                  description: Optional ID of an existing branding to associate with or update.
 *                  nullable: true
 *     responses:
 *       '200':
 *         description: Logo, colors, and typography generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LogoModel'
 *                 colors:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ColorModel'
 *                 typography:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TypographyModel'
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project or Branding not found.
 *       '500':
 *         description: Internal server error.
 */
// Couleurs et typographie sont du texte : coût d'inférence marginal, donc le
// prix d'une révision. Ces deux routes ne portent pas de `projectId` dans leur
// chemin, ce qui exclut de toute façon un barème indexé sur le projet.
brandingRoutes.post(
  `/${resourceName}/generate/colors-typography`,
  authenticate,
  checkQuota,
  requireCredits('business', 'revision'),
  generateColorsAndTypographyController
);

// Generate colors and typography from imported logo colors
brandingRoutes.post(
  `/${resourceName}/generate/colors-typography-from-logo`,
  authenticate,
  checkQuota,
  requireCredits('business', 'revision'),
  generateColorsAndTypographyFromLogoController
);

// Étape 1: Generate logo concepts only (new 3-step approach)
/**
 * @openapi
 * /brandings/generate/logo-concepts/{projectId}:
 *   post:
 *     tags:
 *       - Branding
 *     summary: Generate 4 logo concepts for a project (Step 1 of 3)
 *     description: Generates 4 main logo concepts with text, without variations. Part of the new 3-step logo generation process.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     requestBody:
 *       description: Project data for logo concept generation.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               project:
 *                 type: object
 *                 description: Project object containing project details.
 *               colors:
 *                 type: object
 *                 description: Color palette for the project.
 *               typography:
 *                 type: object
 *                 description: Typography settings for the project.
 *     responses:
 *       '200':
 *         description: Logo concepts generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LogoModel'
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Internal server error.
 */
brandingRoutes.post(
  `/${resourceName}/generate/logo-concepts/:projectId`,
  authenticate,
  extendedTimeout,
  checkQuota,
  chargeBrandSession,
  generateLogoConceptsController
);

// Étape 1 (SSE): Génération streamée des concepts avec boucle qualité
// (concept → critique design → révision), événements temps réel
/**
 * @openapi
 * /project/brandings/generate/logo-concepts-stream/{projectId}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Stream logo concepts generation with quality loop (SSE)
 *     description: |
 *       Server-Sent Events stream. Events (stepName): concept_started,
 *       concept_generated, critique_started, critique_result, revision_started,
 *       concept_updated, concept_finalized, concept_cancelled, concept_error,
 *       then a completion event.
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *     responses:
 *       '200':
 *         description: SSE stream of logo generation events
 */
brandingRoutes.get(
  `/${resourceName}/generate/logo-concepts-stream/:projectId`,
  authenticate,
  extendedTimeout,
  checkQuota,
  chargeBrandSession,
  generateLogoConceptsStreamController
);

// Annulation de la génération en cours (sélection anticipée par l'utilisateur)
/**
 * @openapi
 * /project/brandings/generate/logo-concepts-cancel/{projectId}:
 *   post:
 *     tags:
 *       - Branding
 *     summary: Cancel the in-flight logo concepts generation
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Cancellation acknowledged
 */
brandingRoutes.post(
  `/${resourceName}/generate/logo-concepts-cancel/:projectId`,
  authenticate,
  cancelLogoConceptsController
);

// Étape 2 (SSE): Génération streamée des déclinaisons avec boucle qualité
/**
 * @openapi
 * /project/brandings/generate/logo-variations-stream/{projectId}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Stream logo variations generation with quality loop (SSE)
 *     description: |
 *       Server-Sent Events stream. Events (stepName): variation_started,
 *       variation_generated, critique_started, critique_result,
 *       revision_started, variation_updated, variation_finalized,
 *       variation_cancelled, variation_error, then a completion event.
 *       The selected logo is read from the project.
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *     responses:
 *       '200':
 *         description: SSE stream of variation generation events
 */
brandingRoutes.get(
  `/${resourceName}/generate/logo-variations-stream/:projectId`,
  authenticate,
  extendedTimeout,
  checkQuota,
  chargeVariations,
  generateLogoVariationsStreamController
);

// Étape 2: Generate logo variations for selected logo
/**
 * @openapi
 * /brandings/generate/logo-variations:
 *   post:
 *     tags:
 *       - Branding
 *     summary: Generate variations for a selected logo (Step 2 of 3)
 *     description: Generates lightBackground, darkBackground, and monochrome variations for a selected logo SVG.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Selected logo SVG for variation generation.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selectedLogoSvg:
 *                 type: string
 *                 description: The SVG content of the selected logo.
 *     responses:
 *       '200':
 *         description: Logo variations generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 variations:
 *                   type: object
 *                   properties:
 *                     lightBackground:
 *                       type: string
 *                       description: SVG optimized for light backgrounds.
 *                     darkBackground:
 *                       type: string
 *                       description: SVG optimized for dark backgrounds.
 *                     monochrome:
 *                       type: string
 *                       description: Monochrome SVG version.
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Internal server error.
 */
brandingRoutes.post(
  `/${resourceName}/generate/logo-variations/:projectId`,
  authenticate,
  extendedTimeout,
  checkQuota,
  chargeVariations,
  generateLogoVariationsController
);

// Get all brandings for a specific project
/**
 * @openapi
 * /brandings/getAll/{projectId}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Retrieve all branding identities for a specific project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project whose brandings are to be retrieved.
 *     responses:
 *       '200':
 *         description: A list of branding identities.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BrandIdentityModel'
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project not found.
 *       '500':
 *         description: Internal server error.
 */
brandingRoutes.get(
  `/${resourceName}/getAll/:projectId`,
  authenticate,
  getBrandingsByProjectController
);

// Get a specific branding by its ID
/**
 * @openapi
 * /brandings/get/{projectId}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Retrieve a specific branding identity by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the branding identity to retrieve.
 *     responses:
 *       '200':
 *         description: Details of the branding identity.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrandIdentityModel'
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Branding identity not found.
 *       '500':
 *         description: Internal server error.
 */
brandingRoutes.get(`/${resourceName}/get/:projectId`, authenticate, getBrandingByIdController);

// Update a specific branding by its ID
/**
 * @openapi
 * /brandings/update/{projectId}:
 *   put:
 *     tags:
 *       - Branding
 *     summary: Update an existing branding identity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the branding identity to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBrandingDto'
 *     responses:
 *       '200':
 *         description: Branding identity updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrandIdentityModel'
 *       '400':
 *         description: Bad request (e.g., validation error).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Branding identity not found.
 *       '500':
 *         description: Internal server error.
 */
brandingRoutes.put(`/${resourceName}/update/:projectId`, authenticate, updateBrandingController);

/**
 * @openapi
 * /brandings/{projectId}/sections:
 *   put:
 *     tags: [Brand Identity]
 *     summary: Save edited brand identity sections (WYSIWYG editor)
 *     security: [{ bearerAuth: [] }]
 */
brandingRoutes.put(
  `/${resourceName}/:projectId/sections`,
  authenticate,
  saveBrandingSectionsController
);

/**
 * @openapi
 * /brandings/{projectId}/sections/{sectionId}/ai-edit:
 *   post:
 *     tags: [Brand Identity]
 *     summary: AI-assisted edit of a single brand identity section
 *     security: [{ bearerAuth: [] }]
 */
brandingRoutes.post(
  `/${resourceName}/:projectId/sections/:sectionId/ai-edit`,
  authenticate,
  checkQuota,
  requireCredits('business', 'revision'),
  aiEditBrandingSectionController
);

// Delete a specific branding by its ID
/**
 * @openapi
 * /brandings/delete/{projectId}:
 *   delete:
 *     tags:
 *       - Branding
 *     summary: Delete a branding identity by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the branding identity to delete.
 *     responses:
 *       '200':
 *         description: Branding identity deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Branding identity deleted successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Branding identity not found.
 *       '500':
 *         description: Internal server error.
 */
brandingRoutes.delete(`/${resourceName}/delete/:projectId`, authenticate, deleteBrandingController);

// Generate PDF from branding sections
/**
 * @openapi
 * /brandings/pdf/{projectId}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Generate and download a PDF document from branding sections
 *     description: Creates a PDF document containing all branding sections for a project in A4 format
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project whose branding sections will be converted to PDF
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
 *               example: 'attachment; filename="branding-{projectId}.pdf"'
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
 *         description: Project not found or no branding sections available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No branding sections found for project {projectId}"
 *       '500':
 *         description: Internal server error during PDF generation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error generating branding PDF"
 *                 error:
 *                   type: string
 *                   description: Detailed error message
 */
// Middleware pour augmenter le timeout pour la génération PDF
const pdfTimeout = (req: any, res: any, next: any) => {
  req.setTimeout(900000); // 15 min — le raisonnement triple la durée d'un appel
  res.setTimeout(900000);
  next();
};

brandingRoutes.get(
  `/${resourceName}/pdf/:projectId`,
  authenticate,
  pdfTimeout,
  generateBrandingPdfController
);

// Generate and download ZIP with all logo variations
/**
 * @openapi
 * /logos-zip/{projectId}/{extension}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Generate and download a ZIP file containing all logo variations
 *     description: Creates a ZIP file containing all available logo variations (main, icon, with text, icon only) in the specified format (SVG, PNG, or PSD)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project whose logo variations will be included in the ZIP
 *       - in: path
 *         name: extension
 *         required: true
 *         schema:
 *           type: string
 *           enum: [svg, png, psd]
 *         description: The file format for the logo variations (svg, png, or psd)
 *     responses:
 *       '200':
 *         description: ZIP file generated and returned successfully
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             description: Attachment with filename
 *             schema:
 *               type: string
 *               example: 'attachment; filename="logos-{projectId}-{extension}.zip"'
 *           Content-Type:
 *             description: MIME type of the response
 *             schema:
 *               type: string
 *               example: 'application/zip'
 *       '400':
 *         description: Bad request - Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid extension. Supported extensions: svg, png, psd"
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
 *         description: Project not found or no logo variations available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No logo variations found for this project"
 *       '500':
 *         description: Internal server error during ZIP generation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error generating logos ZIP"
 *                 error:
 *                   type: string
 *                   description: Detailed error message
 */
brandingRoutes.get(
  `/${resourceName}/logos-zip/:projectId/:extension`,
  authenticate,
  generateLogosZipController
);

/**
 * @openapi
 * /brandings/social-assets/{projectId}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Social media banners and profile picture as downloadable files
 *     description: Renders (once, then reuses) the brand's banners for Facebook, LinkedIn, X and YouTube at their exact sizes, plus a profile picture.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: List of files (id, label, width, height, url)
 *       '404':
 *         description: Project or logo not found
 */
brandingRoutes.get(
  `/${resourceName}/social-assets/:projectId`,
  authenticate,
  getSocialAssetsController
);

/**
 * @openapi
 * /brandings/social-assets/{projectId}/{assetId}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Download one social banner or the profile picture (PNG attachment)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: assetId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [facebook-cover, linkedin-cover, x-header, youtube-banner, profile-picture]
 *     responses:
 *       '200':
 *         description: PNG file
 *       '404':
 *         description: Asset not found
 */
brandingRoutes.get(
  `/${resourceName}/social-assets/:projectId/:assetId`,
  authenticate,
  downloadSocialAssetController
);

/**
 * @openapi
 * /brandings/assets-zip/{projectId}:
 *   get:
 *     tags:
 *       - Branding
 *     summary: Download every brand asset in one ZIP
 *     description: Logos (SVG and PNG), palette, typography, social banners and profile picture, social mockups, product mockups and the brand guidelines PDF.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: ZIP archive
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       '404':
 *         description: Project or logo not found
 */
brandingRoutes.get(
  `/${resourceName}/assets-zip/:projectId`,
  authenticate,
  // La charte PDF est rendue si elle n'est pas en cache : même délai qu'elle.
  pdfTimeout,
  generateBrandAssetsZipController
);

// Edit an existing logo with AI
/**
 * @openapi
 * /brandings/edit-logo/{projectId}:
 *   post:
 *     tags:
 *       - Branding
 *     summary: Edit an existing logo using AI based on user modification prompt
 *     description: Uses AI to intelligently modify a logo while preserving its core identity. The AI will apply only the requested changes without redesigning the entire logo.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *     requestBody:
 *       description: Logo SVG and modification instructions
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - logosvg
 *               - modificationPrompt
 *             properties:
 *               logosvg:
 *                 type: string
 *                 description: The current logo SVG content to be edited
 *                 example: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">...</svg>'
 *               modificationPrompt:
 *                 type: string
 *                 description: User's instructions for how to modify the logo
 *                 example: 'Change the icon color to blue and make the text bold'
 *     responses:
 *       '200':
 *         description: Logo edited successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logo:
 *                   $ref: '#/components/schemas/LogoModel'
 *       '400':
 *         description: Bad request - Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logo SVG is required"
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
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Project not found"
 *       '500':
 *         description: Internal server error during logo editing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error editing logo"
 *                 error:
 *                   type: string
 *                   description: Detailed error message
 */
brandingRoutes.post(
  `/${resourceName}/edit-logo/:projectId`,
  authenticate,
  extendedTimeout,
  checkQuota,
  // Retoucher un logo produit de nouveaux visuels : c'est une relance.
  requireCredits('business', 'logo_relaunch'),
  editLogoController
);

/**
 * @openapi
 * /project/brandings/{projectId}/art-direction:
 *   get:
 *     tags: [Branding]
 *     summary: Direction artistique du projet (générée si absente)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Direction artistique
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtDirectionModel'
 *       '404': { description: Projet ou charte introuvable }
 *   post:
 *     tags: [Branding]
 *     summary: Propose une AUTRE direction artistique (le style courant est écarté)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Nouvelle direction artistique
 *       '404': { description: Projet ou charte introuvable }
 */
brandingRoutes.get(
  `/${resourceName}/:projectId/art-direction`,
  authenticate,
  extendedTimeout,
  getArtDirectionController
);

brandingRoutes.post(
  `/${resourceName}/:projectId/art-direction`,
  authenticate,
  extendedTimeout,
  checkQuota,
  // La direction artistique est un parti pris textuel, pas une image.
  requireCredits('business', 'revision'),
  regenerateArtDirectionController
);
