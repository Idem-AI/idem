import mongoose, { Document, Schema } from 'mongoose';

/**
 * File d'attente des synchronisations vers iDeploy.
 *
 * iDeploy vit dans une autre base (PostgreSQL) et parfois sur une autre
 * machine. Écrire son plan directement au moment du paiement rendrait
 * l'encaissement dépendant de la disponibilité de cette base : une coupure
 * réseau de trente secondes, et un client débité se retrouverait sans le plan
 * qu'il vient d'acheter, sans trace de ce qui manque.
 *
 * L'intention est donc écrite ici — dans la base qui vient déjà d'accepter le
 * paiement — puis appliquée par une tâche de fond qui réessaie. Le paiement
 * reste la source de vérité ; la synchronisation devient une conséquence qui
 * peut prendre son temps.
 */
export interface BillingSyncJobDocument extends Document {
  target: 'ideploy';
  userId: string;
  /** L'e-mail identifie l'équipe côté iDeploy : c'est le seul lien entre les deux bases. */
  email: string;
  payload: {
    plan: string;
    deployCredits?: number;
    /** Vrai pour ajouter les crédits au solde, faux pour le remplacer. */
    addDeployCredits?: boolean;
    addons?: string[];
    startedAt?: Date | null;
    expiresAt?: Date | null;
    /**
     * Efface l'échéance côté iDeploy.
     *
     * Sans ce drapeau, une absence de date serait indiscernable d'une remise à
     * zéro : un renouvellement sans échéance connue effacerait celle qui est
     * déjà enregistrée, et l'abonnement paraîtrait sans fin.
     */
    clearExpiry?: boolean;
  };
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempts: number;
  lastError?: string;
  /** Raison lisible d'un abandon, pour l'écran d'administration. */
  failureReason?: string;
  nextAttemptAt: Date;
  reference?: string;
  createdAt: Date;
  completedAt?: Date;
}

const BillingSyncJobSchema = new Schema<BillingSyncJobDocument>(
  {
    target: { type: String, required: true, default: 'ideploy' },
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    payload: {
      plan: { type: String, required: true },
      deployCredits: { type: Number },
      addDeployCredits: { type: Boolean },
      addons: [{ type: String }],
      startedAt: { type: Date },
      expiresAt: { type: Date },
      clearExpiry: { type: Boolean },
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    failureReason: { type: String },
    nextAttemptAt: { type: Date, default: () => new Date() },
    /** Référence du paiement à l'origine de la synchronisation, quand il y en a un. */
    reference: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'billing_sync_jobs' }
);

// La tâche de fond ne cherche que cela : ce qui est dû, dans l'ordre.
BillingSyncJobSchema.index({ status: 1, nextAttemptAt: 1 });

export const BillingSyncJob = mongoose.model<BillingSyncJobDocument>(
  'BillingSyncJob',
  BillingSyncJobSchema
);
