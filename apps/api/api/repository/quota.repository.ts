import { MongoClient, Db, Collection } from 'mongodb';
import logger from '../config/logger';

export interface QuotaIncrementResult {
  success: boolean;
  dailyUsage: number;
  weeklyUsage: number;
  dailyLimit: number;
  weeklyLimit: number;
  quotaExceeded: boolean;
  message?: string;
}

export class QuotaRepository {
  private db: Db | null = null;
  private usersCollection: Collection | null = null;

  constructor(db: Db) {
    this.db = db;
    this.usersCollection = db.collection('users');
  }

  /**
   * Increment quota atomically using MongoDB $inc operator
   * This prevents race conditions
   */
  async incrementQuotaAtomic(
    userId: string,
    incrementValue: number,
    dailyLimit: number,
    weeklyLimit: number
  ): Promise<QuotaIncrementResult> {
    try {
      logger.info(
        `Atomic quota increment for user ${userId}: +${incrementValue} (limits: daily=${dailyLimit}, weekly=${weeklyLimit})`
      );

      // Get current date for reset checks
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const weekStart = this.getWeekStart(now).toISOString().split('T')[0];

      // First, check if we need to reset counters
      const user = await this.usersCollection!.findOne({ uid: userId });

      if (!user) {
        logger.error(`User ${userId} not found for quota increment`);
        return {
          success: false,
          dailyUsage: 0,
          weeklyUsage: 0,
          dailyLimit,
          weeklyLimit,
          quotaExceeded: false,
          message: 'User not found',
        };
      }

      // Prepare update operations
      const updateOps: any = {
        $inc: {},
        $set: {},
      };

      // Check if daily reset is needed
      if (!user.quota?.lastResetDaily || user.quota.lastResetDaily !== today) {
        updateOps.$set['quota.dailyUsage'] = incrementValue;
        updateOps.$set['quota.lastResetDaily'] = today;
        logger.info(`Resetting daily quota for user ${userId}`);
      } else {
        updateOps.$inc['quota.dailyUsage'] = incrementValue;
      }

      // Check if weekly reset is needed
      if (!user.quota?.lastResetWeekly || user.quota.lastResetWeekly !== weekStart) {
        updateOps.$set['quota.weeklyUsage'] = incrementValue;
        updateOps.$set['quota.lastResetWeekly'] = weekStart;
        logger.info(`Resetting weekly quota for user ${userId}`);
      } else {
        updateOps.$inc['quota.weeklyUsage'] = incrementValue;
      }

      // Update limits if they changed
      updateOps.$set['quota.dailyLimit'] = dailyLimit;
      updateOps.$set['quota.weeklyLimit'] = weeklyLimit;
      updateOps.$set['quota.quotaUpdatedAt'] = now;

      // Perform atomic update
      const result = await this.usersCollection!.findOneAndUpdate(
        { uid: userId },
        updateOps,
        { returnDocument: 'after' }
      );

      if (!result) {
        logger.error(`Failed to update quota for user ${userId}`);
        return {
          success: false,
          dailyUsage: 0,
          weeklyUsage: 0,
          dailyLimit,
          weeklyLimit,
          quotaExceeded: false,
          message: 'Update failed',
        };
      }

      const updatedQuota = result.quota;
      const dailyUsage = updatedQuota.dailyUsage || 0;
      const weeklyUsage = updatedQuota.weeklyUsage || 0;

      // Check if quota is exceeded after increment
      const quotaExceeded = dailyUsage > dailyLimit || weeklyUsage > weeklyLimit;

      if (quotaExceeded) {
        logger.warn(
          `Quota exceeded for user ${userId}: daily=${dailyUsage}/${dailyLimit}, weekly=${weeklyUsage}/${weeklyLimit}`
        );
      }

      logger.info(
        `Quota incremented successfully for user ${userId}: daily=${dailyUsage}/${dailyLimit}, weekly=${weeklyUsage}/${weeklyLimit}`
      );

      return {
        success: true,
        dailyUsage,
        weeklyUsage,
        dailyLimit,
        weeklyLimit,
        quotaExceeded,
        message: quotaExceeded ? 'Quota exceeded' : undefined,
      };
    } catch (error) {
      logger.error(`Error incrementing quota for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check quota without incrementing (for pre-flight checks)
   */
  async checkQuotaAvailable(
    userId: string,
    dailyLimit: number,
    weeklyLimit: number
  ): Promise<{
    allowed: boolean;
    remainingDaily: number;
    remainingWeekly: number;
    message?: string;
  }> {
    try {
      const user = await this.usersCollection!.findOne({ uid: userId });

      if (!user || !user.quota) {
        return {
          allowed: true,
          remainingDaily: dailyLimit,
          remainingWeekly: weeklyLimit,
        };
      }

      // Check if reset is needed
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const weekStart = this.getWeekStart(now).toISOString().split('T')[0];

      let dailyUsage = user.quota.dailyUsage || 0;
      let weeklyUsage = user.quota.weeklyUsage || 0;

      // Reset if needed
      if (user.quota.lastResetDaily !== today) {
        dailyUsage = 0;
      }
      if (user.quota.lastResetWeekly !== weekStart) {
        weeklyUsage = 0;
      }

      const remainingDaily = Math.max(0, dailyLimit - dailyUsage);
      const remainingWeekly = Math.max(0, weeklyLimit - weeklyUsage);

      const allowed = remainingDaily > 0 && remainingWeekly > 0;

      let message: string | undefined;
      if (!allowed) {
        if (remainingDaily <= 0) {
          message = `Daily quota exceeded (${dailyLimit} requests/day)`;
        } else if (remainingWeekly <= 0) {
          message = `Weekly quota exceeded (${weeklyLimit} requests/week)`;
        }
      }

      return {
        allowed,
        remainingDaily,
        remainingWeekly,
        message,
      };
    } catch (error) {
      logger.error(`Error checking quota for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get quota usage statistics
   */
  async getQuotaStats(userId: string): Promise<{
    dailyUsage: number;
    weeklyUsage: number;
    dailyLimit: number;
    weeklyLimit: number;
    lastResetDaily: string;
    lastResetWeekly: string;
  } | null> {
    try {
      const user = await this.usersCollection!.findOne({ uid: userId });

      if (!user || !user.quota) {
        return null;
      }

      return {
        dailyUsage: user.quota.dailyUsage || 0,
        weeklyUsage: user.quota.weeklyUsage || 0,
        dailyLimit: user.quota.dailyLimit || 0,
        weeklyLimit: user.quota.weeklyLimit || 0,
        lastResetDaily: user.quota.lastResetDaily || '',
        lastResetWeekly: user.quota.lastResetWeekly || '',
      };
    } catch (error) {
      logger.error(`Error getting quota stats for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Reset quota for a user (admin function)
   */
  async resetQuota(userId: string): Promise<boolean> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const weekStart = this.getWeekStart(now).toISOString().split('T')[0];

      const result = await this.usersCollection!.updateOne(
        { uid: userId },
        {
          $set: {
            'quota.dailyUsage': 0,
            'quota.weeklyUsage': 0,
            'quota.lastResetDaily': today,
            'quota.lastResetWeekly': weekStart,
            'quota.quotaUpdatedAt': now,
          },
        }
      );

      logger.info(`Quota reset for user ${userId}: ${result.modifiedCount} documents modified`);
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error(`Error resetting quota for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get start of week (Monday) for a given date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  /**
   * Get users exceeding quota (for monitoring)
   */
  async getUsersExceedingQuota(): Promise<
    Array<{
      uid: string;
      email: string;
      dailyUsage: number;
      dailyLimit: number;
      weeklyUsage: number;
      weeklyLimit: number;
    }>
  > {
    try {
      const users = await this.usersCollection!
        .find({
          $or: [
            { $expr: { $gt: ['$quota.dailyUsage', '$quota.dailyLimit'] } },
            { $expr: { $gt: ['$quota.weeklyUsage', '$quota.weeklyLimit'] } },
          ],
        })
        .project({
          uid: 1,
          email: 1,
          'quota.dailyUsage': 1,
          'quota.dailyLimit': 1,
          'quota.weeklyUsage': 1,
          'quota.weeklyLimit': 1,
        })
        .toArray();

      return users.map((user: any) => ({
        uid: user.uid,
        email: user.email,
        dailyUsage: user.quota?.dailyUsage || 0,
        dailyLimit: user.quota?.dailyLimit || 0,
        weeklyUsage: user.quota?.weeklyUsage || 0,
        weeklyLimit: user.quota?.weeklyLimit || 0,
      }));
    } catch (error) {
      logger.error('Error getting users exceeding quota:', error);
      return [];
    }
  }
}
