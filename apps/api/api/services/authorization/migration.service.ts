import { UserModel } from '@idem/shared-models';
import { FirestoreRepository } from '../../repository/FirestoreRepository';
import { UserModel as LegacyUserModel } from '../../models/userModel';
import logger from '../../config/logger';
import admin from 'firebase-admin';

const USERS_COLLECTION = 'users';
const MIGRATION_STATUS_COLLECTION = 'migration_status';

interface MigrationStatus {
  id?: string;
  migrationName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  totalRecords?: number;
  migratedRecords?: number;
  failedRecords?: number;
  errors?: string[];
  createdAt: Date;
  updatedAt: Date;
}

class MigrationService {
  private userRepository: FirestoreRepository<UserModel>;
  private migrationRepository: FirestoreRepository<MigrationStatus>;

  constructor() {
    this.userRepository = new FirestoreRepository<UserModel>();
    this.migrationRepository = new FirestoreRepository<MigrationStatus>();
  }

  /**
   * Migrer un utilisateur legacy vers le nouveau modèle
   */
  private migrateUser(legacyUser: LegacyUserModel): UserModel {
    const authProvider = legacyUser.githubIntegration ? 'github' : 'google';

    const newUser: UserModel = {
      id: legacyUser.uid,
      uid: legacyUser.uid,
      email: legacyUser.email,
      displayName: legacyUser.displayName,
      photoURL: legacyUser.photoURL,
      subscription: legacyUser.subscription,
      createdAt: legacyUser.createdAt,
      lastLogin: legacyUser.lastLogin,
      quota: legacyUser.quota,

      // Authentification
      authProvider,
      githubIntegration: legacyUser.githubIntegration,
      googleIntegration:
        authProvider === 'google'
          ? {
              accessToken: '', // À récupérer si disponible
              email: legacyUser.email,
              avatarUrl: legacyUser.photoURL,
              connectedAt: legacyUser.createdAt,
              scopes: [],
            }
          : undefined,
      refreshTokens: legacyUser.refreshTokens,
      policyAcceptance: legacyUser.policyAcceptance,

      // Nouveau système d'autorisation
      isOwner: true, // Les utilisateurs existants sont propriétaires de leur compte
      teamMemberships: [],

      // Statut
      isActive: true,
      isEmailVerified: true,

      // Métadonnées
      updatedAt: new Date(),
    };

    return newUser;
  }

  /**
   * Vérifier si un utilisateur a déjà été migré
   */
  private async isUserMigrated(uid: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(uid, USERS_COLLECTION);
      // Si l'utilisateur a les nouveaux champs, il a été migré
      return user ? 'isOwner' in user : false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Migrer tous les utilisateurs existants
   */
  async migrateAllUsers(): Promise<MigrationStatus> {
    const migrationName = 'user_authorization_system';
    logger.info(`Starting migration: ${migrationName}`);

    // Créer ou récupérer le statut de migration
    let migrationStatus: MigrationStatus = {
      migrationName,
      status: 'in_progress',
      startedAt: new Date(),
      totalRecords: 0,
      migratedRecords: 0,
      failedRecords: 0,
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdStatus = await this.migrationRepository.create(
      migrationStatus,
      MIGRATION_STATUS_COLLECTION
    );

    try {
      // Récupérer tous les utilisateurs de Firebase Auth
      const listUsersResult = await admin.auth().listUsers();
      const totalUsers = listUsersResult.users.length;
      migrationStatus.totalRecords = totalUsers;

      logger.info(`Found ${totalUsers} users to migrate`);

      for (const userRecord of listUsersResult.users) {
        try {
          // Vérifier si déjà migré
          const alreadyMigrated = await this.isUserMigrated(userRecord.uid);
          if (alreadyMigrated) {
            logger.info(`User ${userRecord.uid} already migrated, skipping`);
            migrationStatus.migratedRecords!++;
            continue;
          }

          // Récupérer les données Firestore de l'utilisateur
          const firestoreUser = await this.userRepository.findById(
            userRecord.uid,
            USERS_COLLECTION
          );

          if (!firestoreUser) {
            // Créer un nouvel utilisateur si n'existe pas dans Firestore
            const newUser: UserModel = {
              uid: userRecord.uid,
              email: userRecord.email || '',
              displayName: userRecord.displayName,
              photoURL: userRecord.photoURL,
              subscription: 'free',
              createdAt: new Date(userRecord.metadata.creationTime),
              lastLogin: new Date(
                userRecord.metadata.lastSignInTime || userRecord.metadata.creationTime
              ),
              quota: {},
              authProvider: 'google',
              isOwner: true,
              teamMemberships: [],
              isActive: !userRecord.disabled,
              isEmailVerified: userRecord.emailVerified,
              updatedAt: new Date(),
            };

            await this.userRepository.create(newUser, USERS_COLLECTION, userRecord.uid);
          } else {
            // Migrer l'utilisateur existant
            const migratedUser = this.migrateUser(firestoreUser as any);
            await this.userRepository.update(userRecord.uid, migratedUser as any, USERS_COLLECTION);
          }

          migrationStatus.migratedRecords!++;
          logger.info(
            `Migrated user ${userRecord.uid} (${migrationStatus.migratedRecords}/${totalUsers})`
          );
        } catch (error: any) {
          logger.error(`Failed to migrate user ${userRecord.uid}: ${error.message}`);
          migrationStatus.failedRecords!++;
          migrationStatus.errors!.push(`${userRecord.uid}: ${error.message}`);
        }
      }

      // Finaliser la migration
      migrationStatus.status = 'completed';
      migrationStatus.completedAt = new Date();
      migrationStatus.updatedAt = new Date();

      await this.migrationRepository.update(
        createdStatus.id!,
        migrationStatus,
        MIGRATION_STATUS_COLLECTION
      );

      logger.info(
        `Migration completed: ${migrationStatus.migratedRecords} migrated, ${migrationStatus.failedRecords} failed`
      );
      return migrationStatus;
    } catch (error: any) {
      logger.error(`Migration failed: ${error.message}`);
      migrationStatus.status = 'failed';
      migrationStatus.errors!.push(error.message);
      migrationStatus.updatedAt = new Date();

      await this.migrationRepository.update(
        createdStatus.id!,
        migrationStatus,
        MIGRATION_STATUS_COLLECTION
      );

      throw error;
    }
  }

  /**
   * Vérifier le statut de la migration
   */
  async getMigrationStatus(migrationName: string): Promise<MigrationStatus | null> {
    const allMigrations = await this.migrationRepository.findAll(MIGRATION_STATUS_COLLECTION);
    return allMigrations.find((m) => m.migrationName === migrationName) || null;
  }

  /**
   * Migrer un utilisateur spécifique (pour les nouveaux utilisateurs)
   */
  async migrateUserIfNeeded(uid: string): Promise<void> {
    const alreadyMigrated = await this.isUserMigrated(uid);
    if (alreadyMigrated) {
      return;
    }

    logger.info(`Migrating user on-demand: ${uid}`);

    const firestoreUser = await this.userRepository.findById(uid, USERS_COLLECTION);
    if (firestoreUser) {
      const migratedUser = this.migrateUser(firestoreUser as any);
      await this.userRepository.update(uid, migratedUser as any, USERS_COLLECTION);
    }
  }
}

export const migrationService = new MigrationService();
