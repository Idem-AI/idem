import { Router } from 'express';
import multer from 'multer';
import { FontController } from '../controllers/font.controller';
import { MAX_FILES_PER_FONT } from '../services/customFont.service';
import { authenticate } from '../services/auth.service';

const router = Router();

/**
 * Les fichiers passent par la mémoire : ils partent aussitôt dans le bucket,
 * et une famille complète pèse quelques mégaoctets au plus.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: MAX_FILES_PER_FONT,
  },
});

/**
 * @swagger
 * components:
 *   schemas:
 *     FontSummary:
 *       type: object
 *       properties:
 *         family:
 *           type: string
 *           description: Font family name
 *           example: Playfair Display
 *         source:
 *           type: string
 *           enum: [google, fontshare, fontsource, custom]
 *           description: Catalog the family comes from
 *         sourceId:
 *           type: string
 *           description: Identifier of the family within its source
 *         cssUrl:
 *           type: string
 *           format: url
 *           description: Stylesheet that actually loads the family
 *         category:
 *           type: string
 *           enum: [sans-serif, serif, display, handwriting, monospace]
 *         weights:
 *           type: array
 *           items:
 *             type: number
 *           description: Published numeric weights
 *         subsets:
 *           type: array
 *           items:
 *             type: string
 *         popularity:
 *           type: number
 *           description: Rank within its source (0 = most popular)
 *         license:
 *           type: string
 */

/**
 * @swagger
 * /fonts:
 *   get:
 *     summary: Search the aggregated font catalog
 *     description: >
 *       Searches Google Fonts, Fontshare, Fontsource (non-Google families) and
 *       the caller's own imported fonts at once. API keys stay server-side and
 *       every catalog is cached for 24h (in-memory + Redis). A source that is
 *       unreachable is simply absent from the results.
 *     tags: [Fonts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: false
 *         description: Search term matched against the family name
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [sans-serif, serif, display, handwriting, monospace]
 *         required: false
 *         description: Restrict results to a font category
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *         required: false
 *         description: >
 *           Comma-separated list of sources (google, fontshare, fontsource,
 *           custom). Omitted, every source is queried.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 48
 *           maximum: 100
 *         required: false
 *         description: Maximum number of families returned
 *     responses:
 *       200:
 *         description: Fonts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     fonts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FontSummary'
 *                     total:
 *                       type: number
 *                       description: Matches found before truncation
 *                     sources:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Sources that actually answered
 *                 message:
 *                   type: string
 */
router.get('/', authenticate, FontController.searchFonts);

/**
 * @swagger
 * /fonts/sources:
 *   get:
 *     summary: List the font catalogs available for filtering
 *     tags: [Fonts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sources retrieved successfully
 */
router.get('/sources', authenticate, FontController.listSources);

/**
 * @swagger
 * /fonts/custom:
 *   get:
 *     summary: List the fonts the caller has imported
 *     tags: [Fonts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Imported fonts retrieved successfully
 *   post:
 *     summary: Import a font family owned by the user
 *     description: >
 *       Accepts WOFF2, WOFF, TTF and OTF files (format checked from the file
 *       signature, not the extension). Files are stored in our bucket and an
 *       `@font-face` stylesheet is generated next to them; its URL is returned
 *       as `cssUrl` and is what gets stored on the project's typography instead
 *       of a Google Fonts link. Re-importing a family replaces it.
 *     tags: [Fonts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               family:
 *                 type: string
 *                 description: CSS family name; inferred from the file name when omitted
 *               category:
 *                 type: string
 *                 enum: [sans-serif, serif, display, handwriting, monospace]
 *             required:
 *               - files
 *     responses:
 *       201:
 *         description: Font imported successfully
 *       400:
 *         description: Unsupported or invalid font file
 *       401:
 *         description: Authentication required
 */
router.get('/custom', authenticate, FontController.listCustomFonts);
router.post('/custom', authenticate, upload.array('files', MAX_FILES_PER_FONT), FontController.importFont);

/**
 * @swagger
 * /fonts/custom/{fontId}:
 *   delete:
 *     summary: Delete an imported font and its files
 *     tags: [Fonts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fontId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Font deleted successfully
 *       404:
 *         description: Font not found
 */
router.delete('/custom/:fontId', authenticate, FontController.deleteCustomFont);

export default router;
