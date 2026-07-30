import { Router } from 'express';
import { FontController } from '../controllers/font.controller';
import { authenticate } from '../services/auth.service';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     FontSummary:
 *       type: object
 *       properties:
 *         family:
 *           type: string
 *           description: Google Fonts family name
 *           example: Playfair Display
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
 *           description: Popularity rank (0 = most popular)
 */

/**
 * @swagger
 * /fonts:
 *   get:
 *     summary: Search the Google Fonts catalog
 *     description: >
 *       Proxies the Google Fonts Developer API so the API key stays server-side.
 *       An empty query returns the most popular families. The catalog is cached
 *       for 24h (in-memory + Redis).
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
 *                 message:
 *                   type: string
 *       503:
 *         description: GOOGLE_FONTS_API_KEY is not configured on the server
 *       502:
 *         description: Google Fonts API unreachable
 */
router.get('/', authenticate, FontController.searchFonts);

export default router;
