import mongoose, { Document, Schema } from 'mongoose';

/**
 * Les débits demandés par iDomain (`/internal/idomain/billing/*`), un par RÉFÉRENCE de commande.
 *
 * Le portefeuille ne sait pas, seul, qu'un débit a déjà eu lieu : c'est ce registre qui rend la
 * passerelle idempotente. Une même référence n'est débitée qu'une fois ; une même référence de
 * restitution n'est rendue qu'une fois ; jamais plus n'est rendu que ce qui a été débité.
 */
export interface IdomainChargeDocument extends Document {
  reference: string;
  userId: string;
  amountXaf: number;
  /** 'pending' pendant le débit, 'charged' ensuite. Un 'pending' ancien est un débit douteux à vérifier. */
  status: 'pending' | 'charged';
  ledgerEntryId?: string;
  refundedXaf: number;
  refunds: { reference: string; amountXaf: number; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const IdomainChargeSchema = new Schema<IdomainChargeDocument>(
  {
    reference: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    amountXaf: { type: Number, required: true },
    status: { type: String, required: true, default: 'pending' },
    ledgerEntryId: { type: String },
    refundedXaf: { type: Number, required: true, default: 0 },
    refunds: [{ reference: { type: String, required: true }, amountXaf: { type: Number, required: true }, at: { type: Date, required: true }, _id: false }],
  },
  { timestamps: true, collection: 'idomain_charges' }
);

IdomainChargeSchema.index({ 'refunds.reference': 1 });

export const IdomainCharge = mongoose.model<IdomainChargeDocument>('IdomainCharge', IdomainChargeSchema);
