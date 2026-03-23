import mongoose, { Model, Document } from 'mongoose';
import { IRepository } from './IRepository';
import logger from '../config/logger';
import { cacheService } from '../services/cache.service';

/**
 * A generic Mongoose repository implementation.
 * @template T The type of the document, must have an 'id' property and optionally 'createdAt', 'updatedAt' as Date.
 */
export class MongooseRepository<
  T extends { id?: string; createdAt?: Date; updatedAt?: Date },
> implements IRepository<T> {
  constructor() {
    logger.info(`MongooseRepository initialized`);
  }

  /**
   * Get Mongoose model from collection path
   * Collection path format: "users" or "users/{userId}/projects"
   */
  private getModel(collectionPath: string): Model<any> {
    // Extract the target collection name (last segment for nested paths)
    const parts = collectionPath.split('/');
    const collectionName = parts[parts.length - 1];

    // Try to get existing model or return a generic one
    try {
      return mongoose.model(collectionName);
    } catch (error) {
      // Model doesn't exist, create a generic schema
      logger.warn(`Model for collection ${collectionName} not found, using generic schema`);
      const genericSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      return mongoose.model(collectionName, genericSchema);
    }
  }

  /**
   * Build query filter for nested collections
   * Example: "users/user123/projects" -> { userId: "user123" }
   */
  private buildNestedFilter(collectionPath: string): Record<string, any> {
    const parts = collectionPath.split('/');
    const filter: Record<string, any> = {};

    // Parse path like "users/{userId}/projects/{projectId}/items"
    for (let i = 0; i < parts.length - 1; i += 2) {
      if (i + 1 < parts.length) {
        const fieldName = `${parts[i].slice(0, -1)}Id`; // "users" -> "userId"
        filter[fieldName] = parts[i + 1];
      }
    }

    return filter;
  }

  async create(
    item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    collectionPath: string,
    id?: string
  ): Promise<T> {
    logger.info(
      `MongooseRepository.create called for collection path: ${collectionPath}, customId: ${id || 'N/A'}`
    );

    try {
      // Extract the target collection name (last segment for nested paths)
      const parts = collectionPath.split('/');
      const collectionName = parts[parts.length - 1];
      const nestedFilter = this.buildNestedFilter(collectionPath);

      const now = new Date();
      const dataToSave = {
        ...item,
        ...nestedFilter,
        ...(id && { _id: id }),
        createdAt: now,
        updatedAt: now,
      };

      // If custom ID is provided (string), use native MongoDB collection to bypass Mongoose validation
      if (id) {
        const result = await mongoose.connection
          .collection(collectionName)
          .insertOne(dataToSave as any);

        const createdItem = {
          ...dataToSave,
          id: id,
        } as T;

        // Remove MongoDB _id from result
        delete (createdItem as any)._id;

        logger.info(
          `Document created successfully in ${collectionPath}, documentId: ${id} (custom ID via native collection)`
        );

        return createdItem;
      }

      // Otherwise use Mongoose model (will generate ObjectId)
      const Model = this.getModel(collectionPath);
      const doc = new Model(dataToSave);
      const savedDoc = await doc.save();

      const createdItem = {
        ...savedDoc.toObject(),
        id: savedDoc._id.toString(),
      } as T;

      // Remove MongoDB _id and __v from result
      delete (createdItem as any)._id;
      delete (createdItem as any).__v;

      logger.info(
        `Document created successfully in ${collectionPath}, documentId: ${createdItem.id} (generated ID)`
      );

      return createdItem;
    } catch (error: any) {
      logger.error(`Error creating document in ${collectionPath}: ${error.message}`, {
        stack: error.stack,
        item,
        customId: id,
      });
      throw error;
    }
  }

  async findById(id: string, collectionPath: string): Promise<T | null> {
    // Generate cache key for this specific document
    const cacheKey = cacheService.generateDBKey(collectionPath.replace(/\//g, ':'), 'system', id);

    // Try to get from cache first
    const cached = await cacheService.get<T>(cacheKey, {
      prefix: 'db',
      ttl: 1800, // 30 minutes
    });

    if (cached) {
      logger.debug(`Database cache hit for ${collectionPath}/${id}`);
      return cached;
    }

    logger.info(`MongooseRepository.findById called for ${collectionPath}, id: ${id}`);

    try {
      // Extract the target collection name (last segment for nested paths)
      const parts = collectionPath.split('/');
      const collectionName = parts[parts.length - 1];
      const nestedFilter = this.buildNestedFilter(collectionPath);

      // Use native MongoDB collection to support string _id (Firebase UIDs)
      const doc = await mongoose.connection
        .collection(collectionName)
        .findOne({ _id: id, ...nestedFilter } as any);

      if (!doc) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return null;
      }

      const entity = {
        ...doc,
        id: doc._id.toString(),
      } as unknown as T;

      // Remove MongoDB _id and __v from result
      delete (entity as any)._id;
      delete (entity as any).__v;

      // Cache the result for future requests
      await cacheService.set(cacheKey, entity, {
        prefix: 'db',
        ttl: 1800, // 30 minutes
      });

      logger.info(`Document found in ${collectionPath} with id: ${id}`);
      return entity;
    } catch (error: any) {
      logger.error(`Error finding document in ${collectionPath} with id ${id}: ${error.message}`, {
        stack: error.stack,
      });
      throw error;
    }
  }

  async findAll(collectionPath: string): Promise<T[]> {
    logger.info(`MongooseRepository.findAll called for ${collectionPath}`);

    try {
      const Model = this.getModel(collectionPath);
      const nestedFilter = this.buildNestedFilter(collectionPath);

      const docs = await Model.find(nestedFilter).lean();

      if (!docs || docs.length === 0) {
        logger.info(`No documents found in ${collectionPath}`);
        return [];
      }

      const entities = docs.map((doc) => {
        const entity = {
          ...doc,
          id: (doc as any)._id.toString(),
        } as unknown as T;

        // Remove MongoDB _id and __v from result
        delete (entity as any)._id;
        delete (entity as any).__v;

        return entity;
      });

      logger.info(`Found ${entities.length} documents in ${collectionPath}`);
      return entities;
    } catch (error: any) {
      logger.error(`Error finding documents in ${collectionPath}: ${error.message}`, {
        stack: error.stack,
      });
      throw error;
    }
  }

  async update(
    id: string,
    item: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>,
    collectionPath: string
  ): Promise<T | null> {
    logger.info(`MongooseRepository.update called for ${collectionPath}, id: ${id}`);

    try {
      // Extract the target collection name (last segment for nested paths)
      const parts = collectionPath.split('/');
      const collectionName = parts[parts.length - 1];
      const nestedFilter = this.buildNestedFilter(collectionPath);

      // Use native MongoDB collection to support string _id (Firebase UIDs)
      const result = await mongoose.connection
        .collection(collectionName)
        .findOneAndUpdate(
          { _id: id, ...nestedFilter } as any,
          { $set: { ...item, updatedAt: new Date() } },
          { returnDocument: 'after' }
        );

      if (!result) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return null;
      }

      const updatedEntity = {
        ...result,
        id: result._id.toString(),
      } as unknown as T;

      // Remove MongoDB _id and __v from result
      delete (updatedEntity as any)._id;
      delete (updatedEntity as any).__v;

      // Invalidate cache for this document
      const cacheKey = cacheService.generateDBKey(collectionPath.replace(/\//g, ':'), 'system', id);
      await cacheService.delete(cacheKey, { prefix: 'db' });

      // Cache the updated entity
      await cacheService.set(cacheKey, updatedEntity, {
        prefix: 'db',
        ttl: 1800, // 30 minutes
      });

      logger.info(`Document updated in ${collectionPath} with id: ${id}`);
      return updatedEntity;
    } catch (error: any) {
      logger.error(`Error updating document in ${collectionPath} with id ${id}: ${error.message}`, {
        stack: error.stack,
        item,
      });
      throw error;
    }
  }

  async delete(id: string, collectionPath: string): Promise<boolean> {
    logger.info(`MongooseRepository.delete called for ${collectionPath}, id: ${id}`);

    try {
      const Model = this.getModel(collectionPath);
      const nestedFilter = this.buildNestedFilter(collectionPath);

      const result = await Model.deleteOne({ _id: id, ...nestedFilter });

      if (result.deletedCount === 0) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return false;
      }

      // Invalidate cache
      const cacheKey = cacheService.generateDBKey(collectionPath.replace(/\//g, ':'), 'system', id);
      await cacheService.delete(cacheKey, { prefix: 'db' });

      logger.info(`Document deleted in ${collectionPath} with id: ${id}`);
      return true;
    } catch (error: any) {
      logger.error(`Error deleting document in ${collectionPath} with id ${id}: ${error.message}`, {
        stack: error.stack,
      });
      throw error;
    }
  }
}
