import { userService } from '../services/user.service';
import logger from '../config/logger';

/**
 * Check if user has unlimited quota based on their email
 */
export const hasUnlimitedQuota = async (userId: string): Promise<boolean> => {
  try {
    const unlimitedEmails = process.env.UNLIMITED_QUOTA_EMAILS;

    if (!unlimitedEmails) {
      return false;
    }

    // Get user email using the service method
    const userEmail = await userService.getUserEmail(userId);

    if (!userEmail) {
      return false;
    }

    // Parse the comma-separated list of unlimited emails
    const emailList = unlimitedEmails.split(',').map(email => email.trim().toLowerCase());

    return emailList.includes(userEmail.toLowerCase());
  } catch (error) {
    logger.error('Error checking unlimited quota status:', error);
    return false;
  }
};

/**
 * Check quota for user, taking into account unlimited quota users
 */
export const checkUserQuota = async (userId: string): Promise<{ allowed: boolean; isUnlimited: boolean; message?: string; remainingDaily?: number; remainingWeekly?: number }> => {
  try {
    // Check if user has unlimited quota first
    const isUnlimited = await hasUnlimitedQuota(userId);

    if (isUnlimited) {
      logger.info(`User ${userId} has unlimited quota, skipping quota check`);
      return {
        allowed: true,
        isUnlimited: true,
        remainingDaily: Infinity,
        remainingWeekly: Infinity
      };
    }

    // Normal quota check
    const quotaCheck = await userService.checkQuota(userId);

    return {
      allowed: quotaCheck.allowed,
      isUnlimited: false,
      message: quotaCheck.message,
      remainingDaily: quotaCheck.remainingDaily,
      remainingWeekly: quotaCheck.remainingWeekly
    };
  } catch (error) {
    logger.error('Error checking user quota:', error);
    return {
      allowed: false,
      isUnlimited: false,
      message: 'Error checking quota'
    };
  }
};
