import mongoose, { Document, Schema } from 'mongoose';

/**
 * Surcharges de prix posées dans le panel admin.
 *
 * Une surcharge remplace **une** valeur du fichier de tarification : le prix
 * catalogue d'un produit (`country: null`) ou son prix dans un pays. Tout ce qui
 * n'est pas surchargé suit le fichier — une modification du fichier s'applique
 * donc partout où l'admin n'a rien fixé.
 */
export interface PricingOverrideDocument extends Document {
  country: string | null;
  productCode: string;
  field: 'price' | 'idemPrice';
  value: number;
  reason?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PricingOverrideSchema = new Schema<PricingOverrideDocument>(
  {
    country: { type: String, default: null },
    productCode: { type: String, required: true },
    field: { type: String, enum: ['price', 'idemPrice'], required: true },
    value: { type: Number, required: true, min: 0 },
    reason: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, collection: 'pricing_overrides' }
);

// Une seule valeur appliquée par prix : deux surcharges contradictoires pour le
// même produit dans le même pays n'auraient pas de sens.
PricingOverrideSchema.index(
  { country: 1, productCode: 1, field: 1 },
  { unique: true, name: 'one_override_per_price' }
);

export const PricingOverride = mongoose.model<PricingOverrideDocument>(
  'PricingOverride',
  PricingOverrideSchema
);

/**
 * Historique des changements de prix, en ajout seul.
 *
 * Les prix sont de l'argent : on doit pouvoir répondre à « qui a changé le prix
 * kényan de l'Essentiel, quand, de combien et pourquoi ». La surcharge ne garde
 * que l'état présent ; cet historique garde le chemin.
 */
export interface PricingChangeDocument extends Document {
  country: string | null;
  productCode: string;
  field: 'price' | 'idemPrice';
  previousValue: number | null;
  newValue: number | null;
  /** `set` pose ou modifie une surcharge ; `reset` revient à la valeur du fichier. */
  action: 'set' | 'reset';
  reason: string;
  changedBy?: string;
  changedAt: Date;
}

const PricingChangeSchema = new Schema<PricingChangeDocument>(
  {
    country: { type: String, default: null },
    productCode: { type: String, required: true },
    field: { type: String, enum: ['price', 'idemPrice'], required: true },
    previousValue: { type: Number, default: null },
    newValue: { type: Number, default: null },
    action: { type: String, enum: ['set', 'reset'], required: true },
    reason: { type: String, required: true },
    changedBy: { type: String },
    changedAt: { type: Date, default: () => new Date() },
  },
  { collection: 'pricing_changes' }
);

PricingChangeSchema.index({ changedAt: -1 });
PricingChangeSchema.index({ country: 1, productCode: 1, changedAt: -1 });

export const PricingChange = mongoose.model<PricingChangeDocument>(
  'PricingChange',
  PricingChangeSchema
);
