import { Request, Response, NextFunction } from "express";
import { userService } from "../services/user.service";
import betaRestrictionsService from "../services/betaRestrictions.service";
import logger from "../config/logger";

export interface CustomRequest extends Request {
  user: {
    uid: string;
    [key: string]: any;
  };
}

/**
 * Middleware to check user quota before processing requests
 */
export const checkQuota = async (
  req: Request & { user?: { uid: string } },
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      logger.warn("Quota middleware: No user ID found in request");
      res.status(401).json({
        error: "Authentication required",
        message: "User must be authenticated to access this resource",
      });
      return;
    }

    logger.info(`Quota middleware: Checking quota for user ${userId}`);

    const quotaCheck = await userService.checkQuota(userId);

    if (!quotaCheck.allowed) {
      logger.warn(
        `Quota middleware: Quota exceeded for user ${userId}: ${quotaCheck.message}`
      );

      // Include quota information in the response
      const quotaInfo = await userService.getQuotaInfo(userId);

      res.status(429).json({
        error: "Quota exceeded",
        message: quotaCheck.message,
        quota: quotaInfo,
        betaLimitations: betaRestrictionsService.isBetaMode()
          ? betaRestrictionsService.getBetaLimitationsMessage()
          : null,
      });
      return;
    }

    // Add quota info to request for controllers to use
    (req as any).quotaInfo = {
      remainingDaily: quotaCheck.remainingDaily,
      remainingWeekly: quotaCheck.remainingWeekly,
      isBeta: betaRestrictionsService.isBetaMode(),
    };

    logger.info(`Quota middleware: Quota check passed for user ${userId}`);
    next();
  } catch (error) {
    logger.error("Quota middleware error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to check quota",
    });
  }
};

/**
 * Middleware to validate feature access in beta mode
 */
export const checkFeatureAccess = (featureName: string) => {
  return (
    req: Request & { user?: { uid: string } },
    res: Response,
    next: NextFunction
  ): void => {
    try {
      logger.info(
        `Feature access middleware: Checking feature '${featureName}' for user ${req.user?.uid}`
      );

      const featureValidation =
        betaRestrictionsService.validateFeature(featureName);

      if (!featureValidation.allowed) {
        logger.warn(`Feature access denied: ${featureValidation.message}`);
        res.status(403).json({
          error: "Feature not available",
          message: featureValidation.message,
          betaLimitations: betaRestrictionsService.getBetaLimitationsMessage(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error("Feature access middleware error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to check feature access",
      });
    }
  };
};

/**
 * Middleware to validate input content
 */
export const validateInput = (inputField: string = "content") => {
  return (
    req: Request & { user?: { uid: string } },
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const input = req.body[inputField];

      if (!input) {
        logger.warn(`Input validation: Missing ${inputField} in request body`);
        res.status(400).json({
          error: "Invalid input",
          message: `${inputField} is required`,
        });
        return;
      }

      logger.info(
        `Input validation: Validating ${inputField} for user ${req.user?.uid}`
      );

      const inputValidation = betaRestrictionsService.validateInput(input);

      if (!inputValidation.allowed) {
        logger.warn(`Input validation failed: ${inputValidation.message}`);
        res.status(400).json({
          error: "Invalid input",
          message: inputValidation.message,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error("Input validation middleware error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to validate input",
      });
    }
  };
};

/**
 * Middleware to add beta information to responses
 */
export const addBetaInfo = (
  req: Request & { user?: { uid: string } },
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json;

  res.json = function (body: any) {
    if (betaRestrictionsService.isBetaMode()) {
      const enhancedBody = {
        ...body,
        betaInfo: {
          isBeta: true,
          limitations: betaRestrictionsService.getBetaLimitationsMessage(),
          restrictions: betaRestrictionsService.getRestrictions(),
        },
      };
      return originalJson.call(this, enhancedBody);
    }
    return originalJson.call(this, body);
  };

  next();
};
