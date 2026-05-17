import { Router, Request, Response } from 'express';
import quotaController from '../controllers/quota.controller';
import { authenticate } from '../services/auth.service';

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
 *         limitations:
 *           type: string
 *           description: System limitations message
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
 *         limitations:
 *           type: string
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
 *                   $ref: '#/components/schemas/QuotaInfo'
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/info', authenticate, (req: Request, res: Response) =>
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
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/check', authenticate, (req: Request, res: Response) =>
  quotaController.checkQuota(req as any, res)
);

/**
 * @swagger
 * /quota/system-info:
 *   get:
 *     summary: Get system restrictions and limitations
 *     tags: [Quota]
 *     responses:
 *       200:
 *         description: System information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       500:
 *         description: Internal server error
 */
router.get('/system-info', authenticate, (req: Request, res: Response) =>
  quotaController.getSystemInfo(req as any, res)
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
router.get('/stats', authenticate, (req: Request, res: Response) =>
  quotaController.getUsageStats(req as any, res)
);

export default router;
