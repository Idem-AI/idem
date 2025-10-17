import { Router } from "express";
import { CacheController } from "../controllers/cache.controller";
import { authenticate } from "../services/auth.service";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CacheStats:
 *       type: object
 *       properties:
 *         totalKeys:
 *           type: number
 *           description: Total number of cache keys
 *         memoryUsage:
 *           type: string
 *           description: Redis memory usage
 *         hitRate:
 *           type: number
 *           description: Cache hit rate (%)
 *         missRate:
 *           type: number
 *           description: Cache miss rate (%)
 *         totalHits:
 *           type: number
 *           description: Total number of hits
 *         totalMisses:
 *           type: number
 *           description: Total number of misses
 *     CacheKeyCheck:
 *       type: object
 *       properties:
 *         key:
 *           type: string
 *           description: Cache key
 *         exists:
 *           type: boolean
 *           description: Whether the key exists
 *         ttl:
 *           type: number
 *           nullable: true
 *           description: Remaining TTL in seconds
 */

/**
 * @swagger
 * /cache/stats:
 *   get:
 *     summary: Get Redis cache statistics
 *     tags: [Cache]
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CacheStats'
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.get("/stats", CacheController.getCacheStats);

/**
 * @swagger
 * /cache/clear:
 *   delete:
 *     summary: Clear Redis cache completely
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.delete("/clear", authenticate, CacheController.clearCache);

/**
 * @swagger
 * /cache/user/{userId}:
 *   delete:
 *     summary: Invalidate cache for a specific user
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: ID de l'utilisateur (optionnel, utilise l'utilisateur connecté par défaut)
 *     responses:
 *       200:
 *         description: User cache invalidated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedKeys:
 *                       type: number
 *       400:
 *         description: User ID required
 *       500:
 *         description: Server error
 */
router.delete(
  "/user/:userId?",
  authenticate,
  CacheController.invalidateUserCache
);

/**
 * @swagger
 * /cache/project/{projectId}:
 *   delete:
 *     summary: Invalidate cache for a specific project
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID du projet
 *     responses:
 *       200:
 *         description: Project cache invalidated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedKeys:
 *                       type: number
 *       400:
 *         description: Project ID required
 *       500:
 *         description: Server error
 */
router.delete(
  "/project/:projectId",
  authenticate,
  CacheController.invalidateProjectCache
);

/**
 * @swagger
 * /cache/pattern:
 *   delete:
 *     summary: Invalidate cache by pattern
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pattern
 *             properties:
 *               pattern:
 *                 type: string
 *                 description: "Key pattern to delete (e.g., user:123:*)"
 *     responses:
 *       200:
 *         description: Cache invalidated by pattern successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedKeys:
 *                       type: number
 *       400:
 *         description: Pattern required
 *       500:
 *         description: Server error
 */
router.delete(
  "/pattern",
  authenticate,
  CacheController.invalidateCacheByPattern
);

/**
 * @swagger
 * /cache/key:
 *   get:
 *     summary: Check if a key exists in cache
 *     tags: [Cache]
 *     parameters:
 *       - in: query
 *         name: key
 *         schema:
 *           type: string
 *         required: true
 *         description: Cache key to check
 *       - in: query
 *         name: prefix
 *         schema:
 *           type: string
 *         required: false
 *         description: Key prefix
 *     responses:
 *       200:
 *         description: Key verification completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CacheKeyCheck'
 *                 message:
 *                   type: string
 *       400:
 *         description: Key required
 *       500:
 *         description: Server error
 */
router.get("/key", CacheController.checkCacheKey);

/**
 * @swagger
 * /cache/ttl:
 *   put:
 *     summary: Update TTL of a cache key
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - ttl
 *             properties:
 *               key:
 *                 type: string
 *                 description: Cache key
 *               ttl:
 *                 type: number
 *                 description: New TTL in seconds
 *               prefix:
 *                 type: string
 *                 description: Key prefix
 *     responses:
 *       200:
 *         description: TTL updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     ttl:
 *                       type: number
 *       400:
 *         description: Key and TTL required
 *       404:
 *         description: Key not found
 *       500:
 *         description: Server error
 */
router.put("/ttl", authenticate, CacheController.updateCacheTTL);

// ==========================================
// PDF CACHE MANAGEMENT ROUTES
// ==========================================

/**
 * @swagger
 * components:
 *   schemas:
 *     PdfCacheStats:
 *       type: object
 *       properties:
 *         htmlEntries:
 *           type: number
 *           description: Number of HTML entries in cache
 *         pdfEntries:
 *           type: number
 *           description: Number of PDF entries in cache
 *         totalSize:
 *           type: number
 *           description: Total HTML cache size (bytes)
 *         totalSizeMB:
 *           type: number
 *           description: Total HTML cache size (MB)
 *         diskUsage:
 *           type: number
 *           description: PDF files disk usage (bytes)
 *         diskUsageMB:
 *           type: number
 *           description: PDF files disk usage (MB)
 *         oldestEntry:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Date of the oldest entry
 *         newestEntry:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Date of the newest entry
 *     PdfCacheClearResult:
 *       type: object
 *       properties:
 *         htmlCleared:
 *           type: number
 *           description: Number of HTML entries cleared
 *         pdfCleared:
 *           type: number
 *           description: Number of PDF entries cleared
 */

/**
 * @swagger
 * /cache/pdf/stats:
 *   get:
 *     summary: Get local PDF cache statistics
 *     tags: [Cache PDF]
 *     responses:
 *       200:
 *         description: PDF cache statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PdfCacheStats'
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.get("/pdf/stats", CacheController.getPdfCacheStats);

/**
 * @swagger
 * /cache/pdf/clear:
 *   delete:
 *     summary: Clear PDF cache (selectively or completely)
 *     tags: [Cache PDF]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [html, pdf, all]
 *           default: all
 *         description: Type of cache to clear (html, pdf, or all)
 *     responses:
 *       200:
 *         description: PDF cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PdfCacheClearResult'
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.delete("/pdf/clear", CacheController.clearPdfCache);

/**
 * @swagger
 * /cache/pdf/clear-all:
 *   delete:
 *     summary: Clear all PDF cache (local + Redis) using clearCache()
 *     tags: [Cache PDF]
 *     responses:
 *       200:
 *         description: All PDF cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.delete("/pdf/clear-all", CacheController.clearAllPdfCache);

/**
 * @swagger
 * /cache/pdf/project/{projectId}:
 *   delete:
 *     summary: Invalidate PDF cache for a specific project
 *     tags: [Cache PDF]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         schema:
 *           type: string
 *         required: true
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project cache invalidated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     redisDeletedKeys:
 *                       type: number
 *                       description: Nombre de clés supprimées dans Redis
 *                     pdfDeletedEntries:
 *                       type: number
 *                       description: Nombre d'entrées PDF supprimées
 *       400:
 *         description: Project ID required
 *       500:
 *         description: Server error
 */
router.delete(
  "/pdf/project/:projectId",
  authenticate,
  CacheController.invalidatePdfCacheByProject
);

/**
 * @swagger
 * /cache/pdf/user/{userId}:
 *   delete:
 *     summary: Invalidate PDF cache for a specific user
 *     tags: [Cache PDF]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: User ID (optional, uses authenticated user by default)
 *     responses:
 *       200:
 *         description: User PDF cache invalidated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     redisDeletedKeys:
 *                       type: number
 *                       description: Number of keys deleted in Redis
 *                     pdfDeletedEntries:
 *                       type: number
 *                       description: Number of PDF entries deleted
 *       400:
 *         description: User ID required
 *       500:
 *         description: Server error
 */
router.delete(
  "/pdf/user/:userId?",
  authenticate,
  CacheController.invalidatePdfCacheByUser
);

/**
 * @swagger
 * /cache/pdf/age:
 *   delete:
 *     summary: Clean PDF cache by age
 *     tags: [Cache PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - maxAgeMinutes
 *             properties:
 *               maxAgeMinutes:
 *                 type: number
 *                 minimum: 1
 *                 description: Maximum age in minutes (older entries will be deleted)
 *                 example: 60
 *     responses:
 *       200:
 *         description: PDF cache cleaned by age successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PdfCacheClearResult'
 *                 message:
 *                   type: string
 *       400:
 *         description: maxAgeMinutes required and must be positive
 *       500:
 *         description: Server error
 */
router.delete("/pdf/age", CacheController.clearPdfCacheByAge);

export default router;
