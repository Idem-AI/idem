import mongoose, { Schema, Document } from 'mongoose';
import {
  UserModel,
  QuotaData,
  GitHubIntegration,
  RefreshTokenData,
  PolicyAcceptanceStatus,
} from '../models/userModel';

export interface UserDocument extends UserModel, Document {}

const QuotaSchema = new Schema<QuotaData>(
  {
    dailyUsage: { type: Number, default: 0 },
    weeklyUsage: { type: Number, default: 0 },
    dailyLimit: { type: Number, default: 10 },
    weeklyLimit: { type: Number, default: 50 },
    lastResetDaily: { type: String, required: true },
    lastResetWeekly: { type: String, required: true },
    quotaUpdatedAt: { type: Date },
  },
  { _id: false }
);

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
    quota: { type: QuotaSchema, default: {} },
    roles: [{ type: String }],
    githubIntegration: { type: GitHubIntegrationSchema },
    refreshTokens: [{ type: RefreshTokenSchema }],
    policyAcceptance: { type: PolicyAcceptanceSchema },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// ============================================
// INDEX POUR AUTHENTIFICATION
// ============================================

// Recherche par Firebase UID (requête la plus fréquente) - unique index
UserSchema.index({ uid: 1 }, { unique: true });

// Recherche par email (login, vérification unicité) - unique index
UserSchema.index({ email: 1 }, { unique: true });

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

// Analyse de l'utilisation quotidienne
UserSchema.index({ 'quota.dailyUsage': 1 });

// Analyse de l'utilisation hebdomadaire
UserSchema.index({ 'quota.weeklyUsage': 1 });

// Comptage par rôle
UserSchema.index({ roles: 1 });

// Croissance par type d'abonnement
UserSchema.index({ createdAt: -1, subscription: 1 });

// ============================================
// INDEX POUR GESTION DES QUOTAS
// ============================================

// Réinitialisation quotidienne des quotas
UserSchema.index({ 'quota.lastResetDaily': 1 });

// Réinitialisation hebdomadaire des quotas
UserSchema.index({ 'quota.lastResetWeekly': 1 });

// Utilisateurs ayant atteint leur limite quotidienne
UserSchema.index({ 'quota.dailyUsage': 1, 'quota.dailyLimit': 1 });

// Utilisateurs ayant atteint leur limite hebdomadaire
UserSchema.index({ 'quota.weeklyUsage': 1, 'quota.weeklyLimit': 1 });

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

// Analytics : utilisation par type d'abonnement
UserSchema.index({ subscription: 1, 'quota.dailyUsage': 1 });

// Gestion des quotas : utilisateurs à notifier
UserSchema.index({ subscription: 1, 'quota.dailyUsage': 1, 'quota.dailyLimit': 1 });

// Recherche avancée : rôle + abonnement + date
UserSchema.index({ roles: 1, subscription: 1, createdAt: -1 });

export const User = mongoose.model<UserDocument>('User', UserSchema);
