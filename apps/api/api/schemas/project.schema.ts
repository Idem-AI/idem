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
    userId: { type: String, required: true },
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

// ============================================
// INDEX POUR REQUÊTES UTILISATEUR
// ============================================

// Projets par utilisateur triés par date (requête la plus fréquente)
ProjectSchema.index({ userId: 1, createdAt: -1 });

// Projets par utilisateur et type
ProjectSchema.index({ userId: 1, type: 1 });

// Projets par utilisateur récemment modifiés
ProjectSchema.index({ userId: 1, updatedAt: -1 });

// Recherche de projet spécifique par utilisateur et nom
ProjectSchema.index({ userId: 1, name: 1 });

// ============================================
// INDEX POUR STATISTIQUES ADMIN
// ============================================

// Comptage total et projets récents
ProjectSchema.index({ createdAt: -1 });

// Statistiques par type de projet
ProjectSchema.index({ type: 1, createdAt: -1 });

// Comptage des chartes graphiques générées
ProjectSchema.index({ 'analysisResultModel.design': 1 });

// Comptage des business plans générés
ProjectSchema.index({ 'analysisResultModel.businessPlan': 1 });

// Comptage des brandings générés
ProjectSchema.index({ 'analysisResultModel.branding': 1 });

// Comptage des landing pages générées
ProjectSchema.index({ 'analysisResultModel.landing': 1 });

// Statistiques par phases sélectionnées
ProjectSchema.index({ selectedPhases: 1 });

// Projets récemment modifiés
ProjectSchema.index({ updatedAt: -1 });

// ============================================
// INDEX POUR FONCTIONNALITÉS MÉTIER
// ============================================

// Recherche textuelle sur nom et description
ProjectSchema.index({ name: 'text', description: 'text' });

// Projets avec déploiements (pour filtrage)
ProjectSchema.index({ 'deployments.0': 1 }); // Vérifie si tableau deployments non vide

// Projets par pays (analytics géographiques)
ProjectSchema.index({ 'additionalInfos.country': 1 });

// Projets par ville (analytics géographiques détaillés)
ProjectSchema.index({ 'additionalInfos.country': 1, 'additionalInfos.city': 1 });

// ============================================
// INDEX COMPOSÉS POUR REQUÊTES COMPLEXES
// ============================================

// Dashboard utilisateur : projets par type et date
ProjectSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Analytics : projets par type, pays et date
ProjectSchema.index({ type: 1, 'additionalInfos.country': 1, createdAt: -1 });

// Filtrage avancé : utilisateur + type + phases
ProjectSchema.index({ userId: 1, type: 1, selectedPhases: 1 });

export const Project = mongoose.model<ProjectDocument>('Project', ProjectSchema);
