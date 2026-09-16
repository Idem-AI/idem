import mongoose, { Schema, Document } from 'mongoose';
import { BetaTesterModel } from '../models/beta.model';

/**
 * Liste des bêta-testeurs premium.
 *
 * Écrite par le panel admin (import CSV, ajout manuel), lue par l'API
 * principale au moment d'ouvrir les droits et à chaque inscription — c'est ce
 * qui permet d'inscrire une adresse avant même que la personne ait un compte.
 */

export interface BetaTesterDocument extends Omit<BetaTesterModel, 'id'>, Document {}

const BetaTesterSchema = new Schema<BetaTesterDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String },
    personalMessage: { type: String },
    source: { type: String, required: true, default: 'manual' },
    importBatchId: { type: String },
    status: { type: String, required: true, default: 'pending_account' },
    userId: { type: String },
    invitedAt: { type: Date },
    grantedAt: { type: Date },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    lastCreditedMonth: { type: String },
    email_state: {
      sentAt: { type: Date },
      messageId: { type: String },
      error: { type: String },
      attempts: { type: Number },
    },
    addedBy: { type: String },
  },
  { timestamps: true, collection: 'beta_testers' }
);

// Files de travail : « qui reste à inviter », « qui est actif ».
BetaTesterSchema.index({ status: 1, createdAt: -1 });

// Recharge mensuelle : les actifs pas encore crédités ce mois-ci.
BetaTesterSchema.index({ status: 1, lastCreditedMonth: 1 });

// Retrouver le testeur d'un compte donné (panel admin, onglet utilisateur).
BetaTesterSchema.index({ userId: 1 }, { sparse: true });

// Annuler ou auditer une campagne d'import.
BetaTesterSchema.index({ importBatchId: 1 }, { sparse: true });

export const BetaTester = mongoose.model<BetaTesterDocument>('BetaTester', BetaTesterSchema);
