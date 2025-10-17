import { Request, Response } from 'express';
import { cacheService } from '../services/cache.service';
import { PdfService } from '../services/pdf.service';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';

/**
 * Contrôleur pour la gestion du cache Redis
 */
export class CacheController {
  
  /**
   * Obtient les statistiques du cache
   */
  static async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting cache statistics');
      
      const stats = await cacheService.getStats();
      
      logger.info('Cache statistics retrieved successfully', { stats });
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Cache statistics retrieved successfully'
      });
    } catch (error: any) {
      logger.error('Error getting cache statistics:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        message: 'Error retrieving cache statistics',
        error: error.message
      });
    }
  }

  /**
   * Vide complètement le cache
   */
  static async clearCache(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Clearing all cache');
      
      const cleared = await cacheService.clear();
      
      if (cleared) {
        logger.info('Cache cleared successfully');
        res.status(200).json({
          success: true,
          message: 'Cache cleared successfully'
        });
      } else {
        logger.warn('Failed to clear cache');
        res.status(500).json({
          success: false,
          message: 'Failed to clear cache'
        });
      }
    } catch (error: any) {
      logger.error('Error clearing cache:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        message: 'Error clearing cache',
        error: error.message
      });
    }
  }

  /**
   * Invalide le cache pour un utilisateur spécifique
   */
  static async invalidateUserCache(req: CustomRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;
      const targetUserId = req.params.userId || userId;

      if (!targetUserId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      logger.info(`Invalidating cache for user: ${targetUserId}`, { userId, targetUserId });
      
      const deletedCount = await cacheService.invalidateUserCache(targetUserId);
      
      logger.info(`Cache invalidated for user: ${targetUserId}`, { 
        deletedCount, 
        userId, 
        targetUserId 
      });
      
      res.status(200).json({
        success: true,
        message: `Cache invalidated for user ${targetUserId}`,
        data: { deletedKeys: deletedCount }
      });
    } catch (error: any) {
      logger.error('Error invalidating user cache:', { 
        error: error.message, 
        stack: error.stack,
        userId: req.user?.uid,
        targetUserId: req.params.userId
      });
      res.status(500).json({
        success: false,
        message: 'Error invalidating user cache',
        error: error.message
      });
    }
  }

  /**
   * Invalide le cache pour un projet spécifique
   */
  static async invalidateProjectCache(req: CustomRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;
      const projectId = req.params.projectId;

      if (!projectId) {
        res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
        return;
      }

      logger.info(`Invalidating cache for project: ${projectId}`, { userId, projectId });
      
      const deletedCount = await cacheService.invalidateProjectCache(projectId);
      
      logger.info(`Cache invalidated for project: ${projectId}`, { 
        deletedCount, 
        userId, 
        projectId 
      });
      
      res.status(200).json({
        success: true,
        message: `Cache invalidated for project ${projectId}`,
        data: { deletedKeys: deletedCount }
      });
    } catch (error: any) {
      logger.error('Error invalidating project cache:', { 
        error: error.message, 
        stack: error.stack,
        userId: req.user?.uid,
        projectId: req.params.projectId
      });
      res.status(500).json({
        success: false,
        message: 'Error invalidating project cache',
        error: error.message
      });
    }
  }

  /**
   * Invalide le cache par pattern
   */
  static async invalidateCacheByPattern(req: Request, res: Response): Promise<void> {
    try {
      const { pattern } = req.body;

      if (!pattern) {
        res.status(400).json({
          success: false,
          message: 'Pattern is required'
        });
        return;
      }

      logger.info(`Invalidating cache by pattern: ${pattern}`);
      
      const deletedCount = await cacheService.deletePattern(pattern);
      
      logger.info(`Cache invalidated by pattern: ${pattern}`, { deletedCount });
      
      res.status(200).json({
        success: true,
        message: `Cache invalidated for pattern ${pattern}`,
        data: { deletedKeys: deletedCount }
      });
    } catch (error: any) {
      logger.error('Error invalidating cache by pattern:', { 
        error: error.message, 
        stack: error.stack,
        pattern: req.body.pattern
      });
      res.status(500).json({
        success: false,
        message: 'Error invalidating cache by pattern',
        error: error.message
      });
    }
  }

  /**
   * Vérifie si une clé existe dans le cache
   */
  static async checkCacheKey(req: Request, res: Response): Promise<void> {
    try {
      const { key, prefix } = req.query;

      if (!key) {
        res.status(400).json({
          success: false,
          message: 'Cache key is required'
        });
        return;
      }

      logger.info(`Checking cache key: ${key}`, { key, prefix });
      
      const exists = await cacheService.exists(key as string, { 
        prefix: prefix as string 
      });
      
      const ttl = exists ? await cacheService.getTTL(key as string, { 
        prefix: prefix as string 
      }) : -1;
      
      logger.info(`Cache key check result: ${key}`, { key, exists, ttl });
      
      res.status(200).json({
        success: true,
        data: { 
          key,
          exists,
          ttl: ttl > 0 ? ttl : null
        },
        message: `Cache key ${exists ? 'exists' : 'does not exist'}`
      });
    } catch (error: any) {
      logger.error('Error checking cache key:', { 
        error: error.message, 
        stack: error.stack,
        key: req.query.key,
        prefix: req.query.prefix
      });
      res.status(500).json({
        success: false,
        message: 'Error checking cache key',
        error: error.message
      });
    }
  }

  /**
   * Met à jour le TTL d'une clé de cache
   */
  static async updateCacheTTL(req: Request, res: Response): Promise<void> {
    try {
      const { key, ttl, prefix } = req.body;

      if (!key || !ttl) {
        res.status(400).json({
          success: false,
          message: 'Key and TTL are required'
        });
        return;
      }

      logger.info(`Updating TTL for cache key: ${key}`, { key, ttl, prefix });
      
      const updated = await cacheService.expire(key, ttl, { prefix });
      
      if (updated) {
        logger.info(`TTL updated for cache key: ${key}`, { key, ttl });
        res.status(200).json({
          success: true,
          message: `TTL updated for key ${key}`,
          data: { key, ttl }
        });
      } else {
        logger.warn(`Failed to update TTL for cache key: ${key}`, { key, ttl });
        res.status(404).json({
          success: false,
          message: `Key ${key} not found or TTL update failed`
        });
      }
    } catch (error: any) {
      logger.error('Error updating cache TTL:', { 
        error: error.message, 
        stack: error.stack,
        key: req.body.key,
        ttl: req.body.ttl,
        prefix: req.body.prefix
      });
      res.status(500).json({
        success: false,
        message: 'Error updating cache TTL',
        error: error.message
      });
    }
  }

  // ==========================================
  // MÉTHODES POUR LA GESTION DU CACHE PDF
  // ==========================================

  /**
   * Obtient les statistiques du cache PDF local
   */
  static async getPdfCacheStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting PDF cache statistics');
      
      const stats = await PdfService.getCacheStats();
      
      logger.info('PDF cache statistics retrieved successfully', { stats });
      res.status(200).json({
        success: true,
        data: {
          ...stats,
          diskUsageMB: Math.round(stats.diskUsage / (1024 * 1024) * 100) / 100,
          totalSizeMB: Math.round(stats.totalSize / (1024 * 1024) * 100) / 100
        },
        message: 'PDF cache statistics retrieved successfully'
      });
    } catch (error: any) {
      logger.error('Error getting PDF cache statistics:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        message: 'Error retrieving PDF cache statistics',
        error: error.message
      });
    }
  }

  /**
   * Vide complètement le cache PDF
   */
  static async clearPdfCache(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.query;
      const cacheType = (type as 'html' | 'pdf' | 'all') || 'all';
      
      logger.info(`Clearing PDF cache: ${cacheType}`);
      
      const result = await PdfService.clearCacheSelective(cacheType);
      
      logger.info('PDF cache cleared successfully', { result });
      res.status(200).json({
        success: true,
        data: result,
        message: `PDF cache (${cacheType}) cleared successfully`
      });
    } catch (error: any) {
      logger.error('Error clearing PDF cache:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        message: 'Error clearing PDF cache',
        error: error.message
      });
    }
  }

  /**
   * Vide complètement tout le cache PDF (local + Redis) via clearCache()
   */
  static async clearAllPdfCache(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Clearing all PDF cache (local + Redis)');
      
      await PdfService.clearCache();
      
      logger.info('All PDF cache cleared successfully');
      res.status(200).json({
        success: true,
        message: 'All PDF cache (local + Redis) cleared successfully'
      });
    } catch (error: any) {
      logger.error('Error clearing all PDF cache:', { 
        error: error.message, 
        stack: error.stack 
      });
      res.status(500).json({
        success: false,
        message: 'Error clearing all PDF cache',
        error: error.message
      });
    }
  }

  /**
   * Invalide le cache PDF pour un projet spécifique
   */
  static async invalidatePdfCacheByProject(req: CustomRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;
      const projectId = req.params.projectId;

      if (!projectId) {
        res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
        return;
      }

      logger.info(`Invalidating PDF cache for project: ${projectId}`, { userId, projectId });
      
      // Invalider dans Redis ET dans le cache local PDF
      const redisDeleted = await cacheService.invalidateProjectCache(projectId);
      const pdfDeleted = await PdfService.invalidateCacheByProjectId(projectId);
      
      logger.info(`PDF cache invalidated for project: ${projectId}`, { 
        redisDeleted, 
        pdfDeleted,
        userId, 
        projectId 
      });
      
      res.status(200).json({
        success: true,
        message: `PDF cache invalidated for project ${projectId}`,
        data: { 
          redisDeletedKeys: redisDeleted,
          pdfDeletedEntries: pdfDeleted
        }
      });
    } catch (error: any) {
      logger.error('Error invalidating PDF cache for project:', { 
        error: error.message, 
        stack: error.stack,
        userId: req.user?.uid,
        projectId: req.params.projectId
      });
      res.status(500).json({
        success: false,
        message: 'Error invalidating PDF cache for project',
        error: error.message
      });
    }
  }

  /**
   * Invalide le cache PDF pour un utilisateur spécifique
   */
  static async invalidatePdfCacheByUser(req: CustomRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;
      const targetUserId = req.params.userId || userId;

      if (!targetUserId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      logger.info(`Invalidating PDF cache for user: ${targetUserId}`, { userId, targetUserId });
      
      // Invalider dans Redis ET dans le cache local PDF
      const redisDeleted = await cacheService.invalidateUserCache(targetUserId);
      const pdfDeleted = await PdfService.invalidateCacheByUserId(targetUserId);
      
      logger.info(`PDF cache invalidated for user: ${targetUserId}`, { 
        redisDeleted, 
        pdfDeleted,
        userId, 
        targetUserId 
      });
      
      res.status(200).json({
        success: true,
        message: `PDF cache invalidated for user ${targetUserId}`,
        data: { 
          redisDeletedKeys: redisDeleted,
          pdfDeletedEntries: pdfDeleted
        }
      });
    } catch (error: any) {
      logger.error('Error invalidating PDF cache for user:', { 
        error: error.message, 
        stack: error.stack,
        userId: req.user?.uid,
        targetUserId: req.params.userId
      });
      res.status(500).json({
        success: false,
        message: 'Error invalidating PDF cache for user',
        error: error.message
      });
    }
  }

  /**
   * Nettoie le cache PDF par âge
   */
  static async clearPdfCacheByAge(req: Request, res: Response): Promise<void> {
    try {
      const { maxAgeMinutes } = req.body;

      if (!maxAgeMinutes || maxAgeMinutes <= 0) {
        res.status(400).json({
          success: false,
          message: 'maxAgeMinutes is required and must be positive'
        });
        return;
      }

      logger.info(`Clearing PDF cache by age: ${maxAgeMinutes} minutes`);
      
      const result = await PdfService.clearCacheByAge(maxAgeMinutes);
      
      logger.info('PDF cache cleared by age successfully', { result, maxAgeMinutes });
      res.status(200).json({
        success: true,
        data: result,
        message: `PDF cache entries older than ${maxAgeMinutes} minutes cleared successfully`
      });
    } catch (error: any) {
      logger.error('Error clearing PDF cache by age:', { 
        error: error.message, 
        stack: error.stack,
        maxAgeMinutes: req.body.maxAgeMinutes
      });
      res.status(500).json({
        success: false,
        message: 'Error clearing PDF cache by age',
        error: error.message
      });
    }
  }
}
