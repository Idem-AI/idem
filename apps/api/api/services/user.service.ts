import logger from '../config/logger';
import { OnboardingProfile, UserModel } from '../models/userModel';
import { IRepository } from '../repository/IRepository';
import { RepositoryFactory } from '../repository/RepositoryFactory';

/**
 * Les quotas d'usage IA ne sont plus portés par le compte : ils vivent dans
 * `services/billing/usage-quota.service` (par groupe de fonctionnalités, jour,
 * semaine et mois, selon l'offre).
 */
class UserService {
  private userRepository: IRepository<UserModel>;
  constructor() {
    this.userRepository = RepositoryFactory.getRepository<UserModel>();
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

      const createdUser = await this.userRepository.create(user, 'users', user.uid);
      logger.info(`User created successfully: ${createdUser.uid}`);

      // Adresse inscrite au programme bêta avant la création du compte : on
      // ouvre les droits maintenant. Volontairement non attendu et isolé — une
      // indisponibilité du moteur de facturation ne doit jamais empêcher
      // quelqu'un de créer son compte.
      void this.linkBetaProgram(createdUser.uid, createdUser.email);
      // Le cadeau d'accueil : 7 jours de forfait Croissance (réciprocité, sans engagement).
      void this.grantWelcomePass(createdUser.uid);

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

  /** Forfait Croissance offert à l'inscription (importé à la demande, comme la bêta). */
  private async grantWelcomePass(userId: string): Promise<void> {
    try {
      const [{ passService }, { WELCOME_PASS }] = await Promise.all([import('./billing/pass.service'), import('../models/offer.model')]);
      const until = new Date(Date.now() + WELCOME_PASS.days * 86_400_000);
      await passService.grant(userId, WELCOME_PASS.code, until, { provider: 'welcome', note: `${WELCOME_PASS.days} jours offerts à l'inscription` });
    } catch (error: any) {
      logger.error(`Welcome pass failed for ${userId}: ${error.message}`);
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

    user = (await this.userRepository.update(uid, { lastLogin: new Date() }, 'users')) || user;

    return user;
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

}

export const userService = new UserService();
