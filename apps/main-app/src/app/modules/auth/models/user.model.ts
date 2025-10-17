export interface QuotaData {
  dailyUsage: number;
  weeklyUsage: number;
  dailyLimit: number;
  weeklyLimit: number;
  lastResetDaily: string; // ISO date string
  lastResetWeekly: string; // ISO date string
  quotaUpdatedAt?: Date;
}

export interface UserModel {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  subscription: "free" | "pro" | "enterprise";
  createdAt: Date;
  lastLogin: Date;

  // Quota-related fields
  quota: Partial<QuotaData>;
}
