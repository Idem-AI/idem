import { IRepository } from './IRepository';
import { FirestoreRepository } from './FirestoreRepository';
import { MongooseRepository } from './MongooseRepository';
import { activeSGBD, SGBDType } from './database.config';
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
   * Get a repository instance for the active SGBD
   * @returns A repository instance
   */
  public static getRepository<T extends BaseEntity>(): IRepository<T> {
    logger.info(`RepositoryFactory.getRepository called, SGBD: ${activeSGBD}`);

    switch (activeSGBD) {
      case SGBDType.MONGODB:
        logger.info(`Creating MongooseRepository`);
        return new MongooseRepository<T>();
      case SGBDType.FIRESTORE:
        logger.info(`Creating FirestoreRepository (backward compatibility)`);
        return new FirestoreRepository<T>();
      default:
        logger.error(`Unsupported SGBD type: ${activeSGBD}`);
        throw new Error(`Unsupported SGBD type: ${activeSGBD}`);
    }
  }
}
