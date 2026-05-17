import logger from '../config/logger';
import { IRepository } from '../repository/IRepository';
import { RepositoryFactory } from '../repository/RepositoryFactory';

interface TokenUsage {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  userId: string;
  date: string; // YYYY-MM-DD
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  estimatedCost: number; // in USD
  lastUpdated: Date;
}

interface TokenLimit {
  dailyLimit: number;
  monthlyLimit: number;
  costLimit: number; // USD per month
}

interface TokenUsageResult {
  allowed: boolean;
  usage: TokenUsage;
  limits: TokenLimit;
  remaining: {
    dailyTokens: number;
    monthlyTokens: number;
    monthlyCost: number;
  };
  message?: string;
}

class TokenTrackingService {
  private tokenRepository: IRepository<TokenUsage>;
  private readonly DEFAULT_LIMITS: TokenLimit = {
    dailyLimit: parseInt(process.env.DAILY_TOKEN_LIMIT || '100000'), // 100k tokens/day
    monthlyLimit: parseInt(process.env.MONTHLY_TOKEN_LIMIT || '2000000'), // 2M tokens/month
    costLimit: parseFloat(process.env.MONTHLY_COST_LIMIT || '50'), // $50/month
  };

  // Pricing per 1M tokens (approximate)
  private readonly TOKEN_PRICING = {
    'gpt-4': { input: 30, output: 60 }, // $30/$60 per 1M tokens
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 }, // $0.50/$1.50 per 1M tokens
    'gemini-pro': { input: 0.5, output: 1.5 },
    'deepseek-chat': { input: 0.14, output: 0.28 },
    default: { input: 1, output: 2 },
  };

  constructor() {
    this.tokenRepository = RepositoryFactory.getRepository<TokenUsage>();
  }

  /**
   * Track token usage for a request
   */
  async trackTokenUsage(
    userId: string,
    inputTokens: number,
    outputTokens: number,
    model: string = 'default'
  ): Promise<TokenUsageResult> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const totalTokens = inputTokens + outputTokens;

      // Calculate cost
      const pricing = this.TOKEN_PRICING[model as keyof typeof this.TOKEN_PRICING] || this.TOKEN_PRICING.default;
      const cost = (inputTokens / 1000000) * pricing.input + (outputTokens / 1000000) * pricing.output;

      logger.info(
        `Tracking token usage for user ${userId}: input=${inputTokens}, output=${outputTokens}, total=${totalTokens}, cost=$${cost.toFixed(4)}, model=${model}`
      );

      // Get or create today's usage
      let usage = await this.getDailyUsage(userId, today);

      if (!usage) {
        usage = {
          userId,
          date: today,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          requestCount: 0,
          estimatedCost: 0,
          lastUpdated: new Date(),
        };
      }

      // Update usage
      usage.inputTokens += inputTokens;
      usage.outputTokens += outputTokens;
      usage.totalTokens += totalTokens;
      usage.requestCount += 1;
      usage.estimatedCost += cost;
      usage.lastUpdated = new Date();

      // Save to database
      await this.saveUsage(usage);

      // Get monthly usage
      const monthlyUsage = await this.getMonthlyUsage(userId);

      // Check limits
      const limits = await this.getUserLimits(userId);
      const dailyRemaining = Math.max(0, limits.dailyLimit - usage.totalTokens);
      const monthlyRemaining = Math.max(0, limits.monthlyLimit - monthlyUsage.totalTokens);
      const costRemaining = Math.max(0, limits.costLimit - monthlyUsage.estimatedCost);

      const allowed = dailyRemaining > 0 && monthlyRemaining > 0 && costRemaining > 0;

      let message: string | undefined;
      if (!allowed) {
        if (dailyRemaining <= 0) {
          message = `Daily token limit exceeded (${limits.dailyLimit} tokens/day)`;
        } else if (monthlyRemaining <= 0) {
          message = `Monthly token limit exceeded (${limits.monthlyLimit} tokens/month)`;
        } else if (costRemaining <= 0) {
          message = `Monthly cost limit exceeded ($${limits.costLimit}/month)`;
        }
      }

      // Send alerts if approaching limits
      if (dailyRemaining < limits.dailyLimit * 0.2) {
        await this.sendLimitAlert(userId, 'daily', usage.totalTokens, limits.dailyLimit);
      }
      if (monthlyRemaining < limits.monthlyLimit * 0.2) {
        await this.sendLimitAlert(userId, 'monthly', monthlyUsage.totalTokens, limits.monthlyLimit);
      }

      return {
        allowed,
        usage,
        limits,
        remaining: {
          dailyTokens: dailyRemaining,
          monthlyTokens: monthlyRemaining,
          monthlyCost: costRemaining,
        },
        message,
      };
    } catch (error) {
      logger.error(`Error tracking token usage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user can make a request (pre-flight check)
   */
  async checkTokenLimit(userId: string): Promise<{
    allowed: boolean;
    dailyRemaining: number;
    monthlyRemaining: number;
    costRemaining: number;
    message?: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyUsage = await this.getDailyUsage(userId, today);
      const monthlyUsage = await this.getMonthlyUsage(userId);
      const limits = await this.getUserLimits(userId);

      const dailyTokens = dailyUsage?.totalTokens || 0;
      const monthlyTokens = monthlyUsage.totalTokens;
      const monthlyCost = monthlyUsage.estimatedCost;

      const dailyRemaining = Math.max(0, limits.dailyLimit - dailyTokens);
      const monthlyRemaining = Math.max(0, limits.monthlyLimit - monthlyTokens);
      const costRemaining = Math.max(0, limits.costLimit - monthlyCost);

      const allowed = dailyRemaining > 0 && monthlyRemaining > 0 && costRemaining > 0;

      let message: string | undefined;
      if (!allowed) {
        if (dailyRemaining <= 0) {
          message = `Daily token limit exceeded (${limits.dailyLimit} tokens/day)`;
        } else if (monthlyRemaining <= 0) {
          message = `Monthly token limit exceeded (${limits.monthlyLimit} tokens/month)`;
        } else if (costRemaining <= 0) {
          message = `Monthly cost limit exceeded ($${limits.costLimit}/month)`;
        }
      }

      return {
        allowed,
        dailyRemaining,
        monthlyRemaining,
        costRemaining,
        message,
      };
    } catch (error) {
      logger.error(`Error checking token limit for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get daily usage for a user
   */
  private async getDailyUsage(userId: string, date: string): Promise<TokenUsage | null> {
    try {
      if (this.tokenRepository.findOne) {
        const usage = await this.tokenRepository.findOne(
          { userId, date },
          'token_usage'
        );
        return usage;
      }
      // Fallback: use findAll and filter
      const all = await this.tokenRepository.findAll('token_usage');
      return all.find((u) => u.userId === userId && u.date === date) || null;
    } catch (error) {
      logger.error(`Error getting daily usage for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get monthly usage for a user
   */
  async getMonthlyUsage(userId: string): Promise<{
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    requestCount: number;
  }> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      let usages: TokenUsage[];
      if (this.tokenRepository.find) {
        usages = await this.tokenRepository.find(
          {
            userId,
            date: { $gte: monthStart, $lte: monthEnd },
          },
          'token_usage'
        );
      } else {
        // Fallback: use findAll and filter
        const all = await this.tokenRepository.findAll('token_usage');
        usages = all.filter(
          (u) => u.userId === userId && u.date >= monthStart && u.date <= monthEnd
        );
      }

      interface MonthlyTotals {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        estimatedCost: number;
        requestCount: number;
      }

      const totals = usages.reduce(
        (acc: MonthlyTotals, usage: TokenUsage) => ({
          totalTokens: acc.totalTokens + usage.totalTokens,
          inputTokens: acc.inputTokens + usage.inputTokens,
          outputTokens: acc.outputTokens + usage.outputTokens,
          estimatedCost: acc.estimatedCost + usage.estimatedCost,
          requestCount: acc.requestCount + usage.requestCount,
        }),
        { totalTokens: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0, requestCount: 0 }
      );

      return totals;
    } catch (error) {
      logger.error(`Error getting monthly usage for user ${userId}:`, error);
      return { totalTokens: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0, requestCount: 0 };
    }
  }

  /**
   * Get user token limits
   */
  private async getUserLimits(userId: string): Promise<TokenLimit> {
    // TODO: Get user-specific limits from database if they have a subscription
    // For now, return default limits
    return this.DEFAULT_LIMITS;
  }

  /**
   * Save usage to database
   */
  private async saveUsage(usage: TokenUsage): Promise<void> {
    try {
      const existing = await this.getDailyUsage(usage.userId, usage.date);

      if (existing && existing.id) {
        await this.tokenRepository.update(
          existing.id,
          usage,
          'token_usage'
        );
      } else {
        await this.tokenRepository.create(usage, 'token_usage');
      }

      logger.info(
        `Token usage saved for user ${usage.userId}: ${usage.totalTokens} tokens, $${usage.estimatedCost.toFixed(4)}`
      );
    } catch (error) {
      logger.error(`Error saving token usage:`, error);
      throw error;
    }
  }

  /**
   * Send alert when approaching limits
   */
  private async sendLimitAlert(
    userId: string,
    type: 'daily' | 'monthly',
    current: number,
    limit: number
  ): Promise<void> {
    const percentage = (current / limit) * 100;

    if (percentage >= 80 && percentage < 90) {
      logger.warn(`User ${userId} at 80% of ${type} token limit: ${current}/${limit}`);
      // TODO: Send email/notification to user
    } else if (percentage >= 90 && percentage < 100) {
      logger.warn(`User ${userId} at 90% of ${type} token limit: ${current}/${limit}`);
      // TODO: Send urgent email/notification to user
    } else if (percentage >= 100) {
      logger.error(`User ${userId} exceeded ${type} token limit: ${current}/${limit}`);
      // TODO: Send critical alert to user
    }
  }

  /**
   * Get usage statistics for dashboard
   */
  async getUsageStats(userId: string): Promise<{
    today: TokenUsage | null;
    thisMonth: {
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCost: number;
      requestCount: number;
    };
    limits: TokenLimit;
    percentages: {
      daily: number;
      monthly: number;
      cost: number;
    };
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyUsage = await this.getDailyUsage(userId, today);
      const monthlyUsage = await this.getMonthlyUsage(userId);
      const limits = await this.getUserLimits(userId);

      const dailyTokens = dailyUsage?.totalTokens || 0;
      const monthlyTokens = monthlyUsage.totalTokens;
      const monthlyCost = monthlyUsage.estimatedCost;

      return {
        today: dailyUsage,
        thisMonth: monthlyUsage,
        limits,
        percentages: {
          daily: (dailyTokens / limits.dailyLimit) * 100,
          monthly: (monthlyTokens / limits.monthlyLimit) * 100,
          cost: (monthlyCost / limits.costLimit) * 100,
        },
      };
    } catch (error) {
      logger.error(`Error getting usage stats for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reset daily usage (admin function)
   */
  async resetDailyUsage(userId: string, date: string): Promise<boolean> {
    try {
      // Find the document first to get its ID
      const usage = await this.getDailyUsage(userId, date);
      if (usage && usage.id) {
        await this.tokenRepository.delete(usage.id, 'token_usage');
      }
      logger.info(`Daily usage reset for user ${userId} on ${date}`);
      return true;
    } catch (error) {
      logger.error(`Error resetting daily usage for user ${userId}:`, error);
      return false;
    }
  }
}

// Singleton instance
const tokenTrackingService = new TokenTrackingService();

export default tokenTrackingService;
