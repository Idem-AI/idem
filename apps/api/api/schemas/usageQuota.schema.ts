import mongoose, { Document, Schema } from 'mongoose';

/**
 * Compteurs des quotas d'usage IA (cf. `models/usage-quota.model.ts`).
 *
 * Un document par (utilisateur, compteur, période) :
 *  - `scope` vaut `group:<groupe>` pour un nombre de générations, `spend` pour
 *    le coût IA engagé (en dollars, tous moteurs confondus) ;
 *  - `periodKey` est la période calendaire UTC (`2026-10-15`, `2026-W42`,
 *    `2026-10`), préfixée de sa fenêtre pour qu'un jour et un mois ne se
 *    confondent jamais.
 *
 * MongoDB plutôt que Redis : le compteur doit survivre à un redémarrage et être
 * le même pour toutes les instances, et la consommation se réserve par un
 * `findOneAndUpdate` conditionnel (`count < limite`), atomique sur un document
 * unique — la même garantie que le débit des crédits, sans transaction.
 *
 * Les documents expirés sont supprimés par l'index TTL une semaine après la fin
 * de leur période : ils servent encore au support pendant ce délai.
 */
export interface UsageQuotaCounterDocument extends Document {
  userId: string;
  scope: string;
  periodKey: string;
  count: number;
  costUsd: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UsageQuotaCounterSchema = new Schema<UsageQuotaCounterDocument>(
  {
    userId: { type: String, required: true },
    scope: { type: String, required: true },
    periodKey: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    costUsd: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'usage_quota_counters' }
);

/** L'unicité porte la réservation : deux réservations concurrentes ne créent pas deux compteurs. */
UsageQuotaCounterSchema.index({ userId: 1, scope: 1, periodKey: 1 }, { unique: true, name: 'one_counter_per_period' });
UsageQuotaCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'counter_ttl' });

export const UsageQuotaCounter = mongoose.model<UsageQuotaCounterDocument>(
  'UsageQuotaCounter',
  UsageQuotaCounterSchema
);
