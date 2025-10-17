import Redis from "ioredis";
import RedisConnection from "../config/redis.config";
import logger from "../config/logger";
import crypto from "crypto";

/**
 * Options pour le cache
 */
export interface CacheOptions {
  ttl?: number; // Time to live en secondes
  prefix?: string; // Préfixe pour la clé
  compress?: boolean; // Compression des données
}

/**
 * Statistiques du cache
 */
export interface CacheStats {
  totalKeys: number;
  memoryUsage: string;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
}

/**
 * Service de cache Redis centralisé
 */
export class CacheService {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1 heure par défaut
  private keyPrefix: string = "idem:";
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor() {
    this.redis = RedisConnection.getInstance();
  }

  /**
   * Génère une clé de cache basée sur le contenu
   */
  private generateCacheKey(key: string, data?: any): string {
    if (data) {
      const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex")
        .substring(0, 16);
      return `${this.keyPrefix}${key}:${hash}`;
    }
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Compresse les données si nécessaire
   */
  private compressData(data: any): string {
    return JSON.stringify(data);
  }

  /**
   * Décompresse les données
   */
  private decompressData(data: string): any {
    try {
      return JSON.parse(data);
    } catch (error) {
      logger.error("Error decompressing cache data:", { error });
      return null;
    }
  }

  /**
   * Met en cache une valeur
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(
        options.prefix ? `${options.prefix}:${key}` : key
      );
      const serializedValue = this.compressData(value);
      const ttl = options.ttl || this.defaultTTL;

      await this.redis.setex(cacheKey, ttl, serializedValue);

      logger.debug(`Cache set successful`, {
        key: cacheKey,
        ttl,
        size: serializedValue.length,
      });

      return true;
    } catch (error: any) {
      logger.error("Cache set error:", {
        key,
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Récupère une valeur du cache
   */
  async get<T = any>(
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    try {
      const cacheKey = this.generateCacheKey(
        options.prefix ? `${options.prefix}:${key}` : key
      );
      const cachedValue = await this.redis.get(cacheKey);

      if (cachedValue === null) {
        this.stats.misses++;
        logger.debug(`Cache miss`, { key: cacheKey });
        return null;
      }

      this.stats.hits++;
      const decompressedValue = this.decompressData(cachedValue);

      logger.debug(`Cache hit`, {
        key: cacheKey,
        size: cachedValue.length,
      });

      return decompressedValue;
    } catch (error: any) {
      logger.error("Cache get error:", {
        key,
        error: error.message,
        stack: error.stack,
      });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Supprime une clé du cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(
        options.prefix ? `${options.prefix}:${key}` : key
      );
      const result = await this.redis.del(cacheKey);

      logger.debug(`Cache delete`, {
        key: cacheKey,
        deleted: result > 0,
      });

      return result > 0;
    } catch (error: any) {
      logger.error("Cache delete error:", {
        key,
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Supprime toutes les clés correspondant à un pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = `${this.keyPrefix}${pattern}`;
      const keys = await this.redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);

      logger.info(`Cache pattern delete`, {
        pattern: fullPattern,
        keysFound: keys.length,
        deleted: result,
      });

      return result;
    } catch (error: any) {
      logger.error("Cache pattern delete error:", {
        pattern,
        error: error.message,
        stack: error.stack,
      });
      return 0;
    }
  }

  /**
   * Vérifie si une clé existe dans le cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(
        options.prefix ? `${options.prefix}:${key}` : key
      );
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error: any) {
      logger.error("Cache exists error:", {
        key,
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Définit le TTL d'une clé existante
   */
  async expire(
    key: string,
    ttl: number,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(
        options.prefix ? `${options.prefix}:${key}` : key
      );
      const result = await this.redis.expire(cacheKey, ttl);
      return result === 1;
    } catch (error: any) {
      logger.error("Cache expire error:", {
        key,
        ttl,
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Obtient le TTL restant d'une clé
   */
  async getTTL(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const cacheKey = this.generateCacheKey(
        options.prefix ? `${options.prefix}:${key}` : key
      );
      return await this.redis.ttl(cacheKey);
    } catch (error: any) {
      logger.error("Cache getTTL error:", {
        key,
        error: error.message,
        stack: error.stack,
      });
      return -1;
    }
  }

  /**
   * Vide complètement le cache
   */
  async clear(): Promise<boolean> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);

      if (keys.length === 0) {
        logger.info("Cache clear: no keys to delete");
        return true;
      }

      const result = await this.redis.del(...keys);

      logger.info(`Cache cleared`, {
        keysDeleted: result,
        totalKeys: keys.length,
      });

      // Reset stats
      this.stats.hits = 0;
      this.stats.misses = 0;

      return result > 0;
    } catch (error: any) {
      logger.error("Cache clear error:", {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Obtient les statistiques du cache
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info("memory");
      const keys = await this.redis.keys(`${this.keyPrefix}*`);

      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : "Unknown";

      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate =
        totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
      const missRate =
        totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;

      return {
        totalKeys: keys.length,
        memoryUsage,
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round(missRate * 100) / 100,
        totalHits: this.stats.hits,
        totalMisses: this.stats.misses,
      };
    } catch (error: any) {
      logger.error("Cache stats error:", {
        error: error.message,
        stack: error.stack,
      });
      return {
        totalKeys: 0,
        memoryUsage: "Unknown",
        hitRate: 0,
        missRate: 0,
        totalHits: this.stats.hits,
        totalMisses: this.stats.misses,
      };
    }
  }

  /**
   * Cache avec fonction de fallback
   */
  async getOrSet<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Essayer de récupérer depuis le cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Si pas en cache, exécuter la fonction fallback
    try {
      const result = await fallbackFn();

      // Mettre en cache le résultat
      await this.set(key, result, options);

      return result;
    } catch (error: any) {
      logger.error("Cache getOrSet fallback error:", {
        key,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Invalide le cache pour un utilisateur spécifique
   */
  async invalidateUserCache(userId: string): Promise<number> {
    return await this.deletePattern(`user:${userId}:*`);
  }

  /**
   * Invalide le cache pour un projet spécifique
   */
  async invalidateProjectCache(projectId: string): Promise<number> {
    return await this.deletePattern(`project:${projectId}:*`);
  }

  /**
   * Génère une clé de cache pour les générations AI
   */
  generateAIKey(
    type: string,
    userId: string,
    projectId: string,
    contentHash?: string
  ): string {
    const baseKey = `ai:${type}:${userId}:${projectId}`;
    return contentHash ? `${baseKey}:${contentHash}` : baseKey;
  }

  /**
   * Génère une clé de cache pour les requêtes de base de données
   */
  generateDBKey(collection: string, userId: string, id?: string): string {
    const baseKey = `db:${collection}:${userId}`;
    return id ? `${baseKey}:${id}` : baseKey;
  }
}

// Instance singleton du service de cache
export const cacheService = new CacheService();
