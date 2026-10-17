/**
 * PricingRulesService — les règles commerciales actives (frais, coussin de change, marge minimale,
 * support, durée de garantie du prix), versionnées en base : la console les change sans
 * redéploiement, et chaque commande garde l'identifiant des règles qui l'ont chiffrée.
 */
import { z } from 'zod';
import { Db, one, withTransaction } from '../../config/db';
import { audit } from '../audit/audit.service';
import { DEFAULT_RULES, PricingRules } from './engine';

export const rulesSchema = z.object({
  paymentFeeRate: z.number().min(0).max(0.3),
  fxCushionRate: z.number().min(0).max(0.3),
  minMarginRate: z.number().min(0).max(0.6),
  supportCostXaf: z.number().int().min(0).max(20_000),
  priceSessionMinutes: z.number().int().min(5).max(24 * 60),
  degradedPenaltyXaf: z.number().int().min(0).max(20_000),
  maxYears: z.number().int().min(1).max(10),
  allowLossOnFundedPromotions: z.boolean(),
});

export interface ActiveRules {
  id: number;
  rules: PricingRules;
}

let cache: { value: ActiveRules; at: number } | null = null;
const TTL_MS = 30_000;

export async function activeRules(db?: Db): Promise<ActiveRules> {
  if (!db && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await one<{ id: string; rules: Partial<PricingRules> }>(`SELECT id, rules FROM pricing_rules WHERE valid_to IS NULL`, [], db);
  if (!row) throw new Error('pricing_rules_missing');
  const value = { id: Number(row.id), rules: { ...DEFAULT_RULES, ...row.rules } };
  if (!db) cache = { value, at: Date.now() };
  return value;
}

/** Nouvelle version des règles : l'ancienne est fermée, jamais réécrite. */
export async function updateRules(patch: Partial<PricingRules>, actor: string): Promise<ActiveRules> {
  const result = await withTransaction(async (client) => {
    const current = await activeRules(client);
    const next = rulesSchema.parse({ ...current.rules, ...patch });
    await client.query(`UPDATE pricing_rules SET valid_to = now() WHERE id = $1`, [current.id]);
    const row = await one<{ id: string }>(`INSERT INTO pricing_rules (rules, created_by) VALUES ($1, $2) RETURNING id`, [JSON.stringify(next), actor], client);
    await audit({ actorKind: 'admin', actorId: actor, action: 'pricing_rules.updated', targetType: 'pricing_rules', targetId: row!.id, data: { before: current.rules, after: next } }, client);
    return { id: Number(row!.id), rules: next };
  });
  cache = null;
  return result;
}
