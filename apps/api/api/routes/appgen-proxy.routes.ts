import { Router, Request, Response } from 'express';
import { authenticate } from '../services/auth.service';
import { checkQuota } from '../middleware/quota.middleware';
import { rateLimitByUser, rateLimitByEndpoint } from '../middleware/rate-limit.middleware';
import tokenTrackingService from '../services/token-tracking.service';
import anomalyDetectionService from '../services/anomaly-detection.service';
import logger from '../config/logger';

const router = Router();

/**
 * Proxy for AppGen AI requests
 * This prevents API keys from being exposed to the client
 */
router.post(
  '/chat',
  authenticate,
  rateLimitByUser({ windowMs: 15 * 60 * 1000, maxRequests: 100 }),
  rateLimitByEndpoint('appgen-chat', { windowMs: 15 * 60 * 1000, maxRequests: 50 }),
  checkQuota,
  async (req: Request & { user?: { uid: string; email?: string } }, res: Response) => {
    const userId = req.user!.uid;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      // Track activity for anomaly detection
      anomalyDetectionService.trackActivity(userId, '/appgen-proxy/chat', ip);

      // Check if user is blocked
      if (anomalyDetectionService.isUserBlocked(userId)) {
        const remainingMs = anomalyDetectionService.getBlockedTimeRemaining(userId);
        return res.status(403).json({
          error: 'Access Temporarily Blocked',
          message: 'Your account has been temporarily blocked due to suspicious activity.',
          unblockIn: Math.ceil(remainingMs / 1000),
        });
      }

      // Check token limits
      const tokenCheck = await tokenTrackingService.checkTokenLimit(userId);
      if (!tokenCheck.allowed) {
        return res.status(429).json({
          error: 'Token Limit Exceeded',
          message: tokenCheck.message,
          limits: {
            dailyRemaining: tokenCheck.dailyRemaining,
            monthlyRemaining: tokenCheck.monthlyRemaining,
            costRemaining: tokenCheck.costRemaining,
          },
        });
      }

      const { messages, model = 'gemini-pro', mode = 'builder' } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: 'Invalid Request',
          message: 'Messages array is required',
        });
      }

      logger.info(
        `AppGen proxy request from user ${userId}: model=${model}, mode=${mode}, messages=${messages.length}`
      );

      // Get API configuration from environment
      const apiUrl = process.env.THIRD_API_URL || 'https://api.openai.com/v1';
      const apiKey = process.env.THIRD_API_KEY;

      if (!apiKey) {
        logger.error('THIRD_API_KEY not configured');
        return res.status(500).json({
          error: 'Configuration Error',
          message: 'AI service not configured',
        });
      }

      // Forward request to AI service
      const aiResponse = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        logger.error(`AI service error: ${aiResponse.status} - ${errorText}`);
        return res.status(aiResponse.status).json({
          error: 'AI Service Error',
          message: 'Failed to get response from AI service',
        });
      }

      const aiData = await aiResponse.json();

      // Track token usage
      const usage = aiData.usage;
      if (usage) {
        await tokenTrackingService.trackTokenUsage(
          userId,
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0,
          model
        );
      }

      logger.info(
        `AppGen proxy success for user ${userId}: tokens=${usage?.total_tokens || 0}`
      );

      return res.json(aiData);
    } catch (error) {
      logger.error(`AppGen proxy error for user ${userId}:`, error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process request',
      });
    }
  }
);

/**
 * Get token usage statistics
 */
router.get(
  '/usage',
  authenticate,
  async (req: Request & { user?: { uid: string } }, res: Response) => {
    try {
      const userId = req.user!.uid;
      const stats = await tokenTrackingService.getUsageStats(userId);

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting token usage:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get usage statistics',
      });
    }
  }
);

/**
 * Health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'appgen-proxy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
