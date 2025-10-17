import { IRepository } from './IRepository';
import { FirestoreRepository } from './FirestoreRepository';
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
      case SGBDType.FIRESTORE:
        logger.info(`Creating FirestoreRepository`);
        return new FirestoreRepository<T>();
      // case SGBDType.MONGODB:
      //   // Assuming you would have a MongoDBRepository that implements IRepository
      //   // import { MongoDBRepository } from './MongoDBRepository'; 
      //   // return new MongoDBRepository<T>(collectionName, userSpecificCollection);
      // case SGBDType.POSTGRESQL:
      //   // Assuming you would have a PostgreSQLRepository that implements IRepository
      //   // import { PostgreSQLRepository } from './PostgreSQLRepository';
      //   // return new PostgreSQLRepository<T>(collectionName, userSpecificCollection, someDbConnection);
      default:
        logger.error(`Unsupported SGBD type: ${activeSGBD}`);
        throw new Error(`Unsupported SGBD type: ${activeSGBD}`);
    }
  }
}
