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
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
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

UserSchema.index({ uid: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<UserDocument>('User', UserSchema);
