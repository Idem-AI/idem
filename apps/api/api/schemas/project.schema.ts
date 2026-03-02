import { Schema } from 'mongoose';

export const ProjectSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['web', 'mobile', 'iot', 'desktop'],
      required: true 
    },
    constraints: [{ type: String }],
    teamSize: { type: String, required: true },
    scope: { type: String, required: true },
    budgetIntervals: { type: String },
    targets: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    selectedPhases: [{ type: String }],
    analysisResultModel: { type: Schema.Types.Mixed },
    deployments: [{ type: Schema.Types.Mixed }],
    activeChatMessages: [{
      sender: { type: String, enum: ['user', 'ai'] },
      text: { type: String },
      timestamp: { type: Date },
      isRequestingDetails: { type: Boolean },
      isProposingArchitecture: { type: Boolean },
      isRequestingSensitiveVariables: { type: Boolean },
      proposedComponents: [{ type: Schema.Types.Mixed }],
      asciiArchitecture: { type: String },
      archetypeUrl: { type: String },
      requestedSensitiveVariables: [{ type: Schema.Types.Mixed }]
    }],
    policyAcceptance: {
      privacyPolicyAccepted: { type: Boolean, default: false },
      termsOfServiceAccepted: { type: Boolean, default: false },
      betaPolicyAccepted: { type: Boolean, default: false },
      marketingAccepted: { type: Boolean, default: false },
      acceptedAt: { type: Date },
      ipAddress: { type: String },
      userAgent: { type: String }
    },
    additionalInfos: {
      email: { type: String },
      phone: { type: String },
      address: { type: String },
      city: { type: String },
      country: { type: String },
      zipCode: { type: String },
      teamMembers: [{
        name: { type: String },
        role: { type: String },
        email: { type: String },
        bio: { type: String },
        pictureUrl: { type: String },
        socialLinks: {
          linkedin: { type: String },
          github: { type: String },
          twitter: { type: String }
        }
      }]
    }
  },
  {
    timestamps: true,
    collection: 'projects'
  }
);

ProjectSchema.index({ userId: 1, createdAt: -1 });
ProjectSchema.index({ name: 'text', description: 'text' });
