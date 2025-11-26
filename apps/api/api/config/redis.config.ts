import Redis from 'ioredis';
import logger from './logger';

/**
 * Configuration Redis pour le cache
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
}

/**
 * Configuration par défaut pour Redis
 */
const defaultConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

/**
 * Instance Redis singleton
 */
class RedisConnection {
  private static instance: Redis | null = null;
  private static isConnected: boolean = false;

  /**
   * Obtient l'instance Redis (singleton)
   */
  public static getInstance(): Redis {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new Redis(defaultConfig);
      RedisConnection.setupEventHandlers();
    }
    return RedisConnection.instance;
  }

  /**
   * Configure les gestionnaires d'événements Redis
   */
  private static setupEventHandlers(): void {
    if (!RedisConnection.instance) return;

    RedisConnection.instance.on('connect', () => {
      logger.info('Redis connected successfully');
      RedisConnection.isConnected = true;
    });

    RedisConnection.instance.on('ready', () => {
      logger.info('Redis ready to receive commands');
    });

    RedisConnection.instance.on('error', (error) => {
      logger.error('Redis connection error:', { error: error.message, stack: error.stack });
      RedisConnection.isConnected = false;
    });

    RedisConnection.instance.on('close', () => {
      logger.warn('Redis connection closed');
      RedisConnection.isConnected = false;
    });

    RedisConnection.instance.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  /**
   * Vérifie si Redis est connecté
   */
  public static isRedisConnected(): boolean {
    return RedisConnection.isConnected;
  }

  /**
   * Ferme la connexion Redis
   */
  public static async disconnect(): Promise<void> {
    if (RedisConnection.instance) {
      await RedisConnection.instance.quit();
      RedisConnection.instance = null;
      RedisConnection.isConnected = false;
      logger.info('Redis connection closed gracefully');
    }
  }

  /**
   * Test de connexion Redis
   */
  public static async testConnection(): Promise<boolean> {
    try {
      const redis = RedisConnection.getInstance();
      await redis.ping();
      logger.info('Redis connection test successful');
      return true;
    } catch (error: any) {
      logger.error('Redis connection test failed:', { error: error.message });
      return false;
    }
  }
}

export default RedisConnection;
