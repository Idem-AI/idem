import logger from '../config/logger';
import { isSuperUser } from '../utils/super-user.util';
import { OnboardingProfile, QuotaData, UserModel } from '../models/userModel';
import { IRepository } from '../repository/IRepository';
import { RepositoryFactory } from '../repository/RepositoryFactory';

export interface QuotaLimits {
  dailyLimit: number;
  weeklyLimit: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  remainingDaily: number;
  remainingWeekly: number;
  message?: string;
}
class UserService {
  private userRepository: IRepository<UserModel>;
  private quotaLimits: QuotaLimits;
  constructor() {
    this.userRepository = RepositoryFactory.getRepository<UserModel>();

    // Configure quota limits based on environment
    this.quotaLimits = {
      dailyLimit: parseInt(process.env.DAILY_QUOTA_LIMIT || '50'),
      weeklyLimit: parseInt(process.env.WEEKLY_QUOTA_LIMIT || '200'),
    };

    logger.info(`QuotaService initialized - Limits:`, this.quotaLimits);
  }

  public async createUser(user: UserModel): Promise<UserModel> {
    if (!user) {
      logger.warn('createUser failed: No user data provided.');
      throw new Error('No user data provided.');
    }

    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findById(user.uid, 'users');
      if (existingUser) {
        logger.info(`User ${user.uid} already exists, returning existing user`);
        return existingUser;
      }

      user.quota = {
        dailyUsage: 0,
        weeklyUsage: 0,
        dailyLimit: this.quotaLimits.dailyLimit,
        weeklyLimit: this.quotaLimits.weeklyLimit,
        lastResetDaily: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        lastResetWeekly: this.getWeekStart(new Date()).toISOString().split('T')[0],
      };
      const createdUser = await this.userRepository.create(user, 'users', user.uid);
      logger.info(`User created successfully: ${createdUser.uid}`);

      // Adresse inscrite au programme bêta avant la création du compte : on
      // ouvre les droits maintenant. Volontairement non attendu et isolé — une
      // indisponibilité du moteur de facturation ne doit jamais empêcher
      // quelqu'un de créer son compte.
      void this.linkBetaProgram(createdUser.uid, createdUser.email);

      return createdUser;
    } catch (error: any) {
      logger.error(`Error creating user: ${error.message}`, {
        stack: error.stack,
        details: error,
      });
      throw error;
    }
  }

  /**
   * Rattache un compte au programme bêta premium si son adresse y figure.
   *
   * Importé à la demande : `user.service` est chargé très tôt, et une
   * dépendance statique vers la facturation entraînerait tout le moteur de
   * paiement dans le graphe d'imports de l'authentification.
   */
  private async linkBetaProgram(userId: string, email?: string): Promise<void> {
    if (!email) return;

    try {
      const { betaService } = await import('./billing/beta.service');
      await betaService.matchOnSignup(userId, email);
    } catch (error: any) {
      logger.error(`Beta program check failed for ${userId}: ${error.message}`);
    }
  }

  /**
   * Profil d'un utilisateur dont l'identité a déjà été vérifiée (cookie de
   * session ou jeton), avec mise à jour de `lastLogin`.
   *
   * Le document existe toujours : il est créé ou rattaché à la connexion
   * (`identityService.resolveUser`). Son absence signifie un compte supprimé.
   */
  public async getUserProfile(uid: string): Promise<UserModel> {
    if (!uid) throw new Error('No user id provided.');

    let user: UserModel | null = await this.userRepository.findById(uid, 'users');
    if (!user) {
      logger.warn(`getUserProfile: user ${uid} not found`);
      throw new Error('User not found.');
    }

    if (!user.quota) {
      user.quota = {
        dailyUsage: 0,
        weeklyUsage: 0,
        dailyLimit: this.quotaLimits.dailyLimit,
        weeklyLimit: this.quotaLimits.weeklyLimit,
        lastResetDaily: new Date().toISOString().split('T')[0],
        lastResetWeekly: new Date().toISOString().split('T')[0],
      };
    }
    user =
      (await this.userRepository.update(
        uid,
        {
          lastLogin: new Date(),
          quota: user.quota, // Ensure quota is preserved
        },
        'users'
      )) || user;

    return user;
  }

  /**
   * Check if user can make a request based on their quota
   */
  async checkQuota(userId: string): Promise<QuotaCheckResult> {
    try {
      logger.info(`Checking quota for user: ${userId}`);

      // Get user to check if they are an admin
      const user = await this.userRepository.findById(userId, 'users');

      // Check if user is an admin (unlimited quota)
      if (user && user.email) {
        if (isSuperUser(user.email)) {
          logger.info(`User ${userId} (${user.email}) is an admin - unlimited quota granted`);
          return {
            allowed: true,
            remainingDaily: 999999,
            remainingWeekly: 999999,
            message: 'Admin - Unlimited quota',
          };
        }
      }

      // Get or create user quota
      let quotaData = await this.getUserQuota(userId);
      if (!quotaData) {
        quotaData = await this.createUserQuota(userId);
      }

      // Reset counters if needed
      quotaData = await this.resetCountersIfNeeded(userId, quotaData);

      const remainingDaily = Math.max(0, this.quotaLimits.dailyLimit - quotaData.dailyUsage);
      const remainingWeekly = Math.max(0, this.quotaLimits.weeklyLimit - quotaData.weeklyUsage);

      const allowed = remainingDaily > 0 && remainingWeekly > 0;

      let message: string | undefined;
      if (!allowed) {
        if (remainingDaily <= 0) {
          message = `Daily quota exceeded (${this.quotaLimits.dailyLimit} requests/day)`;
        } else if (remainingWeekly <= 0) {
          message = `Weekly quota exceeded (${this.quotaLimits.weeklyLimit} requests/week)`;
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
        'users'
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
  }> {
    try {
      logger.info(`Getting quota info for user: ${userId}`);

      let quotaData = await this.getUserQuota(userId);
      if (!quotaData) {
        quotaData = await this.createUserQuota(userId);
      }

      quotaData = await this.resetCountersIfNeeded(userId, quotaData);

      const remainingDaily = Math.max(0, this.quotaLimits.dailyLimit - quotaData.dailyUsage);
      const remainingWeekly = Math.max(0, this.quotaLimits.weeklyLimit - quotaData.weeklyUsage);

      return {
        dailyUsage: quotaData.dailyUsage,
        weeklyUsage: quotaData.weeklyUsage,
        dailyLimit: this.quotaLimits.dailyLimit,
        weeklyLimit: this.quotaLimits.weeklyLimit,
        remainingDaily,
        remainingWeekly,
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
      const user: UserModel | null = await this.userRepository.findById(userId, 'users');

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
      lastResetDaily: now.toISOString().split('T')[0], // YYYY-MM-DD
      lastResetWeekly: this.getWeekStart(now).toISOString().split('T')[0],
    };

    // Check if user exists in repository
    const user = await this.userRepository.findById(userId, 'users');
    if (!user) {
      // Le document est créé à la connexion : son absence est une anomalie.
      logger.error(`Cannot initialise quota: user ${userId} not found`);
      throw new Error(`User ${userId} not found`);
    } else {
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
        'users'
      );
    }

    logger.info(`Created new quota data for user ${userId}`);
    return quotaData;
  }

  /**
   * Reset counters if day/week has changed
   */
  private async resetCountersIfNeeded(userId: string, quotaData: QuotaData): Promise<QuotaData> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekStart = this.getWeekStart(now).toISOString().split('T')[0];

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
        'users'
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

  // ─────────────────────────────────────────── Sondage d'accueil

  /**
   * Profil d'accueil de l'utilisateur.
   * `null` signifie « sondage jamais rempli » : c'est le cas de tous les
   * comptes créés avant la fonctionnalité, et c'est ce qui déclenche le
   * sondage à leur prochaine ouverture d'IDEM.
   */
  async getOnboardingProfile(userId: string): Promise<OnboardingProfile | null> {
    const user = await this.userRepository.findById(userId, 'users');
    return user?.onboardingProfile ?? null;
  }

  /**
   * Enregistre les réponses du sondage sur le compte.
   */
  async saveOnboardingProfile(
    userId: string,
    profile: OnboardingProfile
  ): Promise<OnboardingProfile> {
    const user = await this.userRepository.findById(userId, 'users');

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    await this.userRepository.update(userId, { onboardingProfile: profile }, 'users');
    logger.info(`Onboarding survey stored for user ${userId}`, {
      recommendedMode: profile.recommendedMode,
      selectedMode: profile.selectedMode,
    });
    return profile;
  }

  /**
   * Visites guidées déjà vues par ce compte.
   *
   * Les deux emplacements sont fusionnés : le champ de compte, et l'ancien
   * champ logé dans le profil d'accueil, le temps que les comptes existants
   * basculent.
   */
  async getToursSeen(userId: string): Promise<string[]> {
    const user = await this.userRepository.findById(userId, 'users');
    const legacy = user?.onboardingProfile?.toursSeen ?? [];
    return [...new Set([...(user?.toursSeen ?? []), ...legacy])];
  }

  /**
   * Mémorise qu'une visite guidée a été vue.
   *
   * L'appel est idempotent.
   */
  async markTourSeen(userId: string, tourId: string): Promise<string[]> {
    const seen = await this.getToursSeen(userId);
    if (seen.includes(tourId)) return seen;

    const toursSeen = [...seen, tourId];
    const user = await this.userRepository.findById(userId, 'users');

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    await this.userRepository.update(userId, { toursSeen }, 'users');

    logger.info(`Tour ${tourId} marked as seen for user ${userId}`);
    return toursSeen;
  }

  async getUserEmail(userId: string): Promise<string | undefined> {
    const user = await this.userRepository.findById(userId, 'users');
    return user?.email;
  }

  /**
   * Get current quota limits
   */
  getCurrentLimits(): { daily: number; weekly: number } {
    return {
      daily: this.quotaLimits.dailyLimit,
      weekly: this.quotaLimits.weeklyLimit,
    };
  }
}

export const userService = new UserService();
