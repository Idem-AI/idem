export interface QuotaData {
  dailyUsage: number;
  weeklyUsage: number;
  dailyLimit: number;
  weeklyLimit: number;
  lastResetDaily: string; // ISO date string
  lastResetWeekly: string; // ISO date string
  quotaUpdatedAt?: Date;
}

export interface GitHubIntegration {
  accessToken: string;
  refreshToken?: string;
  username: string;
  avatarUrl?: string;
  connectedAt: Date;
  lastUsed?: Date;
  scopes: string[];
}

export interface RefreshTokenData {
  token: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsed?: Date;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface PolicyAcceptanceStatus {
  privacyPolicy: boolean;
  termsOfService: boolean;
  betaPolicy: boolean;
  marketingAcceptance?: boolean;
  lastAcceptedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserModel {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  subscription: "free" | "pro" | "enterprise";
  createdAt: Date;
  lastLogin: Date;
  quota: Partial<QuotaData>;
  roles: string[];
  githubIntegration?: GitHubIntegration;
  refreshTokens?: RefreshTokenData[];
  policyAcceptance?: PolicyAcceptanceStatus;
}
