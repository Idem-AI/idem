import { Request, Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { migrationService } from '../services/authorization/migration.service';
import logger from '../config/logger';

/**
 * Lancer la migration de tous les utilisateurs
 * ATTENTION: Cette route doit être protégée et accessible uniquement aux administrateurs
 */
export async function runMigration(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    // TODO: Vérifier que l'utilisateur est un administrateur
    // Pour l'instant, on peut ajouter une vérification basique
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    const userEmail = req.user?.email;

    if (!userEmail || !adminEmails.includes(userEmail)) {
      res
        .status(403)
        .json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      return;
    }

    logger.info(`Starting migration requested by admin: ${userEmail}`);

    // Lancer la migration de manière asynchrone
    migrationService
      .migrateAllUsers()
      .then((status) => {
        logger.info(`Migration completed: ${JSON.stringify(status)}`);
      })
      .catch((error) => {
        logger.error(`Migration failed: ${error.message}`);
      });

    res.status(202).json({
      success: true,
      data: {
        message: 'Migration started. Check migration status for progress.',
      },
    });
  } catch (error: any) {
    logger.error(`Error starting migration: ${error.message}`);
    res
      .status(500)
      .json({ success: false, error: { code: 'MIGRATION_ERROR', message: error.message } });
  }
}

/**
 * Récupérer le statut de la migration
 */
export async function getMigrationStatus(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const migrationName = 'user_authorization_system';
    const status = await migrationService.getMigrationStatus(migrationName);

    if (!status) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Migration not started yet' },
      });
      return;
    }

    res.status(200).json({ success: true, data: status });
  } catch (error: any) {
    logger.error(`Error getting migration status: ${error.message}`);
    res
      .status(500)
      .json({ success: false, error: { code: 'GET_STATUS_ERROR', message: error.message } });
  }
}
