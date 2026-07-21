import mongoose, { Model, Document } from 'mongoose';
import { IRepository } from './IRepository';
import logger from '../config/logger';
import { cacheService } from '../services/cache.service';
import {
  extractUserIdFromPath,
  isProjectCollectionPath,
  recordProjectRevisions,
} from '../services/history/project-revision-hook';

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

        // Versioning hook (Chronicle): baseline v1 for each non-empty section.
        if (isProjectCollectionPath(collectionPath)) {
          await recordProjectRevisions(
            id,
            extractUserIdFromPath(collectionPath) || (createdItem as any).userId || '',
            null,
            createdItem as any
          );
        }

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

      // Versioning hook (Chronicle): baseline v1 for each non-empty section.
      if (isProjectCollectionPath(collectionPath)) {
        await recordProjectRevisions(
          createdItem.id as string,
          extractUserIdFromPath(collectionPath) || (createdItem as any).userId || '',
          null,
          createdItem as any
        );
      }

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

  async findById(id: string, collectionPath: string, options?: { bypassCache?: boolean }): Promise<T | null> {
    // Generate cache key for this specific document
    const cacheKey = cacheService.generateDBKey(collectionPath.replace(/\//g, ':'), 'system', id);

    // Try to get from cache first (unless bypassed)
    if (!options?.bypassCache) {
      const cached = await cacheService.get<T>(cacheKey, {
        prefix: 'db',
        ttl: 1800, // 30 minutes
      });

      if (cached) {
        logger.debug(`Database cache hit for ${collectionPath}/${id}`);
        return cached;
      }
    } else {
      logger.info(`Bypassing database cache for ${collectionPath}/${id}`);
    }

    logger.info(`MongooseRepository.findById called for ${collectionPath}, id: ${id}`);

    try {
      // Extract the target collection name (last segment for nested paths)
      const parts = collectionPath.split('/');
      const collectionName = parts[parts.length - 1];
      const nestedFilter = this.buildNestedFilter(collectionPath);

      // Try to convert ID to ObjectId if possible (robustness for native driver)
      let queryId: any = id;
      if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
        queryId = new mongoose.Types.ObjectId(id);
      }

      // Use native MongoDB collection to support string _id (Firebase UIDs)
      // Try both ObjectId and string just in case
      let doc = await mongoose.connection
        .collection(collectionName)
        .findOne({ _id: queryId, ...nestedFilter } as any);

      if (!doc && queryId !== id) {
        // Fallback to string ID if ObjectId search failed
        doc = await mongoose.connection
          .collection(collectionName)
          .findOne({ _id: id, ...nestedFilter } as any);
      }

      if (!doc) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return null;
      }

      const entity = this.mapToEntity(doc);

      logger.debug(`Document found in ${collectionPath} with id: ${id}`);
      
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

      // Try to convert ID to ObjectId if possible
      let queryId: any = id;
      if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
        queryId = new mongoose.Types.ObjectId(id);
      }

      // Capture the pre-update state for the versioning hook (projects only).
      let beforeEntity: T | null = null;
      if (isProjectCollectionPath(collectionPath)) {
        try {
          const beforeDoc = await mongoose.connection
            .collection(collectionName)
            .findOne({ _id: queryId, ...nestedFilter } as any);
          const beforeDocFallback =
            !beforeDoc && queryId !== id
              ? await mongoose.connection
                  .collection(collectionName)
                  .findOne({ _id: id, ...nestedFilter } as any)
              : null;
          const resolved = beforeDoc || beforeDocFallback;
          beforeEntity = resolved ? this.mapToEntity(resolved) : null;
        } catch (hookError: any) {
          logger.warn(`Versioning pre-read failed for ${collectionPath}/${id}: ${hookError.message}`);
        }
      }

      // Use native MongoDB collection to support string _id (Firebase UIDs)
      const query = { _id: queryId, ...nestedFilter };

      let result = await mongoose.connection
        .collection(collectionName)
        .findOneAndUpdate(
          query as any,
          { $set: { ...item, updatedAt: new Date() } },
          { returnDocument: 'after' }
        );

      // Handle MongoDB Driver v4 ModifyResult wrapper if present
      let updatedDoc = result && (result as any).value !== undefined ? (result as any).value : result;

      if (!updatedDoc && queryId !== id) {
        // Fallback to string ID if ObjectId update failed
        result = await mongoose.connection
          .collection(collectionName)
          .findOneAndUpdate(
            { _id: id, ...nestedFilter } as any,
            { $set: { ...item, updatedAt: new Date() } },
            { returnDocument: 'after' }
          );
        updatedDoc = result && (result as any).value !== undefined ? (result as any).value : result;
      }

      if (!updatedDoc) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return null;
      }

      const updatedEntity = {
        ...updatedDoc,
        id: updatedDoc._id.toString(),
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

      // Versioning hook (Chronicle): record per-section revisions for projects.
      if (isProjectCollectionPath(collectionPath)) {
        await recordProjectRevisions(
          id,
          extractUserIdFromPath(collectionPath) || (updatedEntity as any).userId || '',
          beforeEntity as any,
          updatedEntity as any
        );
      }

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

  async findOne(query: Record<string, any>, collectionPath: string): Promise<T | null> {
    logger.info(`MongooseRepository.findOne called for ${collectionPath}`);

    try {
      const parts = collectionPath.split('/');
      const collectionName = parts[parts.length - 1];
      const nestedFilter = this.buildNestedFilter(collectionPath);

      // Special handling for _id in query
      const processedQuery = { ...query };
      if (processedQuery._id && typeof processedQuery._id === 'string' && mongoose.Types.ObjectId.isValid(processedQuery._id)) {
        // Try searching with ObjectId first
        const objectIdQuery = { ...processedQuery, _id: new mongoose.Types.ObjectId(processedQuery._id), ...nestedFilter };
        const doc = await mongoose.connection
          .collection(collectionName)
          .findOne(objectIdQuery as any);
        
        if (doc) return this.mapToEntity(doc);
      }

      // Fallback or standard search
      const doc = await mongoose.connection
        .collection(collectionName)
        .findOne({ ...processedQuery, ...nestedFilter } as any);

      if (!doc) {
        return null;
      }

      return this.mapToEntity(doc);
    } catch (error: any) {
      logger.error(`Error in findOne for ${collectionPath}: ${error.message}`, {
        stack: error.stack,
      });
      throw error;
    }
  }

  async find(query: Record<string, any>, collectionPath: string): Promise<T[]> {
    logger.info(`MongooseRepository.find called for ${collectionPath}`);

    try {
      const parts = collectionPath.split('/');
      const collectionName = parts[parts.length - 1];
      const nestedFilter = this.buildNestedFilter(collectionPath);

      const docs = await mongoose.connection
        .collection(collectionName)
        .find({ ...query, ...nestedFilter } as any)
        .toArray();

      if (!docs || docs.length === 0) {
        return [];
      }

      return docs.map((doc) => this.mapToEntity(doc));
    } catch (error: any) {
      logger.error(`Error in find for ${collectionPath}: ${error.message}`, {
        stack: error.stack,
      });
      throw error;
    }
  }
  private mapToEntity(doc: any): T {
    const entity = {
      ...doc,
      id: doc._id.toString(),
    } as unknown as T;

    delete (entity as any)._id;
    delete (entity as any).__v;

    return entity;
  }
}

