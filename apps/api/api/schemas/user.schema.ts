import { Schema } from 'mongoose';

export const UserSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    displayName: { type: String },
    photoURL: { type: String },
    subscription: { 
      type: String, 
      enum: ['free', 'pro', 'enterprise'], 
      default: 'free' 
    },
    lastLogin: { type: Date, default: Date.now },
    quota: {
      dailyUsage: { type: Number, default: 0 },
      weeklyUsage: { type: Number, default: 0 },
      dailyLimit: { type: Number, default: 10 },
      weeklyLimit: { type: Number, default: 50 },
      lastResetDaily: { type: String },
      lastResetWeekly: { type: String },
      quotaUpdatedAt: { type: Date }
    },
    roles: [{ type: String }],
    githubIntegration: {
      accessToken: { type: String },
      refreshToken: { type: String },
      username: { type: String },
      avatarUrl: { type: String },
      connectedAt: { type: Date },
      lastUsed: { type: Date },
      scopes: [{ type: String }]
    },
    refreshTokens: [{
      token: { type: String },
      expiresAt: { type: Date },
      createdAt: { type: Date },
      lastUsed: { type: Date },
      deviceInfo: { type: String },
      ipAddress: { type: String }
    }],
    policyAcceptance: {
      privacyPolicy: { type: Boolean, default: false },
      termsOfService: { type: Boolean, default: false },
      betaPolicy: { type: Boolean, default: false },
      marketingAcceptance: { type: Boolean, default: false },
      lastAcceptedAt: { type: Date },
      ipAddress: { type: String },
      userAgent: { type: String }
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

UserSchema.index({ email: 1 });
UserSchema.index({ uid: 1 });
