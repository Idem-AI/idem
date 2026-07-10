import { Router } from 'express';
import multer from 'multer';
import {
  importLogoController,
  exportLogoPngController,
  analyzeLogoController,
} from '../controllers/logo-import.controller';
import { authenticate } from '../services/auth.service';

const router = Router();

// Multer configuration: memory storage, 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * @openapi
 * /api/logo/import:
 *   post:
 *     tags:
 *       - Logo Import
 *     summary: Import and vectorize a logo
 *     description: |
 *       Accepts SVG, PNG, JPG, or WebP files.
 *       - SVG files are sanitized and optimized with SVGO.
 *       - Raster images are preprocessed with sharp (resize, grayscale, normalize)
 *         then vectorized with potrace and optimized with SVGO.
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - logo
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Logo file (SVG, PNG, JPG, or WebP). Max 10MB.
 *     responses:
 *       '200':
 *         description: Logo processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 svg:
 *                   type: string
 *                   description: Optimized SVG content
 *                 width:
 *                   type: number
 *                 height:
 *                   type: number
 *       '400':
 *         description: Invalid file (unsupported format, empty, or too large)
 *       '408':
 *         description: Vectorization timed out
 *       '422':
 *         description: Image too complex to vectorize
 *       '500':
 *         description: Internal server error
 */
router.post('/import', authenticate, upload.single('logo'), importLogoController);

/**
 * @openapi
 * /api/logo/analyze:
 *   post:
 *     tags:
 *       - Logo Import
 *     summary: Analyze an imported logo with a vision model
 *     description: |
 *       Runs a multimodal analysis of the logo and returns a structured redesign
 *       brief (logo type, shapes, colors, weaknesses, improvement brief) used by
 *       the "improve my logo with AI" flow.
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - svg
 *             properties:
 *               svg:
 *                 type: string
 *                 description: SVG content of the imported logo
 *     responses:
 *       '200':
 *         description: Analysis result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 analysis:
 *                   type: object
 *                   properties:
 *                     logoType:
 *                       type: string
 *                       enum: [icon, name, initial]
 *                     improvementBrief:
 *                       type: string
 *       '400':
 *         description: SVG content is required
 *       '500':
 *         description: Analysis failed
 */
router.post('/analyze', authenticate, analyzeLogoController);

/**
 * @openapi
 * /api/logo/export/png:
 *   post:
 *     tags:
 *       - Logo Import
 *     summary: Convert SVG to PNG
 *     description: Converts an SVG string to a PNG image using sharp.
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - svg
 *             properties:
 *               svg:
 *                 type: string
 *                 description: SVG content to convert
 *               width:
 *                 type: number
 *                 description: Optional output width
 *               height:
 *                 type: number
 *                 description: Optional output height
 *     responses:
 *       '200':
 *         description: PNG image
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       '400':
 *         description: SVG content is required
 *       '500':
 *         description: Conversion failed
 */
router.post('/export/png', authenticate, exportLogoPngController);

export default router;
