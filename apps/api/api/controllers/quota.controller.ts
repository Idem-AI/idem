import { Response } from "express";
import { userService } from "../services/user.service";
import betaRestrictionsService from "../services/betaRestrictions.service";
import logger from "../config/logger";
import { CustomRequest } from "../interfaces/express.interface";

export class QuotaController {
  /**
   * Get user's quota information
   */
  async getQuotaInfo(req: CustomRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;
      logger.info(`Getting quota info for user: ${userId}`);

      const quotaInfo = await userService.getQuotaInfo(userId!);
      const betaInfo = betaRestrictionsService.isBetaMode()
        ? {
            isBeta: true,
            limitations: betaRestrictionsService.getBetaLimitationsMessage(),
            restrictions: betaRestrictionsService.getRestrictions(),
          }
        : null;

      logger.info(`Successfully retrieved quota info for user ${userId}`);

      res.json({
        dailyUsage: quotaInfo.dailyUsage,
        weeklyUsage: quotaInfo.weeklyUsage,
        dailyLimit: quotaInfo.dailyLimit,
        weeklyLimit: quotaInfo.weeklyLimit,
        remainingDaily: quotaInfo.remainingDaily,
        remainingWeekly: quotaInfo.remainingWeekly,
      });
    } catch (error) {
      logger.error(
        `Error getting quota info for user ${req.user?.uid}:`,
        error
      );
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to retrieve quota information",
      });
    }
  }

  /**
   * Check if user can make a request (without incrementing usage)
   */
  async checkQuota(req: CustomRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;
      logger.info(`Checking quota for user: ${userId}`);

      const quotaCheck = await userService.checkQuota(userId!);

      logger.info(
        `Quota check completed for user ${userId}: allowed=${quotaCheck.allowed}`
      );

      res.json({
        allowed: quotaCheck.allowed,
        remainingDaily: quotaCheck.remainingDaily,
        remainingWeekly: quotaCheck.remainingWeekly,
        message: quotaCheck.message,
        limits: userService.getCurrentLimits(),
        isBeta: userService.isBetaMode(),
      });
    } catch (error) {
      logger.error(`Error checking quota for user ${req.user?.uid}:`, error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to check quota",
      });
    }
  }

  /**
   * Get beta restrictions and limitations
   */
  async getBetaInfo(req: CustomRequest, res: Response): Promise<void> {
    try {
      logger.info("Getting beta information");

      const betaInfo = {
        isBeta: betaRestrictionsService.isBetaMode(),
        limitations: betaRestrictionsService.getBetaLimitationsMessage(),
        restrictions: betaRestrictionsService.getRestrictions(),
        quotaLimits: userService.getCurrentLimits(),
      };

      res.json({
        success: true,
        data: betaInfo,
      });
    } catch (error) {
      logger.error("Error getting beta info:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to retrieve beta information",
      });
    }
  }

  /**
   * Validate a feature for the current user
   */
  async validateFeature(req: CustomRequest, res: Response): Promise<void> {
    try {
      const { featureName } = req.params;
      const userId = req.user?.uid;

      logger.info(`Validating feature '${featureName}' for user: ${userId}`);

      if (!featureName) {
        res.status(400).json({
          error: "Bad request",
          message: "Feature name is required",
        });
        return;
      }

      const featureValidation =
        betaRestrictionsService.validateFeature(featureName);
      const quotaCheck = await userService.checkQuota(userId!);

      res.json({
        success: true,
        data: {
          featureAllowed: featureValidation.allowed,
          featureMessage: featureValidation.message,
          quotaAllowed: quotaCheck.allowed,
          quotaMessage: quotaCheck.message,
          remainingDaily: quotaCheck.remainingDaily,
          remainingWeekly: quotaCheck.remainingWeekly,
          isBeta: betaRestrictionsService.isBetaMode(),
        },
      });
    } catch (error) {
      logger.error(
        `Error validating feature for user ${req.user?.uid}:`,
        error
      );
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to validate feature",
      });
    }
  }

  /**
   * Get usage statistics (for admin or user dashboard)
   */
  async getUsageStats(req: CustomRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;
      logger.info(`Getting usage stats for user: ${userId}`);

      const quotaInfo = await userService.getQuotaInfo(userId!);
      const limits = userService.getCurrentLimits();

      const stats = {
        daily: {
          used: quotaInfo.dailyUsage,
          limit: limits.daily,
          remaining: quotaInfo.remainingDaily,
          percentage: Math.round((quotaInfo.dailyUsage / limits.daily) * 100),
        },
        weekly: {
          used: quotaInfo.weeklyUsage,
          limit: limits.weekly,
          remaining: quotaInfo.remainingWeekly,
          percentage: Math.round((quotaInfo.weeklyUsage / limits.weekly) * 100),
        },
        isBeta: quotaInfo.isBeta,
        betaLimitations: betaRestrictionsService.isBetaMode()
          ? betaRestrictionsService.getBetaLimitationsMessage()
          : null,
      };

      logger.info(`Successfully retrieved usage stats for user ${userId}`);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error(
        `Error getting usage stats for user ${req.user?.uid}:`,
        error
      );
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to retrieve usage statistics",
      });
    }
  }
}

export default new QuotaController();
