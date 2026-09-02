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

/** Réponses au sondage d'accueil (4 questions, une seule fois par compte). */
export interface OnboardingSurveyAnswers {
  /** Où en est l'utilisateur : idea | starting | running */
  stage?: string;
  /** Sait-il par où commencer : lost | partial | clear */
  clarity?: string;
  /** Comment il préfère avancer : stepByStep | conversation | autonomy */
  workStyle?: string;
  /** Aisance numérique : beginner | intermediate | expert */
  comfort?: string;
}

/** Mode d'interface d'IDEM. */
export type OnboardingUiMode = 'guided' | 'chat' | 'advanced';

/**
 * Profil d'accueil : ce que l'utilisateur a répondu et le mode qui en découle.
 *
 * Stocké sur le compte (et non dans le navigateur) pour deux raisons : le
 * sondage suit l'utilisateur d'un appareil à l'autre, et les comptes créés
 * avant la fonctionnalité sont détectés par l'absence de ce champ.
 */
export interface OnboardingProfile {
  version: 1;
  answers: OnboardingSurveyAnswers;
  /** Mode calculé à partir des réponses */
  recommendedMode: OnboardingUiMode;
  /** Mode réellement retenu par l'utilisateur (il peut contredire la reco) */
  selectedMode: OnboardingUiMode;
  completedAt: Date | string;
}

export interface UserModel {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  subscription: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  lastLogin: Date;
  quota: Partial<QuotaData>;
  roles: string[];
  githubIntegration?: GitHubIntegration;
  refreshTokens?: RefreshTokenData[];
  policyAcceptance?: PolicyAcceptanceStatus;
  /** Sondage d'accueil ; absent = compte antérieur à la fonctionnalité */
  onboardingProfile?: OnboardingProfile;
}
