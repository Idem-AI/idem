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
 * Stocké sur le compte (et non dans le navigateur) : le sondage suit
 * l'utilisateur d'un appareil à l'autre, et les comptes créés avant la
 * fonctionnalité se reconnaissent à l'absence de ce champ.
 */
export interface OnboardingProfile {
  version: 1;
  answers: OnboardingSurveyAnswers;
  /** Mode calculé à partir des réponses */
  recommendedMode: OnboardingUiMode;
  /** Mode réellement retenu par l'utilisateur (il peut contredire la reco) */
  selectedMode: OnboardingUiMode;
  completedAt: Date | string;
  /** Visites guidées déjà vues, par identifiant (`main-dashboard:guided`…) */
  toursSeen?: string[];
}

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
  /** Sondage d'accueil ; absent = compte antérieur à la fonctionnalité */
  onboardingProfile?: OnboardingProfile;

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
