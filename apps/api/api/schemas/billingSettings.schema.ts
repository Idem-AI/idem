import mongoose, { Schema, Document } from 'mongoose';
import { BillingSettingsModel } from '../models/billing-settings.model';

/**
 * Document unique de réglages (`key: 'global'`).
 *
 * Une collection pour une seule ligne peut surprendre ; l'alternative — une
 * table clé/valeur — obligerait à typer chaque lecture à la main et à gérer les
 * valeurs manquantes partout. Ici le service renvoie un objet complet, fusionné
 * avec les valeurs par défaut.
 */

export interface BillingSettingsDocument extends Omit<BillingSettingsModel, 'key'>, Document {
  key: string;
}

const BillingSettingsSchema = new Schema<BillingSettingsDocument>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    paymentsEnabled: { type: Boolean, default: true },
    enforcement: { type: String, default: 'log' },
    beta: {
      enabled: { type: Boolean, default: true },
      endsAt: { type: Date, default: null },
      planCodes: [{ type: String }],
      monthlyCredits: {
        business: { type: Number, default: 1500 },
        appgen: { type: Number, default: 1500 },
      },
      simulationIncluded: { type: Boolean, default: true },
      autoInviteOnSignup: { type: Boolean, default: true },
    },
    welcomeCredit: {
      enabled: { type: Boolean, default: true },
      business: { type: Number, default: 50 },
      appgen: { type: Number, default: 50 },
      validityMonths: { type: Number, default: 2 },
      grantedAt: { type: Date, default: null },
    },
    graceDays: { type: Number, default: 3 },
    reminderDays: [{ type: Number }],
    enabledCountries: [{ type: String }],
    updatedBy: { type: String },
  },
  { timestamps: true, collection: 'billing_settings' }
);

export const BillingSettings = mongoose.model<BillingSettingsDocument>(
  'BillingSettings',
  BillingSettingsSchema
);
