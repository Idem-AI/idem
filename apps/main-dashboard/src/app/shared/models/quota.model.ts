export interface QuotaInfoResponse {
  dailyUsage: number;
  weeklyUsage: number;
  dailyLimit: number;
  weeklyLimit: number;
  remainingDaily: number;
  remainingWeekly: number;
  isBeta: boolean;
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
  WARNING = 'warning', // 85% utilisé
  EXCEEDED = 'exceeded',
}

export interface QuotaDisplayData {
  dailyPercentage: number;
  weeklyPercentage: number;
  dailyStatus: QuotaStatus;
  weeklyStatus: QuotaStatus;
  canUseFeature: boolean;
}
