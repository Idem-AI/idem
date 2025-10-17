import { Router, Request, Response } from "express";
import quotaController from "../controllers/quota.controller";
import { authenticate } from "../services/auth.service";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     QuotaInfo:
 *       type: object
 *       properties:
 *         dailyUsage:
 *           type: integer
 *           description: Number of requests used today
 *         weeklyUsage:
 *           type: integer
 *           description: Number of requests used this week
 *         dailyLimit:
 *           type: integer
 *           description: Daily request limit
 *         weeklyLimit:
 *           type: integer
 *           description: Weekly request limit
 *         remainingDaily:
 *           type: integer
 *           description: Remaining requests for today
 *         remainingWeekly:
 *           type: integer
 *           description: Remaining requests for this week
 *         isBeta:
 *           type: boolean
 *           description: Whether beta mode is active
 *
 *     BetaInfo:
 *       type: object
 *       properties:
 *         isBeta:
 *           type: boolean
 *           description: Whether beta mode is active
 *         limitations:
 *           type: string
 *           description: Beta limitations message
 *         restrictions:
 *           type: object
 *           description: Beta restrictions configuration
 *         quotaLimits:
 *           type: object
 *           description: Current quota limits
 *
 *     UsageStats:
 *       type: object
 *       properties:
 *         daily:
 *           type: object
 *           properties:
 *             used:
 *               type: integer
 *             limit:
 *               type: integer
 *             remaining:
 *               type: integer
 *             percentage:
 *               type: integer
 *         weekly:
 *           type: object
 *           properties:
 *             used:
 *               type: integer
 *             limit:
 *               type: integer
 *             remaining:
 *               type: integer
 *             percentage:
 *               type: integer
 *         isBeta:
 *           type: boolean
 *         betaLimitations:
 *           type: string
 *           nullable: true
 */

/**
 * @swagger
 * /quota/info:
 *   get:
 *     summary: Get user's quota information
 *     tags: [Quota]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quota information retrieved successfully
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
 *                     quota:
 *                       $ref: '#/components/schemas/QuotaInfo'
 *                     beta:
 *                       $ref: '#/components/schemas/BetaInfo'
 *                       nullable: true
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get("/info", authenticate, (req: Request, res: Response) =>
  quotaController.getQuotaInfo(req as any, res)
);

/**
 * @swagger
 * /quota/check:
 *   get:
 *     summary: Check if user can make a request
 *     tags: [Quota]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quota check completed
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
 *                     allowed:
 *                       type: boolean
 *                     remainingDaily:
 *                       type: integer
 *                     remainingWeekly:
 *                       type: integer
 *                     message:
 *                       type: string
 *                       nullable: true
 *                     limits:
 *                       type: object
 *                     isBeta:
 *                       type: boolean
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get("/check", authenticate, (req: Request, res: Response) =>
  quotaController.checkQuota(req as any, res)
);

/**
 * @swagger
 * /quota/beta:
 *   get:
 *     summary: Get beta restrictions and limitations
 *     tags: [Quota]
 *     responses:
 *       200:
 *         description: Beta information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BetaInfo'
 *       500:
 *         description: Internal server error
 */
router.get("/beta", authenticate, (req: Request, res: Response) =>
  quotaController.getBetaInfo(req as any, res)
);

/**
 * @swagger
 * /quota/validate/{featureName}:
 *   get:
 *     summary: Validate if a feature is available for the user
 *     tags: [Quota]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: featureName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the feature to validate
 *     responses:
 *       200:
 *         description: Feature validation completed
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
 *                     featureAllowed:
 *                       type: boolean
 *                     featureMessage:
 *                       type: string
 *                       nullable: true
 *                     quotaAllowed:
 *                       type: boolean
 *                     quotaMessage:
 *                       type: string
 *                       nullable: true
 *                     remainingDaily:
 *                       type: integer
 *                     remainingWeekly:
 *                       type: integer
 *                     isBeta:
 *                       type: boolean
 *       400:
 *         description: Feature name is required
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  "/validate/:featureName",
  authenticate,
  (req: Request, res: Response) =>
    quotaController.validateFeature(req as any, res)
);

/**
 * @swagger
 * /quota/stats:
 *   get:
 *     summary: Get detailed usage statistics
 *     tags: [Quota]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UsageStats'
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get("/stats", authenticate, (req: Request, res: Response) =>
  quotaController.getUsageStats(req as any, res)
);

export default router;
