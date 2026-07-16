import mongoose, { Schema, Document } from 'mongoose';
import { CoherenceAlertModel } from '../models/coherence.model';

export interface CoherenceAlertDocument extends Omit<CoherenceAlertModel, 'id'>, Document {}

const CoherenceIssueSchema = new Schema(
  {
    description: { type: String, required: true },
    targetSection: { type: String, required: true },
    suggestedAction: { type: String, required: true },
  },
  { _id: false }
);

const CoherenceProposalSchema = new Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ['finance_autofill', 'manual'], required: true },
    targetSection: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const CoherenceAlertSchema = new Schema<CoherenceAlertDocument>(
  {
    projectId: { type: String, required: true },
    userId: { type: String, required: true },
    ruleId: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'applied', 'dismissed', 'superseded'],
      required: true,
      default: 'open',
    },
    analysis: { type: String, required: true },
    issues: [CoherenceIssueSchema],
    proposals: [CoherenceProposalSchema],
    triggeredBySection: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'coherence_alerts',
  }
);

// Alertes ouvertes d'un projet (requête principale du dashboard/advisor).
CoherenceAlertSchema.index({ projectId: 1, status: 1, createdAt: -1 });
// Dédoublonnage: une seule alerte ouverte par (projet, règle).
CoherenceAlertSchema.index({ projectId: 1, ruleId: 1, status: 1 });

export const CoherenceAlert = mongoose.model<CoherenceAlertDocument>(
  'CoherenceAlert',
  CoherenceAlertSchema
);
