export interface QuotaData {
  dailyUsage: number;
  weeklyUsage: number;
  lastResetDaily: string;
  lastResetWeekly: string;
  quotaUpdatedAt?: Date;
}

export interface QuotaInfoResponse {
  dailyUsage: number;
  weeklyUsage: number;
  dailyLimit: number;
  weeklyLimit: number;
  remainingDaily: number;
  remainingWeekly: number;
  isBeta: boolean;
}

export interface QuotaCheckResult {
  allowed: boolean;
  remainingDaily: number;
  remainingWeekly: number;
  message?: string;
}

export interface FeatureValidationResponse {
  allowed: boolean;
  message?: string;
}

export interface BetaInfoResponse {
  isBeta: boolean;
  allowedFeatures: string[];
  restrictions: {
    maxStyles: number;
    maxResolution: string;
    maxOutputTokens: number;
    restrictedPrompts: string[];
  };
}

export interface BetaRestrictions {
  maxStyles: number;
  maxResolution: string;
  allowedFeatures: string[];
  maxOutputTokens: number;
  restrictedPrompts: string[];
}

export enum QuotaStatus {
  AVAILABLE = 'available',
  WARNING = 'warning', // 80% utilisé
  EXCEEDED = 'exceeded',
}

export interface QuotaDisplayData {
  dailyPercentage: number;
  weeklyPercentage: number;
  dailyStatus: QuotaStatus;
  weeklyStatus: QuotaStatus;
  canUseFeature: boolean;
}
