import { IRepository } from './IRepository';
import { MongoDBRepository } from './MongoDBRepository';
import logger from '../config/logger';

// Define a base type for entities that might have createdAt/updatedAt as Date
// This ensures the factory can work with the generic constraint of IRepository
interface BaseEntity {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RepositoryFactory {
  /**
   * Get a repository instance (MongoDB only)
   * @returns A MongoDB repository instance
   */
  public static getRepository<T extends BaseEntity>(): IRepository<T> {
    logger.info(`RepositoryFactory.getRepository called - Using MongoDB`);
    return new MongoDBRepository<T>();
  }
}
