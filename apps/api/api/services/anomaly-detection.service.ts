import logger from '../config/logger';
import { userService } from './user.service';

interface UserActivity {
  userId: string;
  timestamp: number;
  endpoint: string;
  ip: string;
}

interface AnomalyAlert {
  userId: string;
  type: 'high_frequency' | 'unusual_pattern' | 'quota_abuse' | 'burst_attack';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: number;
}

interface UserStats {
  requestCount: number;
  firstRequest: number;
  lastRequest: number;
  endpoints: Set<string>;
  ips: Set<string>;
}

class AnomalyDetectionService {
  private activityWindow: Map<string, UserActivity[]> = new Map();
  private blockedUsers: Map<string, number> = new Map(); // userId -> unblock timestamp
  private userStats: Map<string, UserStats> = new Map();
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Track user activity
   */
  trackActivity(userId: string, endpoint: string, ip: string): void {
    const activity: UserActivity = {
      userId,
      timestamp: Date.now(),
      endpoint,
      ip,
    };

    // Add to activity window
    if (!this.activityWindow.has(userId)) {
      this.activityWindow.set(userId, []);
    }
    this.activityWindow.get(userId)!.push(activity);

    // Update user stats
    this.updateUserStats(userId, activity);

    // Check for anomalies
    this.checkForAnomalies(userId);
  }

  /**
   * Update user statistics
   */
  private updateUserStats(userId: string, activity: UserActivity): void {
    if (!this.userStats.has(userId)) {
      this.userStats.set(userId, {
        requestCount: 0,
        firstRequest: activity.timestamp,
        lastRequest: activity.timestamp,
        endpoints: new Set(),
        ips: new Set(),
      });
    }

    const stats = this.userStats.get(userId)!;
    stats.requestCount++;
    stats.lastRequest = activity.timestamp;
    stats.endpoints.add(activity.endpoint);
    stats.ips.add(activity.ip);
  }

  /**
   * Check for anomalies in user activity
   */
  private async checkForAnomalies(userId: string): Promise<void> {
    const activities = this.activityWindow.get(userId) || [];
    const now = Date.now();

    // Clean old activities
    const recentActivities = activities.filter((a) => now - a.timestamp < this.WINDOW_MS);
    this.activityWindow.set(userId, recentActivities);

    // Check 1: High frequency (>50 requests in 5 minutes)
    const last5Min = recentActivities.filter((a) => now - a.timestamp < 5 * 60 * 1000);
    if (last5Min.length > 50) {
      await this.handleAnomaly({
        userId,
        type: 'high_frequency',
        severity: 'high',
        message: `High frequency detected: ${last5Min.length} requests in 5 minutes`,
        details: { requestCount: last5Min.length, timeWindow: '5min' },
        timestamp: now,
      });
    }

    // Check 2: Burst attack (>20 requests in 1 minute)
    const last1Min = recentActivities.filter((a) => now - a.timestamp < 60 * 1000);
    if (last1Min.length > 20) {
      await this.handleAnomaly({
        userId,
        type: 'burst_attack',
        severity: 'critical',
        message: `Burst attack detected: ${last1Min.length} requests in 1 minute`,
        details: { requestCount: last1Min.length, timeWindow: '1min' },
        timestamp: now,
      });
    }

    // Check 3: Multiple IPs (possible account sharing or bot)
    const stats = this.userStats.get(userId);
    if (stats && stats.ips.size > 5) {
      await this.handleAnomaly({
        userId,
        type: 'unusual_pattern',
        severity: 'medium',
        message: `Multiple IPs detected: ${stats.ips.size} different IPs`,
        details: { ipCount: stats.ips.size, ips: Array.from(stats.ips) },
        timestamp: now,
      });
    }

    // Check 4: Quota abuse (check if user is consistently hitting limits)
    try {
      const quotaInfo = await userService.getQuotaInfo(userId);
      const dailyUsagePercent = (quotaInfo.dailyUsage / quotaInfo.dailyLimit) * 100;
      const weeklyUsagePercent = (quotaInfo.weeklyUsage / quotaInfo.weeklyLimit) * 100;

      if (dailyUsagePercent > 95 || weeklyUsagePercent > 95) {
        await this.handleAnomaly({
          userId,
          type: 'quota_abuse',
          severity: 'medium',
          message: `Quota near limit: daily=${dailyUsagePercent.toFixed(1)}%, weekly=${weeklyUsagePercent.toFixed(1)}%`,
          details: {
            dailyUsage: quotaInfo.dailyUsage,
            dailyLimit: quotaInfo.dailyLimit,
            weeklyUsage: quotaInfo.weeklyUsage,
            weeklyLimit: quotaInfo.weeklyLimit,
          },
          timestamp: now,
        });
      }
    } catch (error) {
      logger.error(`Error checking quota for anomaly detection: ${userId}`, error);
    }
  }

  /**
   * Handle detected anomaly
   */
  private async handleAnomaly(alert: AnomalyAlert): Promise<void> {
    logger.warn(`ANOMALY DETECTED:`, alert);

    // Auto-block for critical anomalies
    if (alert.severity === 'critical') {
      this.blockUser(alert.userId, 15 * 60 * 1000); // Block for 15 minutes
      logger.error(`User ${alert.userId} temporarily blocked due to critical anomaly`);
    }

    // Send alert to admin (implement webhook/email here)
    await this.sendAlertToAdmin(alert);

    // Store alert in database (implement if needed)
    // await this.storeAlert(alert);
  }

  /**
   * Block user temporarily
   */
  blockUser(userId: string, durationMs: number): void {
    const unblockTime = Date.now() + durationMs;
    this.blockedUsers.set(userId, unblockTime);
    logger.warn(`User ${userId} blocked until ${new Date(unblockTime).toISOString()}`);
  }

  /**
   * Check if user is blocked
   */
  isUserBlocked(userId: string): boolean {
    const unblockTime = this.blockedUsers.get(userId);
    if (!unblockTime) return false;

    const now = Date.now();
    if (now >= unblockTime) {
      this.blockedUsers.delete(userId);
      logger.info(`User ${userId} unblocked`);
      return false;
    }

    return true;
  }

  /**
   * Get time until user is unblocked
   */
  getBlockedTimeRemaining(userId: string): number {
    const unblockTime = this.blockedUsers.get(userId);
    if (!unblockTime) return 0;

    const remaining = unblockTime - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Unblock user manually (admin function)
   */
  unblockUser(userId: string): boolean {
    const wasBlocked = this.blockedUsers.has(userId);
    this.blockedUsers.delete(userId);
    if (wasBlocked) {
      logger.info(`User ${userId} manually unblocked`);
    }
    return wasBlocked;
  }

  /**
   * Send alert to admin
   */
  private async sendAlertToAdmin(alert: AnomalyAlert): Promise<void> {
    // TODO: Implement webhook or email notification
    const webhookUrl = process.env.ADMIN_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.warn('Admin webhook URL not configured, skipping alert notification');
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `🚨 Security Alert: ${alert.type}`,
          severity: alert.severity,
          message: alert.message,
          userId: alert.userId,
          details: alert.details,
          timestamp: new Date(alert.timestamp).toISOString(),
        }),
      });

      if (!response.ok) {
        logger.error(`Failed to send alert to admin: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error sending alert to admin:', error);
    }
  }

  /**
   * Get user activity statistics
   */
  getUserActivityStats(userId: string): {
    recentRequests: number;
    totalRequests: number;
    uniqueEndpoints: number;
    uniqueIPs: number;
    isBlocked: boolean;
    blockedTimeRemaining?: number;
  } | null {
    const activities = this.activityWindow.get(userId);
    const stats = this.userStats.get(userId);

    if (!activities && !stats) return null;

    const now = Date.now();
    const recentActivities = activities?.filter((a) => now - a.timestamp < this.WINDOW_MS) || [];

    return {
      recentRequests: recentActivities.length,
      totalRequests: stats?.requestCount || 0,
      uniqueEndpoints: stats?.endpoints.size || 0,
      uniqueIPs: stats?.ips.size || 0,
      isBlocked: this.isUserBlocked(userId),
      blockedTimeRemaining: this.isUserBlocked(userId)
        ? this.getBlockedTimeRemaining(userId)
        : undefined,
    };
  }

  /**
   * Get all blocked users
   */
  getBlockedUsers(): Array<{ userId: string; unblockTime: number; remainingMs: number }> {
    const now = Date.now();
    const blocked: Array<{ userId: string; unblockTime: number; remainingMs: number }> = [];

    for (const [userId, unblockTime] of this.blockedUsers.entries()) {
      if (unblockTime > now) {
        blocked.push({
          userId,
          unblockTime,
          remainingMs: unblockTime - now,
        });
      }
    }

    return blocked;
  }

  /**
   * Cleanup old data
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();

      // Clean activity window
      for (const [userId, activities] of this.activityWindow.entries()) {
        const recentActivities = activities.filter((a) => now - a.timestamp < this.WINDOW_MS);
        if (recentActivities.length === 0) {
          this.activityWindow.delete(userId);
        } else {
          this.activityWindow.set(userId, recentActivities);
        }
      }

      // Clean user stats (keep for 24h)
      for (const [userId, stats] of this.userStats.entries()) {
        if (now - stats.lastRequest > 24 * 60 * 60 * 1000) {
          this.userStats.delete(userId);
        }
      }

      // Clean expired blocks
      for (const [userId, unblockTime] of this.blockedUsers.entries()) {
        if (now >= unblockTime) {
          this.blockedUsers.delete(userId);
          logger.info(`User ${userId} auto-unblocked after timeout`);
        }
      }

      logger.info(
        `Anomaly detection cleanup: ${this.activityWindow.size} active users, ${this.blockedUsers.size} blocked users`
      );
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Reset all data (for testing)
   */
  reset(): void {
    this.activityWindow.clear();
    this.blockedUsers.clear();
    this.userStats.clear();
    logger.info('Anomaly detection service reset');
  }
}

// Singleton instance
const anomalyDetectionService = new AnomalyDetectionService();

export default anomalyDetectionService;
