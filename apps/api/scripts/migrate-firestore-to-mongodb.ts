import admin from 'firebase-admin';
import mongoose from 'mongoose';
import { User } from '../api/schemas/user.schema';
import { Project } from '../api/schemas/project.schema';
import logger from '../api/config/logger';
import dotenv from 'dotenv';
import * as Minio from 'minio';
import { Readable } from 'stream';

dotenv.config();

/**
 * Script de migration complet des données de Firestore vers MongoDB
 * et des fichiers de Firebase Storage vers MinIO
 *
 * Usage:
 * ts-node scripts/migrate-firestore-to-mongodb.ts
 */

interface MigrationStats {
  users: { total: number; migrated: number; errors: number };
  projects: { total: number; migrated: number; errors: number };
  files: { total: number; migrated: number; errors: number; skipped: number };
}

class FirestoreToMongoDBMigration {
  private stats: MigrationStats = {
    users: { total: 0, migrated: 0, errors: 0 },
    projects: { total: 0, migrated: 0, errors: 0 },
    files: { total: 0, migrated: 0, errors: 0, skipped: 0 },
  };

  private minioClient!: Minio.Client;
  private minioBucket: string;
  private firebaseBucket: any;

  constructor() {
    this.minioBucket = process.env.MINIO_BUCKET_NAME || 'idem-storage2';
  }

  async connect() {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/idem?authSource=admin';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Initialize Firebase Admin (if not already done)
    if (!admin.apps.length) {
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    }
    logger.info('Connected to Firestore');

    // Get Firebase Storage bucket
    // this.firebaseBucket = admin.storage().bucket();
    // logger.info('Connected to Firebase Storage');

    // TODO: Décommenter pour la migration en production
    // Initialize MinIO client
    // this.minioClient = new Minio.Client({
    //   endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    //   port: parseInt(process.env.MINIO_PORT || '9000'),
    //   useSSL: process.env.MINIO_USE_SSL === 'true',
    //   accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    //   secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    // });

    // Ensure MinIO bucket exists
    // const bucketExists = await this.minioClient.bucketExists(this.minioBucket);
    // if (!bucketExists) {
    //   await this.minioClient.makeBucket(this.minioBucket, 'us-east-1');
    //   logger.info(`MinIO bucket created: ${this.minioBucket}`);

    //   // Set bucket policy to public read
    //   const policy = {
    //     Version: '2012-10-17',
    //     Statement: [
    //       {
    //         Effect: 'Allow',
    //         Principal: { AWS: ['*'] },
    //         Action: ['s3:GetObject'],
    //         Resource: [`arn:aws:s3:::${this.minioBucket}/*`],
    //       },
    //     ],
    //   };
    //   await this.minioClient.setBucketPolicy(this.minioBucket, JSON.stringify(policy));
    //   logger.info('MinIO bucket policy set to public read');
    // }
    // logger.info('Connected to MinIO');
    logger.info('MinIO migration skipped (commented out for faster execution)');
  }

  async migrateUsers() {
    logger.info('Starting users migration...');

    try {
      const snapshot = await admin.firestore().collection('users').get();
      this.stats.users.total = snapshot.size;

      for (const doc of snapshot.docs) {
        try {
          const data = doc.data();

          // Check if user already exists in MongoDB
          const existingUser = await User.findOne({ uid: doc.id });
          if (existingUser) {
            logger.info(`User ${doc.id} already exists in MongoDB, skipping`);
            this.stats.users.migrated++;
            continue;
          }

          // Convert Firestore Timestamps to Date
          const userData = {
            _id: doc.id,
            uid: data.uid || doc.id,
            email: data.email,
            displayName: data.displayName,
            photoURL: data.photoURL,
            subscription: data.subscription || 'free',
            createdAt: data.createdAt?.toDate() || new Date(),
            lastLogin: data.lastLogin?.toDate() || new Date(),
            quota: data.quota || {},
            roles: data.roles || [],
            githubIntegration: data.githubIntegration
              ? {
                  ...data.githubIntegration,
                  connectedAt: data.githubIntegration.connectedAt?.toDate(),
                  lastUsed: data.githubIntegration.lastUsed?.toDate(),
                }
              : undefined,
            refreshTokens: data.refreshTokens?.map((token: any) => ({
              ...token,
              expiresAt: token.expiresAt?.toDate(),
              createdAt: token.createdAt?.toDate(),
              lastUsed: token.lastUsed?.toDate(),
            })),
            policyAcceptance: data.policyAcceptance
              ? {
                  ...data.policyAcceptance,
                  lastAcceptedAt: data.policyAcceptance.lastAcceptedAt?.toDate(),
                }
              : undefined,
          };

          // Use native MongoDB collection to insert with custom string _id
          await mongoose.connection.collection('users').insertOne(userData as any);
          this.stats.users.migrated++;
          logger.info(`Migrated user: ${doc.id}`);
        } catch (error: any) {
          this.stats.users.errors++;
          logger.error(`Error migrating user ${doc.id}:`, {
            message: error.message,
            code: error.code,
            stack: error.stack?.split('\n')[0],
          });
        }
      }

      logger.info(
        `Users migration completed: ${this.stats.users.migrated}/${this.stats.users.total} migrated, ${this.stats.users.errors} errors`
      );
    } catch (error: any) {
      logger.error('Error during users migration:', error.message);
      throw error;
    }
  }

  async migrateProjects() {
    logger.info('Starting projects migration...');

    try {
      // Get all users to access their projects subcollections
      const usersSnapshot = await admin.firestore().collection('users').get();
      logger.info(`Found ${usersSnapshot.size} users, checking for projects...`);

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        // Get projects subcollection for this user
        const projectsSnapshot = await admin
          .firestore()
          .collection('users')
          .doc(userId)
          .collection('projects')
          .get();

        if (projectsSnapshot.empty) {
          continue;
        }

        logger.info(`Found ${projectsSnapshot.size} projects for user ${userId}`);
        this.stats.projects.total += projectsSnapshot.size;

        for (const doc of projectsSnapshot.docs) {
          try {
            const data = doc.data();

            // Check if project already exists in MongoDB
            const existingProject = await mongoose.connection
              .collection('projects')
              .findOne({ _id: doc.id } as any);

            if (existingProject) {
              logger.info(`Project ${doc.id} already exists in MongoDB, skipping`);
              this.stats.projects.migrated++;
              continue;
            }

            // Convert Firestore Timestamps to Date
            const projectData = {
              _id: doc.id,
              name: data.name,
              description: data.description,
              type: data.type,
              constraints: data.constraints || [],
              teamSize: data.teamSize,
              scope: data.scope,
              budgetIntervals: data.budgetIntervals,
              targets: data.targets,
              userId: userId, // Use the parent user ID
              selectedPhases: data.selectedPhases || [],
              analysisResultModel: data.analysisResultModel,
              deployments: data.deployments || [],
              activeChatMessages:
                data.activeChatMessages?.map((msg: any) => ({
                  ...msg,
                  timestamp: msg.timestamp?.toDate?.() || msg.timestamp,
                })) || [],
              policyAcceptance: data.policyAcceptance
                ? {
                    ...data.policyAcceptance,
                    acceptedAt:
                      data.policyAcceptance.acceptedAt?.toDate?.() ||
                      data.policyAcceptance.acceptedAt,
                  }
                : undefined,
              additionalInfos: data.additionalInfos || {
                email: '',
                phone: '',
                address: '',
                city: '',
                country: '',
                zipCode: '',
                teamMembers: [],
              },
              project: data.project,
              createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
              updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
            };

            // Use native MongoDB collection to insert with custom string _id
            await mongoose.connection.collection('projects').insertOne(projectData as any);
            this.stats.projects.migrated++;
            logger.info(`Migrated project: ${doc.id} for user ${userId}`);
          } catch (error: any) {
            this.stats.projects.errors++;
            logger.error(`Error migrating project ${doc.id}:`, error.message);
          }
        }
      }

      logger.info(
        `Projects migration completed: ${this.stats.projects.migrated}/${this.stats.projects.total} migrated, ${this.stats.projects.errors} errors`
      );
    } catch (error: any) {
      logger.error('Error during projects migration:', error.message);
      throw error;
    }
  }

  async migrateStorageFiles() {
    // TODO: Décommenter pour la migration en production
    logger.info('Storage migration skipped (commented out for faster execution)');
    return;

    logger.info('Starting Firebase Storage to MinIO migration...');

    try {
      // List all files in Firebase Storage
      const [files] = await this.firebaseBucket.getFiles();
      this.stats.files.total = files.length;

      logger.info(`Found ${files.length} files in Firebase Storage`);

      for (const file of files) {
        try {
          const filePath = file.name;

          // Check if file already exists in MinIO
          try {
            await this.minioClient.statObject(this.minioBucket, filePath);
            logger.info(`File ${filePath} already exists in MinIO, skipping`);
            this.stats.files.skipped++;
            continue;
          } catch (error: any) {
            // File doesn't exist in MinIO, proceed with migration
          }

          // Download file from Firebase Storage
          logger.info(`Downloading file from Firebase Storage: ${filePath}`);
          const [fileBuffer] = await file.download();

          // Get file metadata
          const [metadata] = await file.getMetadata();
          const contentType = metadata.contentType || 'application/octet-stream';

          // Upload to MinIO
          logger.info(`Uploading file to MinIO: ${filePath}`);
          const stream = Readable.from(fileBuffer);

          await this.minioClient.putObject(this.minioBucket, filePath, stream, fileBuffer.length, {
            'Content-Type': contentType,
            'x-amz-meta-migrated-from': 'firebase-storage',
            'x-amz-meta-migrated-at': new Date().toISOString(),
          });

          this.stats.files.migrated++;
          logger.info(`Successfully migrated file: ${filePath} (${fileBuffer.length} bytes)`);
        } catch (error: any) {
          this.stats.files.errors++;
          logger.error(`Error migrating file ${file.name}:`, error.message);
        }
      }

      logger.info(
        `Storage migration completed: ${this.stats.files.migrated}/${this.stats.files.total} migrated, ${this.stats.files.skipped} skipped, ${this.stats.files.errors} errors`
      );
    } catch (error: any) {
      logger.error('Error during storage migration:', error.message);
      throw error;
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }

  printStats() {
    console.log('\n========================================');
    console.log('Migration Statistics');
    console.log('========================================');
    console.log('\nUsers:');
    console.log(`  Total:    ${this.stats.users.total}`);
    console.log(`  Migrated: ${this.stats.users.migrated}`);
    console.log(`  Errors:   ${this.stats.users.errors}`);
    console.log('\nProjects:');
    console.log(`  Total:    ${this.stats.projects.total}`);
    console.log(`  Migrated: ${this.stats.projects.migrated}`);
    console.log(`  Errors:   ${this.stats.projects.errors}`);
    console.log('\nStorage Files:');
    console.log(`  Total:    ${this.stats.files.total}`);
    console.log(`  Migrated: ${this.stats.files.migrated}`);
    console.log(`  Skipped:  ${this.stats.files.skipped}`);
    console.log(`  Errors:   ${this.stats.files.errors}`);
    console.log('\n========================================\n');
  }
}

// Main execution
async function main() {
  const migration = new FirestoreToMongoDBMigration();

  try {
    console.log('Starting complete migration (Firestore->MongoDB + Firebase Storage->MinIO)...\n');

    await migration.connect();

    // Migrate users first (projects depend on users)
    // await migration.migrateUsers();

    // // Then migrate projects
    // await migration.migrateProjects();

    // Finally migrate storage files
    await migration.migrateStorageFiles();

    migration.printStats();

    console.log('Migration completed successfully!');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await migration.disconnect();
  }
}

// Run migration if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { FirestoreToMongoDBMigration };
