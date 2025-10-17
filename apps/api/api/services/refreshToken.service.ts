import crypto from "crypto";
import logger from "../config/logger";
import { RefreshTokenData, UserModel } from "../models/userModel";
import { IRepository } from "../repository/IRepository";
import { RepositoryFactory } from "../repository/RepositoryFactory";

export interface RefreshTokenResult {
  refreshToken: string;
  expiresAt: Date;
}

export interface TokenValidationResult {
  isValid: boolean;
  userId?: string;
  tokenData?: RefreshTokenData;
}

class RefreshTokenService {
  private userRepository: IRepository<UserModel>;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 jours
  private readonly MAX_REFRESH_TOKENS_PER_USER = 5; // Maximum 5 tokens par utilisateur

  constructor() {
    this.userRepository = RepositoryFactory.getRepository<UserModel>();
    logger.info("RefreshTokenService initialized");
  }

  /**
   * Génère un nouveau refresh token pour un utilisateur
   */
  async generateRefreshToken(
    userId: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<RefreshTokenResult> {
    try {
      logger.info(`Generating refresh token for user: ${userId}`);

      // Générer un token sécurisé
      const token = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

      const refreshTokenData: RefreshTokenData = {
        token,
        expiresAt,
        createdAt: new Date(),
        deviceInfo,
        ipAddress,
      };

      // Récupérer l'utilisateur
      const user = await this.userRepository.findById(userId, "users");
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Initialiser le tableau de refresh tokens s'il n'existe pas
      if (!user.refreshTokens) {
        user.refreshTokens = [];
      }

      // Nettoyer les tokens expirés
      await this.cleanupExpiredTokens(userId);

      // Limiter le nombre de tokens par utilisateur
      if (user.refreshTokens.length >= this.MAX_REFRESH_TOKENS_PER_USER) {
        // Supprimer le plus ancien token
        user.refreshTokens.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        user.refreshTokens.shift();
        logger.info(`Removed oldest refresh token for user ${userId} due to limit`);
      }

      // Ajouter le nouveau token
      user.refreshTokens.push(refreshTokenData);

      // Mettre à jour l'utilisateur
      await this.userRepository.update(
        userId,
        { refreshTokens: user.refreshTokens },
        "users"
      );

      logger.info(`Refresh token generated successfully for user: ${userId}`);
      return { refreshToken: token, expiresAt };
    } catch (error) {
      logger.error(`Error generating refresh token for user ${userId}:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw new Error(`Failed to generate refresh token: ${(error as Error).message}`);
    }
  }

  /**
   * Valide un refresh token
   */
  async validateRefreshToken(token: string): Promise<TokenValidationResult> {
    try {
      logger.info("Validating refresh token");

      // Rechercher l'utilisateur avec ce token
      const users = await this.userRepository.findAll("users");
      
      for (const user of users) {
        if (!user.refreshTokens) continue;

        const tokenData = user.refreshTokens.find(rt => rt.token === token);
        if (tokenData) {
          // Vérifier si le token n'est pas expiré
          if (new Date() > tokenData.expiresAt) {
            logger.warn(`Expired refresh token used for user: ${user.uid}`);
            // Supprimer le token expiré
            await this.revokeRefreshToken(user.uid, token);
            return { isValid: false };
          }

          // Mettre à jour la date de dernière utilisation
          tokenData.lastUsed = new Date();
          await this.userRepository.update(
            user.uid,
            { refreshTokens: user.refreshTokens },
            "users"
          );

          logger.info(`Valid refresh token found for user: ${user.uid}`);
          return {
            isValid: true,
            userId: user.uid,
            tokenData,
          };
        }
      }

      logger.warn("Invalid refresh token provided");
      return { isValid: false };
    } catch (error) {
      logger.error("Error validating refresh token:", {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return { isValid: false };
    }
  }

  /**
   * Révoque un refresh token spécifique
   */
  async revokeRefreshToken(userId: string, token: string): Promise<boolean> {
    try {
      logger.info(`Revoking refresh token for user: ${userId}`);

      const user = await this.userRepository.findById(userId, "users");
      if (!user || !user.refreshTokens) {
        logger.warn(`User ${userId} not found or has no refresh tokens`);
        return false;
      }

      const initialLength = user.refreshTokens.length;
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== token);

      if (user.refreshTokens.length < initialLength) {
        await this.userRepository.update(
          userId,
          { refreshTokens: user.refreshTokens },
          "users"
        );
        logger.info(`Refresh token revoked successfully for user: ${userId}`);
        return true;
      }

      logger.warn(`Refresh token not found for user: ${userId}`);
      return false;
    } catch (error) {
      logger.error(`Error revoking refresh token for user ${userId}:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return false;
    }
  }

  /**
   * Révoque tous les refresh tokens d'un utilisateur
   */
  async revokeAllRefreshTokens(userId: string): Promise<boolean> {
    try {
      logger.info(`Revoking all refresh tokens for user: ${userId}`);

      await this.userRepository.update(
        userId,
        { refreshTokens: [] },
        "users"
      );

      logger.info(`All refresh tokens revoked successfully for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error revoking all refresh tokens for user ${userId}:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return false;
    }
  }

  /**
   * Nettoie les tokens expirés pour un utilisateur
   */
  async cleanupExpiredTokens(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId, "users");
      if (!user || !user.refreshTokens) {
        return;
      }

      const now = new Date();
      const initialLength = user.refreshTokens.length;
      user.refreshTokens = user.refreshTokens.filter(rt => rt.expiresAt > now);

      if (user.refreshTokens.length < initialLength) {
        await this.userRepository.update(
          userId,
          { refreshTokens: user.refreshTokens },
          "users"
        );
        logger.info(`Cleaned up ${initialLength - user.refreshTokens.length} expired tokens for user: ${userId}`);
      }
    } catch (error) {
      logger.error(`Error cleaning up expired tokens for user ${userId}:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    }
  }

  /**
   * Obtient les informations des refresh tokens d'un utilisateur
   */
  async getUserRefreshTokens(userId: string): Promise<Omit<RefreshTokenData, 'token'>[]> {
    try {
      const user = await this.userRepository.findById(userId, "users");
      if (!user || !user.refreshTokens) {
        return [];
      }

      // Nettoyer les tokens expirés d'abord
      await this.cleanupExpiredTokens(userId);

      // Retourner les informations sans le token lui-même
      return user.refreshTokens.map(({ token, ...tokenInfo }) => tokenInfo);
    } catch (error) {
      logger.error(`Error getting refresh tokens for user ${userId}:`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return [];
    }
  }

  /**
   * Génère un token sécurisé
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Nettoie tous les tokens expirés du système (à exécuter périodiquement)
   */
  async cleanupAllExpiredTokens(): Promise<void> {
    try {
      logger.info("Starting cleanup of all expired refresh tokens");

      const users = await this.userRepository.findAll("users");
      let totalCleaned = 0;

      for (const user of users) {
        if (!user.refreshTokens || user.refreshTokens.length === 0) {
          continue;
        }

        const now = new Date();
        const initialLength = user.refreshTokens.length;
        user.refreshTokens = user.refreshTokens.filter(rt => rt.expiresAt > now);

        if (user.refreshTokens.length < initialLength) {
          await this.userRepository.update(
            user.uid,
            { refreshTokens: user.refreshTokens },
            "users"
          );
          totalCleaned += (initialLength - user.refreshTokens.length);
        }
      }

      logger.info(`Cleanup completed. Removed ${totalCleaned} expired refresh tokens`);
    } catch (error) {
      logger.error("Error during global refresh token cleanup:", {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    }
  }
}

export const refreshTokenService = new RefreshTokenService();
