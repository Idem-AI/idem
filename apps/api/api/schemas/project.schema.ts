import mongoose, { Schema, Document } from 'mongoose';
import { ProjectModel, TeamMember, ProjectPolicyAcceptance } from '../models/project.model';
import { AnalysisResultModel } from '../models/analysisResult.model';
import { DeploymentModel, ChatMessage } from '../models/deployment.model';

export interface ProjectDocument extends Omit<ProjectModel, 'id'>, Document {}

const TeamMemberSchema = new Schema<TeamMember>(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    email: { type: String, required: true },
    bio: { type: String, required: true },
    pictureUrl: { type: String },
    socialLinks: {
      linkedin: { type: String },
      github: { type: String },
      twitter: { type: String },
    },
  },
  { _id: false }
);

const ProjectPolicyAcceptanceSchema = new Schema<ProjectPolicyAcceptance>(
  {
    privacyPolicyAccepted: { type: Boolean, required: true },
    termsOfServiceAccepted: { type: Boolean, required: true },
    betaPolicyAccepted: { type: Boolean, required: true },
    marketingAccepted: { type: Boolean, required: true },
    acceptedAt: { type: Date, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<ChatMessage>(
  {
    sender: { type: String, enum: ['user', 'ai'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date },
    isRequestingDetails: { type: Boolean },
    isProposingArchitecture: { type: Boolean },
    isRequestingSensitiveVariables: { type: Boolean },
    proposedComponents: [{ type: Schema.Types.Mixed }],
    asciiArchitecture: { type: String },
    archetypeUrl: { type: String },
    requestedSensitiveVariables: [{ type: Schema.Types.Mixed }],
  },
  { _id: false }
);

const ProjectSchema = new Schema<ProjectDocument>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['web', 'mobile', 'iot', 'desktop'],
      required: true,
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
    activeChatMessages: [ChatMessageSchema],
    policyAcceptance: { type: ProjectPolicyAcceptanceSchema },
    additionalInfos: {
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true },
      zipCode: { type: String, required: true },
      teamMembers: [TeamMemberSchema],
    },
    project: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'projects',
  }
);

ProjectSchema.index({ userId: 1, createdAt: -1 });
ProjectSchema.index({ name: 'text', description: 'text' });

export const Project = mongoose.model<ProjectDocument>('Project', ProjectSchema);
