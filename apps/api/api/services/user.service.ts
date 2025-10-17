import { admin } from "..";
import logger from "../config/logger";
import { QuotaData, UserModel } from "../models/userModel";
import { IRepository } from "../repository/IRepository";
import { RepositoryFactory } from "../repository/RepositoryFactory";

export interface QuotaLimits {
  dailyLimit: number;
  weeklyLimit: number;
  betaDailyLimit: number;
  betaWeeklyLimit: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  remainingDaily: number;
  remainingWeekly: number;
  message?: string;
}
class UserService {
  private userRepository: IRepository<UserModel>;
  private isBeta: boolean;
  private quotaLimits: QuotaLimits;
  constructor() {
    this.userRepository = RepositoryFactory.getRepository<UserModel>();

    this.isBeta = process.env.IS_BETA === "true";

    // Configure quota limits based on environment
    this.quotaLimits = {
      dailyLimit: parseInt(process.env.DAILY_QUOTA_LIMIT || "50"),
      weeklyLimit: parseInt(process.env.WEEKLY_QUOTA_LIMIT || "200"),
      betaDailyLimit: parseInt(process.env.BETA_DAILY_QUOTA_LIMIT || "20"),
      betaWeeklyLimit: parseInt(process.env.BETA_WEEKLY_QUOTA_LIMIT || "200"),
    };

    logger.info(
      `QuotaService initialized - Beta mode: ${this.isBeta}, Limits:`,
      this.quotaLimits
    );
  }

  public async createUser(user: UserModel): Promise<UserModel> {
    if (!user) {
      logger.warn("createUser failed: No user data provided.");
      throw new Error("No user data provided.");
    }

    try {
      user.quota = {
        dailyUsage: 0,
        weeklyUsage: 0,
        dailyLimit: this.isBeta
          ? this.quotaLimits.betaDailyLimit
          : this.quotaLimits.dailyLimit,
        weeklyLimit: this.isBeta
          ? this.quotaLimits.betaWeeklyLimit
          : this.quotaLimits.weeklyLimit,
        lastResetDaily: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        lastResetWeekly: this.getWeekStart(new Date())
          .toISOString()
          .split("T")[0],
      };
      const createdUser = await this.userRepository.create(
        user,
        "users",
        user.uid
      );
      logger.info(`User created successfully: ${createdUser.uid}`);
      return createdUser;
    } catch (error: any) {
      logger.error(`Error creating user: ${error.message}`, {
        stack: error.stack,
        details: error,
      });
      throw error;
    }
  }

  public async getUserProfile(sessionCookie: string): Promise<UserModel> {
    logger.info("Attempting to get user profile from session cookie.");
    if (!sessionCookie) {
      logger.warn("getUserProfile failed: No session cookie provided.");
      throw new Error("No session cookie provided.");
    }

    try {
      // Verify the session cookie
      const decodedToken = await admin
        .auth()
        .verifySessionCookie(sessionCookie, true);
      const { uid } = decodedToken;

      logger.info(
        `Session cookie verified for UID: ${uid}. Fetching user profile.`
      );

      // Get user from Firebase Auth
      const userRecord = await admin.auth().getUser(uid);

      // Get user data from repository
      let user: UserModel | null = await this.userRepository.findById(
        uid,
        "users"
      );

      if (!user) {
        // User doesn't exist in repository, create a new user
        logger.info(
          `User ${uid} not found in repository, creating new user record`
        );

        user = await this.userRepository.create(
          {
            uid: uid,
            email: userRecord.email || "",
            displayName: userRecord.displayName || "",
            photoURL: userRecord.photoURL || "",
            subscription: "free", // Default subscription
            lastLogin: new Date(),
            quota: {
              dailyUsage: 0,
              weeklyUsage: 0,
              dailyLimit: this.quotaLimits.dailyLimit,
              weeklyLimit: this.quotaLimits.weeklyLimit,
              lastResetDaily: new Date().toISOString().split("T")[0],
              lastResetWeekly: this.getWeekStart(new Date())
                .toISOString()
                .split("T")[0],
            },
            roles: ["user"],
          },
          "users",
          uid
        );
      } else {
        // Update existing user's lastLogin
        logger.info(`Updating lastLogin for user ${uid}`);
        if (!user.quota) {
          user.quota = {
            dailyUsage: this.quotaLimits.dailyLimit,
            weeklyUsage: this.quotaLimits.weeklyLimit,
            lastResetDaily: new Date().toISOString().split("T")[0],
            lastResetWeekly: new Date().toISOString().split("T")[0],
          };
        }
        user =
          (await this.userRepository.update(
            uid,
            {
              lastLogin: new Date(),
              quota: user.quota, // Ensure quota is preserved
            },
            "users"
          )) || user;
      }

      logger.info(`Successfully fetched profile for user: ${uid}`);
      return user;
    } catch (error: any) {
      logger.error(`Error in getUserProfile: ${error.message}`, {
        stack: error.stack,
      });
      throw new Error(error.message || "Invalid or expired session.");
    }
  }

  /**
   * Check if user can make a request based on their quota
   */
  async checkQuota(userId: string): Promise<QuotaCheckResult> {
    try {
      logger.info(`Checking quota for user: ${userId}`);

      // Get or create user quota
      let quotaData = await this.getUserQuota(userId);
      if (!quotaData) {
        quotaData = await this.createUserQuota(userId);
      }

      // Reset counters if needed
      quotaData = await this.resetCountersIfNeeded(userId, quotaData);

      const currentLimits = this.isBeta
        ? {
            daily: this.quotaLimits.betaDailyLimit,
            weekly: this.quotaLimits.betaWeeklyLimit,
          }
        : {
            daily: this.quotaLimits.dailyLimit,
            weekly: this.quotaLimits.weeklyLimit,
          };

      const remainingDaily = Math.max(
        0,
        currentLimits.daily - quotaData.dailyUsage
      );
      const remainingWeekly = Math.max(
        0,
        currentLimits.weekly - quotaData.weeklyUsage
      );

      const allowed = remainingDaily > 0 && remainingWeekly > 0;

      let message: string | undefined;
      if (!allowed) {
        if (remainingDaily <= 0) {
          message = this.isBeta
            ? `Daily beta quota exceeded (${currentLimits.daily} requests/day)`
            : `Daily quota exceeded (${currentLimits.daily} requests/day)`;
        } else if (remainingWeekly <= 0) {
          message = this.isBeta
            ? `Weekly beta quota exceeded (${currentLimits.weekly} requests/week)`
            : `Weekly quota exceeded (${currentLimits.weekly} requests/week)`;
        }
      }

      logger.info(
        `Quota check result for user ${userId}: allowed=${allowed}, remainingDaily=${remainingDaily}, remainingWeekly=${remainingWeekly}`
      );

      return {
        allowed,
        remainingDaily,
        remainingWeekly,
        message,
      };
    } catch (error) {
      logger.error(`Error checking quota for user ${userId}:`, error);
      throw new Error(`Failed to check quota: ${(error as Error).message}`);
    }
  }

  /**
   * Increment user's usage counters
   */
  async incrementUsage(userId: string, incrementValue: number): Promise<void> {
    try {
      logger.info(`Incrementing usage for user: ${userId}`);

      let quotaData = await this.getUserQuota(userId);
      if (!quotaData) {
        quotaData = await this.createUserQuota(userId);
      }

      // Increment counters
      quotaData.dailyUsage += incrementValue;
      quotaData.weeklyUsage += incrementValue;

      // Update user document with incremented quota
      await this.userRepository.update(
        userId,
        {
          quota: {
            dailyUsage: quotaData.dailyUsage,
            weeklyUsage: quotaData.weeklyUsage,
            lastResetDaily: quotaData.lastResetDaily,
            lastResetWeekly: quotaData.lastResetWeekly,
          },
        },
        "users"
      );

      logger.info(
        `Usage incremented for user ${userId}: daily=${quotaData.dailyUsage}, weekly=${quotaData.weeklyUsage}`
      );
    } catch (error) {
      logger.error(`Error incrementing usage for user ${userId}:`, error);
      throw new Error(`Failed to increment usage: ${(error as Error).message}`);
    }
  }

  /**
   * Get user quota information for display
   */
  async getQuotaInfo(userId: string): Promise<{
    dailyUsage: number;
    weeklyUsage: number;
    dailyLimit: number;
    weeklyLimit: number;
    remainingDaily: number;
    remainingWeekly: number;
    isBeta: boolean;
  }> {
    try {
      logger.info(`Getting quota info for user: ${userId}`);

      let quotaData = await this.getUserQuota(userId);
      if (!quotaData) {
        quotaData = await this.createUserQuota(userId);
      }

      quotaData = await this.resetCountersIfNeeded(userId, quotaData);

      const currentLimits = this.isBeta
        ? {
            daily: this.quotaLimits.betaDailyLimit,
            weekly: this.quotaLimits.betaWeeklyLimit,
          }
        : {
            daily: this.quotaLimits.dailyLimit,
            weekly: this.quotaLimits.weeklyLimit,
          };

      const remainingDaily = Math.max(
        0,
        currentLimits.daily - quotaData.dailyUsage
      );
      const remainingWeekly = Math.max(
        0,
        currentLimits.weekly - quotaData.weeklyUsage
      );

      return {
        dailyUsage: quotaData.dailyUsage,
        weeklyUsage: quotaData.weeklyUsage,
        dailyLimit: currentLimits.daily,
        weeklyLimit: currentLimits.weekly,
        remainingDaily,
        remainingWeekly,
        isBeta: this.isBeta,
      };
    } catch (error) {
      logger.error(`Error getting quota info for user ${userId}:`, error);
      throw new Error(`Failed to get quota info: ${(error as Error).message}`);
    }
  }

  /**
   * Get user quota data from user document
   */
  private async getUserQuota(userId: string): Promise<QuotaData | null> {
    try {
      const user: UserModel | null = await this.userRepository.findById(
        userId,
        "users"
      );

      if (!user) {
        logger.warn(`User ${userId} not found when getting quota data`);
        return null;
      }

      // Check if user has quota data
      if (
        !user.quota ||
        user.quota.dailyUsage === undefined ||
        user.quota.weeklyUsage === undefined ||
        !user.quota.lastResetDaily ||
        !user.quota.lastResetWeekly
      ) {
        logger.info(`User ${userId} has no quota data yet`);
        return null;
      }

      return {
        dailyUsage: user.quota.dailyUsage,
        weeklyUsage: user.quota.weeklyUsage,
        dailyLimit: user.quota.dailyLimit!,
        weeklyLimit: user.quota.weeklyLimit!,
        lastResetDaily: user.quota.lastResetDaily,
        lastResetWeekly: user.quota.lastResetWeekly,
      };
    } catch (error) {
      logger.error(`Error getting user quota for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Initialize quota data for a user
   */
  private async createUserQuota(userId: string): Promise<QuotaData> {
    const now = new Date();
    const quotaData: QuotaData = {
      dailyUsage: 0,
      weeklyUsage: 0,
      dailyLimit: this.quotaLimits.dailyLimit,
      weeklyLimit: this.quotaLimits.weeklyLimit,
      lastResetDaily: now.toISOString().split("T")[0], // YYYY-MM-DD
      lastResetWeekly: this.getWeekStart(now).toISOString().split("T")[0],
    };

    // Update the user document with quota data
    await this.userRepository.update(
      userId,
      {
        quota: {
          dailyUsage: quotaData.dailyUsage,
          weeklyUsage: quotaData.weeklyUsage,
          dailyLimit: quotaData.dailyLimit,
          weeklyLimit: quotaData.weeklyLimit,
          lastResetDaily: quotaData.lastResetDaily,
          lastResetWeekly: quotaData.lastResetWeekly,
        },
      },
      "users"
    );

    logger.info(`Created new quota data for user ${userId}`);
    return quotaData;
  }

  /**
   * Reset counters if day/week has changed
   */
  private async resetCountersIfNeeded(
    userId: string,
    quotaData: QuotaData
  ): Promise<QuotaData> {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const weekStart = this.getWeekStart(now).toISOString().split("T")[0];

    let needsUpdate = false;
    const updatedQuotaData = { ...quotaData };

    // Reset daily counter if new day
    if (updatedQuotaData.lastResetDaily !== today) {
      updatedQuotaData.dailyUsage = 0;
      updatedQuotaData.lastResetDaily = today;
      needsUpdate = true;
      logger.info(`Reset daily counter for user ${userId}`);
    }

    // Reset weekly counter if new week
    if (updatedQuotaData.lastResetWeekly !== weekStart) {
      updatedQuotaData.weeklyUsage = 0;
      updatedQuotaData.lastResetWeekly = weekStart;
      needsUpdate = true;
      logger.info(`Reset weekly counter for user ${userId}`);
    }

    if (needsUpdate) {
      // Update the user document with reset quota data
      await this.userRepository.update(
        userId,
        {
          quota: {
            dailyUsage: updatedQuotaData.dailyUsage,
            weeklyUsage: updatedQuotaData.weeklyUsage,
            lastResetDaily: updatedQuotaData.lastResetDaily,
            lastResetWeekly: updatedQuotaData.lastResetWeekly,
          },
        },
        "users"
      );
    }

    return updatedQuotaData;
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
   * Check if beta mode is enabled
   */
  isBetaMode(): boolean {
    return this.isBeta;
  }

  /**
   * Get current quota limits
   */
  getCurrentLimits(): { daily: number; weekly: number } {
    return this.isBeta
      ? {
          daily: this.quotaLimits.betaDailyLimit,
          weekly: this.quotaLimits.betaWeeklyLimit,
        }
      : {
          daily: this.quotaLimits.dailyLimit,
          weekly: this.quotaLimits.weeklyLimit,
        };
  }
}

export const userService = new UserService();
