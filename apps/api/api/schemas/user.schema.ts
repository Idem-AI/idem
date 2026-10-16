import mongoose, { Schema, Document } from 'mongoose';
import {
  UserModel,
  GitHubIntegration,
  RefreshTokenData,
  PolicyAcceptanceStatus,
} from '../models/userModel';

export interface UserDocument extends UserModel, Document {}

const GitHubIntegrationSchema = new Schema<GitHubIntegration>(
  {
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    username: { type: String, required: true },
    avatarUrl: { type: String },
    connectedAt: { type: Date, required: true },
    lastUsed: { type: Date },
    scopes: [{ type: String }],
  },
  { _id: false }
);

const RefreshTokenSchema = new Schema<RefreshTokenData>(
  {
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, required: true },
    lastUsed: { type: Date },
    deviceInfo: { type: String },
    ipAddress: { type: String },
  },
  { _id: false }
);

const PolicyAcceptanceSchema = new Schema<PolicyAcceptanceStatus>(
  {
    privacyPolicy: { type: Boolean, default: false },
    termsOfService: { type: Boolean, default: false },
    betaPolicy: { type: Boolean, default: false },
    marketingAcceptance: { type: Boolean, default: false },
    lastAcceptedAt: { type: Date },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { _id: false }
);

const UserSchema = new Schema<UserDocument>(
  {
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    displayName: { type: String },
    photoURL: { type: String },
    subscription: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
      required: true,
    },
    createdAt: { type: Date, required: true, default: Date.now },
    lastLogin: { type: Date, required: true, default: Date.now },
    roles: [{ type: String }],
    githubIntegration: { type: GitHubIntegrationSchema },
    refreshTokens: [{ type: RefreshTokenSchema }],
    policyAcceptance: { type: PolicyAcceptanceSchema },
    authId: { type: String },
    authProviders: [{ type: String }],
    emailVerified: { type: Boolean },
    sessionsRevokedAt: { type: Date },
    authMigration: {
      importedAt: { type: Date },
      linkedAt: { type: Date },
      linkedBy: { type: String, enum: ['import', 'verified-email'] },
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// ============================================
// INDEX POUR AUTHENTIFICATION
// ============================================

// Note: Unique indexes for uid and email are already defined directly on the schema fields below:
// - uid: { type: String, required: true, unique: true }
// - email: { type: String, required: true, unique: true }
// Declaring them here as well causes duplicate schema index warnings.

// Compte du serveur d'authentification (Supabase) → utilisateur IDEM.
// Partiel plutôt que sparse : les comptes pas encore rattachés n'ont pas le champ.
UserSchema.index(
  { authId: 1 },
  { unique: true, partialFilterExpression: { authId: { $type: 'string' } } }
);

// Recherche par displayName (recherche utilisateur)
UserSchema.index({ displayName: 1 });

// ============================================
// INDEX POUR GESTION DES SESSIONS
// ============================================

// Recherche de refresh tokens actifs
UserSchema.index({ 'refreshTokens.token': 1 });

// Nettoyage des tokens expirés
UserSchema.index({ 'refreshTokens.expiresAt': 1 });

// Tokens par device
UserSchema.index({ uid: 1, 'refreshTokens.deviceInfo': 1 });

// ============================================
// INDEX POUR STATISTIQUES ADMIN
// ============================================

// Comptage total et utilisateurs récents
UserSchema.index({ createdAt: -1 });

// Statistiques par type d'abonnement
UserSchema.index({ subscription: 1, createdAt: -1 });

// Utilisateurs actifs récemment
UserSchema.index({ lastLogin: -1 });

// Comptage par rôle
UserSchema.index({ roles: 1 });

// Croissance par type d'abonnement
UserSchema.index({ createdAt: -1, subscription: 1 });

// Les quotas d'usage ne vivent plus sur le compte : voir `usage_quota_counters`
// (compteurs par période, purgés par TTL). `scripts/dropLegacyQuota.ts` retire
// l'ancien champ `quota` et ses index des bases existantes.

// ============================================
// INDEX POUR INTÉGRATIONS
// ============================================

// Utilisateurs avec intégration GitHub
UserSchema.index({ 'githubIntegration.username': 1 });

// Intégrations GitHub actives
UserSchema.index({ 'githubIntegration.connectedAt': -1 });

// ============================================
// INDEX POUR CONFORMITÉ ET POLITIQUES
// ============================================

// Utilisateurs ayant accepté les politiques
UserSchema.index({ 'policyAcceptance.privacyPolicy': 1 });
UserSchema.index({ 'policyAcceptance.termsOfService': 1 });
UserSchema.index({ 'policyAcceptance.betaPolicy': 1 });

// Date d'acceptation des politiques
UserSchema.index({ 'policyAcceptance.lastAcceptedAt': -1 });

// ============================================
// INDEX COMPOSÉS POUR REQUÊTES COMPLEXES
// ============================================

// Dashboard admin : utilisateurs actifs par abonnement
UserSchema.index({ subscription: 1, lastLogin: -1 });

// Recherche avancée : rôle + abonnement + date
UserSchema.index({ roles: 1, subscription: 1, createdAt: -1 });

export const User = mongoose.model<UserDocument>('User', UserSchema);
