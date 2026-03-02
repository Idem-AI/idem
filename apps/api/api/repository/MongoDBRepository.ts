import mongoose, { Model, Document, Schema } from 'mongoose';
import { IRepository } from './IRepository';
import logger from '../config/logger';
import { cacheService } from '../services/cache.service';
import * as schemas from '../schemas';

interface MongoDocument extends Document {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Mapping des collections vers leurs schémas
const SCHEMA_MAP: Record<string, Schema> = {
  users: schemas.UserSchema,
  projects: schemas.ProjectSchema,
  archetypes: schemas.ArchetypeSchema,
  deployments: schemas.DeploymentSchema,
  contacts: schemas.ContactSchema,
};

export class MongoDBRepository<
  T extends { id?: string; createdAt?: Date; updatedAt?: Date },
> implements IRepository<T> {
  private models: Map<string, Model<any>> = new Map();

  constructor() {
    logger.info('MongoDBRepository initialized');
  }

  private getOrCreateModel(collectionPath: string): Model<any> {
    const collectionName = this.pathToCollectionName(collectionPath);

    if (this.models.has(collectionName)) {
      return this.models.get(collectionName)!;
    }

    // Utiliser le schéma prédéfini si disponible, sinon créer un schéma générique
    let schema: Schema;

    if (SCHEMA_MAP[collectionName]) {
      schema = SCHEMA_MAP[collectionName];
      logger.info(`Using predefined schema for collection: ${collectionName}`);
    } else {
      // Schéma générique pour les collections non définies
      schema = new Schema(
        {},
        {
          strict: false,
          timestamps: true,
          collection: collectionName,
        }
      );
      logger.info(`Created generic schema for collection: ${collectionName}`);
    }

    // Configuration de transformation pour toutes les collections
    schema.set('toJSON', {
      virtuals: true,
      versionKey: false,
      transform: function (doc: any, ret: any) {
        if (ret._id) {
          ret.id = ret._id.toString();
          delete ret._id;
        }
        return ret;
      },
    });

    schema.set('toObject', {
      virtuals: true,
      versionKey: false,
      transform: function (doc: any, ret: any) {
        if (ret._id) {
          ret.id = ret._id.toString();
          delete ret._id;
        }
        return ret;
      },
    });

    try {
      // Vérifier si le modèle existe déjà dans mongoose
      const model = mongoose.models[collectionName] || mongoose.model(collectionName, schema);
      this.models.set(collectionName, model);
      logger.info(`Mongoose model ready for collection: ${collectionName}`);
      return model;
    } catch (error: any) {
      logger.error(`Error creating model for ${collectionName}: ${error.message}`);
      throw error;
    }
  }

  private pathToCollectionName(collectionPath: string): string {
    return collectionPath.replace(/\//g, '_');
  }

  private toPlainObject(doc: any): T {
    if (!doc) return null as any;

    const obj = doc.toObject ? doc.toObject() : doc;

    if (obj._id) {
      obj.id = obj._id.toString();
      delete obj._id;
    }

    delete obj.__v;

    return obj as T;
  }

  async create(
    item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    collectionPath: string,
    id?: string
  ): Promise<T> {
    logger.info(
      `MongoDBRepository.create called for collection path: ${collectionPath}, customId: ${id || 'N/A'}`
    );

    try {
      const Model = this.getOrCreateModel(collectionPath);

      const dataToSave: any = {
        ...item,
      };

      if (id) {
        dataToSave._id = id;
      }

      const doc = new Model(dataToSave);
      await doc.save();

      const createdItem = this.toPlainObject(doc);

      logger.info(
        `Document created successfully in ${collectionPath}, documentId: ${createdItem.id}${id ? ' (custom ID)' : ' (generated ID)'}`
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
    const cacheKey = cacheService.generateDBKey(collectionPath.replace(/\//g, ':'), 'system', id);

    const cached = await cacheService.get<T>(cacheKey, {
      prefix: 'db',
      ttl: 1800,
    });

    if (cached) {
      logger.debug(`Database cache hit for ${collectionPath}/${id}`);
      return cached;
    }

    logger.info(`MongoDBRepository.findById called for ${collectionPath}, id: ${id}`);

    try {
      const Model = this.getOrCreateModel(collectionPath);
      const doc = await Model.findById(id).exec();

      if (!doc) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return null;
      }

      const entity = this.toPlainObject(doc);

      await cacheService.set(cacheKey, entity, {
        prefix: 'db',
        ttl: 1800,
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
    logger.info(`MongoDBRepository.findAll called for ${collectionPath}`);

    try {
      const Model = this.getOrCreateModel(collectionPath);
      const docs = await Model.find({}).exec();

      if (!docs || docs.length === 0) {
        logger.info(`No documents found in ${collectionPath}`);
        return [];
      }

      const entities = docs.map((doc) => this.toPlainObject(doc));

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
    logger.info(`MongoDBRepository.update called for ${collectionPath}, id: ${id}`);

    try {
      const Model = this.getOrCreateModel(collectionPath);

      const doc = await Model.findByIdAndUpdate(
        id,
        { $set: item },
        { new: true, runValidators: false }
      ).exec();

      if (!doc) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return null;
      }

      const updatedEntity = this.toPlainObject(doc);

      const cacheKey = cacheService.generateDBKey(collectionPath.replace(/\//g, ':'), 'system', id);
      await cacheService.delete(cacheKey, { prefix: 'db' });

      await cacheService.set(cacheKey, updatedEntity, {
        prefix: 'db',
        ttl: 1800,
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
    logger.info(`MongoDBRepository.delete called for ${collectionPath}, id: ${id}`);

    try {
      const Model = this.getOrCreateModel(collectionPath);
      const result = await Model.findByIdAndDelete(id).exec();

      if (!result) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return false;
      }

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
