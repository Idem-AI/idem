import { refreshTokenService } from "../services/refreshToken.service";
import logger from "../config/logger";

/**
 * Script de nettoyage périodique des refresh tokens expirés
 * À exécuter via cron job ou tâche programmée
 */
async function cleanupExpiredTokens(): Promise<void> {
  try {
    logger.info("Starting periodic cleanup of expired refresh tokens");
    
    await refreshTokenService.cleanupAllExpiredTokens();
    
    logger.info("Periodic cleanup completed successfully");
  } catch (error) {
    logger.error("Error during periodic cleanup:", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    process.exit(1);
  }
}

// Exécuter le nettoyage si ce script est appelé directement
if (require.main === module) {
  cleanupExpiredTokens()
    .then(() => {
      logger.info("Cleanup script finished");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Cleanup script failed:", error);
      process.exit(1);
    });
}

export { cleanupExpiredTokens };
