import mongoose, { Schema, Document } from 'mongoose';

/**
 * Journal des e-mails transactionnels.
 *
 * Un e-mail qui ne part pas est invisible : l'utilisateur ne sait pas qu'il
 * aurait dû recevoir quelque chose, et nous non plus. Or ces messages portent
 * des enjeux concrets — un reçu de paiement, une relance avant coupure d'accès,
 * une invitation à la bêta. Chaque envoi laisse donc une trace, avec son
 * destinataire, son modèle, l'entité concernée et l'erreur éventuelle.
 *
 * Le contenu n'est pas stocké : il est reconstructible depuis le modèle et ses
 * variables, et garder le corps complet de chaque message ferait grossir la
 * base pour rien.
 */

export interface EmailLogDocument extends Document {
  template: string;
  to: string;
  subject: string;
  status: 'sent' | 'failed';
  messageId?: string;
  error?: string;
  attempts: number;
  /** Entité liée : référence de paiement, identifiant d'abonnement, e-mail bêta. */
  relatedId?: string;
  relatedType?: string;
  userId?: string;
  durationMs?: number;
  sentAt: Date;
}

const EmailLogSchema = new Schema<EmailLogDocument>(
  {
    template: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    status: { type: String, required: true },
    messageId: { type: String },
    error: { type: String },
    attempts: { type: Number, default: 1 },
    relatedId: { type: String },
    relatedType: { type: String },
    userId: { type: String },
    durationMs: { type: Number },
    sentAt: { type: Date, required: true, default: Date.now },
  },
  { collection: 'email_logs' }
);

// « Cet utilisateur a-t-il reçu son invitation ? » — la question du support.
EmailLogSchema.index({ to: 1, sentAt: -1 });
EmailLogSchema.index({ relatedId: 1, sentAt: -1 });

// Suivi par modèle : taux d'échec d'une relance, volume d'invitations.
EmailLogSchema.index({ template: 1, status: 1, sentAt: -1 });

export const EmailLog = mongoose.model<EmailLogDocument>('EmailLog', EmailLogSchema);
