import admin from "firebase-admin";
import {
  CollectionReference,
  DocumentReference,
  Timestamp,
  Firestore,
} from "firebase-admin/firestore";
import { IRepository } from "./IRepository";
import logger from "../config/logger";
import { cacheService } from "../services/cache.service";

/**
 * A generic Firestore repository implementation.
 * @template T The type of the document, must have an 'id' property and optionally 'createdAt', 'updatedAt' as Date.
 */
export class FirestoreRepository<
  T extends { id?: string; createdAt?: Date; updatedAt?: Date }
> implements IRepository<T>
{
  /**
   * Constructor for FirestoreRepository
   */
  constructor() {
    logger.info(`FirestoreRepository initialized`);
  }

  // Static property to track if settings have been applied
  private static settingsApplied = false;

  private getDb(): Firestore {
    const db = admin.firestore();

    // Only apply settings once
    if (!FirestoreRepository.settingsApplied) {
      db.settings({ ignoreUndefinedProperties: true });
      FirestoreRepository.settingsApplied = true;
      logger.info("Firestore settings applied: ignoreUndefinedProperties=true");
    }

    return db;
  }

  private getCollection(collectionPath: string): CollectionReference {
    const db = this.getDb();
    return db.collection(collectionPath);
  }

  private getDocument(id: string, collectionPath: string): DocumentReference {
    return this.getCollection(collectionPath).doc(id);
  }

  // Helper to convert Firestore Timestamps in data to Date objects
  private fromFirestore(
    data: admin.firestore.DocumentData | undefined
  ): T | null {
    if (!data) return null;
    const entity = { ...data } as any; // Use 'any' for intermediate transformation
    if (data.createdAt && data.createdAt instanceof Timestamp) {
      entity.createdAt = data.createdAt.toDate();
    }
    if (data.updatedAt && data.updatedAt instanceof Timestamp) {
      entity.updatedAt = data.updatedAt.toDate();
    }
    return entity as T;
  }

  // Helper to convert Date objects in item to Firestore Timestamps
  private toFirestore(item: Partial<T>): any {
    const firestoreData = { ...item } as any;
    if (item.createdAt && item.createdAt instanceof Date) {
      firestoreData.createdAt = Timestamp.fromDate(item.createdAt);
    }
    if (item.updatedAt && item.updatedAt instanceof Date) {
      firestoreData.updatedAt = Timestamp.fromDate(item.updatedAt);
    }
    return firestoreData;
  }

  async create(
    item: Omit<T, "id" | "createdAt" | "updatedAt">,
    collectionPath: string,
    id?: string
  ): Promise<T> {
    logger.info(
      `FirestoreRepository.create called for collection path: ${collectionPath}, customId: ${id || "N/A"}`
    );
    try {
      const collectionRef = this.getCollection(collectionPath);
      const dataToSave = this.toFirestore({
        ...item,
        createdAt: new Date(), // Set by application logic, converted by toFirestore
        updatedAt: new Date(), // Set by application logic, converted by toFirestore
      } as Partial<T>); // Cast to Partial<T> as id is not yet present

      let docRef: DocumentReference;
      let documentId: string;

      if (id) {
        // Use the provided ID
        docRef = collectionRef.doc(id);
        await docRef.set(dataToSave);
        documentId = id;
      } else {
        // Let Firestore generate the ID
        docRef = await collectionRef.add(dataToSave);
        documentId = docRef.id;
      }

      // Return the entity with its ID and converted dates
      const createdItem = {
        id: documentId,
        ...this.fromFirestore(dataToSave)!,
        ...item,
      } as T;
      logger.info(
        `Document created successfully in ${collectionPath}, documentId: ${documentId}${id ? " (custom ID)" : " (generated ID)"}`
      );
      return createdItem;
    } catch (error: any) {
      logger.error(
        `Error creating document in ${collectionPath}: ${error.message}`,
        { stack: error.stack, item, customId: id }
      );
      throw error;
    }
  }

  async findById(id: string, collectionPath: string): Promise<T | null> {
    // Generate cache key for this specific document
    const cacheKey = cacheService.generateDBKey(collectionPath.replace(/\//g, ':'), 'system', id);
    
    // Try to get from cache first
    const cached = await cacheService.get<T>(cacheKey, { 
      prefix: 'db',
      ttl: 1800 // 30 minutes
    });

    if (cached) {
      logger.debug(`Database cache hit for ${collectionPath}/${id}`);
      return cached;
    }

    logger.info(
      `FirestoreRepository.findById called for ${collectionPath}, id: ${id}`
    );

    try {
      const docRef = this.getDocument(id, collectionPath);
      const doc = await docRef.get();

      if (!doc.exists) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return null;
      }

      const data = doc.data();
      const entity = {
        id: doc.id,
        ...this.fromFirestore(data),
      } as T;

      // Cache the result for future requests
      await cacheService.set(cacheKey, entity, { 
        prefix: 'db',
        ttl: 1800 // 30 minutes
      });

      logger.info(`Document found in ${collectionPath} with id: ${id}`);
      return entity;
    } catch (error: any) {
      logger.error(
        `Error finding document in ${collectionPath} with id ${id}: ${error.message}`,
        { stack: error.stack }
      );
      throw error;
    }
  }

  async findAll(collectionPath: string): Promise<T[]> {
    logger.info(`FirestoreRepository.findAll called for ${collectionPath}`);

    try {
      const collectionRef = this.getCollection(collectionPath);
      const snapshot = await collectionRef.get();

      if (snapshot.empty) {
        logger.info(`No documents found in ${collectionPath}`);
        return [];
      }

      const entities = snapshot.docs.map((doc) => {
        return {
          id: doc.id,
          ...this.fromFirestore(doc.data()),
        } as T;
      });

      logger.info(
        `Found ${entities.length} documents in ${collectionPath}`
      );
      return entities;
    } catch (error: any) {
      logger.error(
        `Error finding documents in ${collectionPath}: ${error.message}`,
        { stack: error.stack }
      );
      throw error;
    }
  }

  async update(
    id: string,
    item: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
    collectionPath: string
  ): Promise<T | null> {
    logger.info(
      `FirestoreRepository.update called for ${collectionPath}, id: ${id}`
    );

    try {
      // First check if document exists
      const docRef = this.getDocument(id, collectionPath);
      const doc = await docRef.get();

      if (!doc.exists) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return null;
      }

      // Prepare data for update, including updatedAt timestamp
      const dataToUpdate = this.toFirestore({
        ...item,
        updatedAt: new Date(),
      } as Partial<T>);

      // Update the document
      await docRef.update(dataToUpdate);

      // Get the updated document
      const updatedDoc = await docRef.get();
      const updatedData = updatedDoc.data();

      // Return the updated entity
      const updatedEntity = {
        id: updatedDoc.id,
        ...this.fromFirestore(updatedData),
      } as T;

      // Invalidate cache for this document
      const cacheKey = cacheService.generateDBKey(collectionPath.replace(/\//g, ':'), 'system', id);
      await cacheService.delete(cacheKey, { prefix: 'db' });

      // Cache the updated entity
      await cacheService.set(cacheKey, updatedEntity, { 
        prefix: 'db',
        ttl: 1800 // 30 minutes
      });

      logger.info(`Document updated in ${collectionPath} with id: ${id}`);
      return updatedEntity;
    } catch (error: any) {
      logger.error(
        `Error updating document in ${collectionPath} with id ${id}: ${error.message}`,
        { stack: error.stack, item }
      );
      throw error;
    }
  }



  async delete(id: string, collectionPath: string): Promise<boolean> {
    logger.info(
      `FirestoreRepository.delete called for ${collectionPath}, id: ${id}`
    );

    try {
      const docRef = this.getDocument(id, collectionPath);
      const doc = await docRef.get();

      if (!doc.exists) {
        logger.warn(`Document not found in ${collectionPath} with id: ${id}`);
        return false;
      }

      await docRef.delete();
      logger.info(`Document deleted in ${collectionPath} with id: ${id}`);
      return true;
    } catch (error: any) {
      logger.error(
        `Error deleting document in ${collectionPath} with id ${id}: ${error.message}`,
        { stack: error.stack }
      );
      throw error;
    }
  }
}
