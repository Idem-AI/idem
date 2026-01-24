/**
 * Données de quota utilisateur
 */
export interface QuotaData {
  dailyUsage: number;
  weeklyUsage: number;
  dailyLimit: number;
  weeklyLimit: number;
  lastResetDaily: string;
  lastResetWeekly: string;
  quotaUpdatedAt?: Date;
}

/**
 * Intégration GitHub
 */
export interface GitHubIntegration {
  accessToken: string;
  refreshToken?: string;
  username: string;
  avatarUrl?: string;
  connectedAt: Date;
  lastUsed?: Date;
  scopes: string[];
}

/**
 * Intégration Google
 */
export interface GoogleIntegration {
  accessToken: string;
  refreshToken?: string;
  email: string;
  avatarUrl?: string;
  connectedAt: Date;
  lastUsed?: Date;
  scopes: string[];
}

/**
 * Données de refresh token
 */
export interface RefreshTokenData {
  token: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsed?: Date;
  deviceInfo?: string;
  ipAddress?: string;
}

/**
 * Statut d'acceptation des politiques
 */
export interface PolicyAcceptanceStatus {
  privacyPolicy: boolean;
  termsOfService: boolean;
  betaPolicy: boolean;
  marketingAcceptance?: boolean;
  lastAcceptedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Type d'authentification
 */
export type AuthProvider = 'google' | 'github' | 'email';

/**
 * Type de subscription
 */
export type SubscriptionType = 'free' | 'pro' | 'enterprise';

/**
 * Modèle utilisateur avec système d'autorisation
 */
export interface UserModel {
  id?: string;
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  subscription: SubscriptionType;
  createdAt: Date;
  lastLogin: Date;
  quota: Partial<QuotaData>;

  // Authentification
  authProvider: AuthProvider;
  githubIntegration?: GitHubIntegration;
  googleIntegration?: GoogleIntegration;
  refreshTokens?: RefreshTokenData[];
  policyAcceptance?: PolicyAcceptanceStatus;

  // Système d'autorisation
  isOwner: boolean; // Créateur de compte principal
  createdBy?: string; // ID de l'utilisateur qui a créé cet utilisateur
  teamMemberships?: string[]; // IDs des teams dont l'utilisateur est membre

  // Statut
  isActive: boolean;
  isEmailVerified: boolean;
  lastPasswordChange?: Date;

  // Métadonnées
  updatedAt: Date;
}

/**
 * DTO pour créer un utilisateur
 */
export interface CreateUserDTO {
  email: string;
  displayName: string;
  role: string;
  teamId?: string;
}

/**
 * DTO pour mettre à jour un utilisateur
 */
export interface UpdateUserDTO {
  displayName?: string;
  photoURL?: string;
  subscription?: SubscriptionType;
  isActive?: boolean;
}
