/**
 * ProviderHealthService — l'état des fournisseurs, tenu à jour par la maintenance :
 *   - SANTÉ et SOLDE : le compte revendeur répond-il, reste-t-il de quoi enregistrer une semaine
 *     de commandes ? (Un solde sous le seuil est une alerte critique : les commandes suivantes
 *     échoueraient chez ce fournisseur.)
 *   - COÛTS et CAPACITÉS : la grille de chaque fournisseur, relevée par son API, remplace les
 *     coûts de la veille ; un coût saisi à la main dans la console (grille négociée) n'est pas écrasé.
 */
import { z } from 'zod';
import { query, withTransaction } from '../../config/db';
import logger, { logCritical } from '../../config/logger';
import { configuredRegistrars, RegistrarError, registrar } from '../../integrations/registrars';
import { audit } from '../audit/audit.service';

export async function checkProviderHealth(): Promise<void> {
  const providers = await query<{ code: string; enabled: boolean; balance_alert_below: string }>(`SELECT code, enabled, balance_alert_below FROM registrar_providers`);
  for (const p of providers) {
    const adapter = registrar(p.code);
    if (!adapter) {
      await query(`UPDATE registrar_providers SET health_status = 'unknown', health_detail = 'not_configured', health_checked_at = now() WHERE code = $1`, [p.code]);
      continue;
    }
    const started = Date.now();
    try {
      const account = await adapter.account();
      const slow = Date.now() - started > 8000;
      await query(
        `UPDATE registrar_providers SET health_status = $2, health_detail = $3, health_checked_at = now(), balance = $4, balance_checked_at = now(), updated_at = now() WHERE code = $1`,
        [p.code, slow ? 'degraded' : 'up', slow ? 'slow' : null, account.balance]
      );
      if (p.enabled && account.balance !== null && account.balance < Number(p.balance_alert_below)) {
        logCritical('provider.balance_low', { provider: p.code, balance: account.balance, currency: account.currency, threshold: Number(p.balance_alert_below) });
      }
    } catch (error) {
      const kind = error instanceof RegistrarError ? error.kind : 'transient';
      await query(`UPDATE registrar_providers SET health_status = $2, health_detail = $3, health_checked_at = now(), updated_at = now() WHERE code = $1`, [p.code, kind === 'transient' ? 'degraded' : 'down', kind]);
      if (p.enabled) logger.error('provider.health_failed', { event: 'provider.health_failed', provider: p.code, kind, error });
    }
  }
}

/** Relève la grille de chaque fournisseur configuré (coûts d'une année, durées, extensions). */
export async function syncProviderCosts(): Promise<{ provider: string; tlds: number }[]> {
  const out: { provider: string; tlds: number }[] = [];
  for (const adapter of configuredRegistrars()) {
    try {
      const pricing = await adapter.listTldPricing();
      await withTransaction(async (client) => {
        for (const t of pricing) {
          await client.query(
            `INSERT INTO provider_capabilities (provider_code, tld, can_register, can_renew, can_transfer, can_restore, manages_dns, min_years, max_years, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, now())
             ON CONFLICT (provider_code, tld) DO UPDATE SET can_register = EXCLUDED.can_register, can_renew = EXCLUDED.can_renew, can_transfer = EXCLUDED.can_transfer,
               can_restore = EXCLUDED.can_restore, min_years = EXCLUDED.min_years, max_years = EXCLUDED.max_years, updated_at = now()`,
            [adapter.code, t.tld, t.costs.register !== undefined, t.costs.renew !== undefined, t.costs.transfer !== undefined, t.costs.restore !== undefined, t.minYears, t.maxYears]
          );
          for (const [operation, cost] of Object.entries(t.costs)) {
            await client.query(
              `INSERT INTO provider_costs (provider_code, tld, operation, years, cost, currency, source, fetched_at)
               VALUES ($1, $2, $3, 1, $4, $5, 'api', now())
               ON CONFLICT (provider_code, tld, operation, years) DO UPDATE SET cost = EXCLUDED.cost, currency = EXCLUDED.currency, fetched_at = now()
               WHERE provider_costs.source = 'api'`,
              [adapter.code, t.tld, operation, cost, t.currency]
            );
          }
        }
      });
      out.push({ provider: adapter.code, tlds: pricing.length });
      logger.info('provider.costs_synced', { event: 'provider.costs_synced', provider: adapter.code, tlds: pricing.length });
    } catch (error) {
      logger.error('provider.costs_sync_failed', { event: 'provider.costs_sync_failed', provider: adapter.code, error });
    }
  }
  return out;
}

// ─── Console ────────────────────────────────────────────────────────────────

export const providerPatch = z.object({
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  membershipFeeYear: z.number().min(0).max(100_000).optional(),
  expectedOperationsYear: z.number().int().min(1).max(1_000_000).optional(),
  feePerOperation: z.number().min(0).max(1000).optional(),
  balanceAlertBelow: z.number().min(0).max(1_000_000).optional(),
});

export async function updateProvider(code: string, patch: z.infer<typeof providerPatch>, actor: string): Promise<void> {
  await query(
    `UPDATE registrar_providers SET enabled = COALESCE($2, enabled), priority = COALESCE($3, priority), membership_fee_year = COALESCE($4, membership_fee_year),
       expected_operations_year = COALESCE($5, expected_operations_year), fee_per_operation = COALESCE($6, fee_per_operation), balance_alert_below = COALESCE($7, balance_alert_below), updated_at = now()
     WHERE code = $1`,
    [code, patch.enabled ?? null, patch.priority ?? null, patch.membershipFeeYear ?? null, patch.expectedOperationsYear ?? null, patch.feePerOperation ?? null, patch.balanceAlertBelow ?? null]
  );
  await audit({ actorKind: 'admin', actorId: actor, action: 'provider.updated', targetType: 'provider', targetId: code, data: patch });
}

export const manualCostInput = z.object({
  tld: z.string().regex(/^[a-z]{2,24}$|^[a-z]{2,10}\.[a-z]{2,10}$/),
  operation: z.enum(['register', 'renew', 'transfer', 'restore']),
  cost: z.number().min(0).max(100_000),
  currency: z.string().length(3).transform((c) => c.toUpperCase()),
  capable: z.boolean().default(true),
});

/** Une grille négociée, saisie dans la console : elle prime sur le relevé API (jamais écrasée par lui). */
export async function setManualCost(code: string, input: z.infer<typeof manualCostInput>, actor: string): Promise<void> {
  const column = { register: 'can_register', renew: 'can_renew', transfer: 'can_transfer', restore: 'can_restore' }[input.operation];
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO provider_costs (provider_code, tld, operation, years, cost, currency, source) VALUES ($1, $2, $3, 1, $4, $5, 'manual')
       ON CONFLICT (provider_code, tld, operation, years) DO UPDATE SET cost = EXCLUDED.cost, currency = EXCLUDED.currency, source = 'manual', fetched_at = now()`,
      [code, input.tld, input.operation, input.cost, input.currency]
    );
    await client.query(
      `INSERT INTO provider_capabilities (provider_code, tld, ${column}) VALUES ($1, $2, $3)
       ON CONFLICT (provider_code, tld) DO UPDATE SET ${column} = EXCLUDED.${column}, updated_at = now()`,
      [code, input.tld, input.capable]
    );
    await audit({ actorKind: 'admin', actorId: actor, action: 'provider.cost_set', targetType: 'provider', targetId: code, data: input }, client);
  });
}

export async function setFxRate(currency: string, xafPerUnit: number, actor: string): Promise<void> {
  await query(`INSERT INTO fx_rates (currency, xaf_per_unit) VALUES ($1, $2) ON CONFLICT (currency) DO UPDATE SET xaf_per_unit = EXCLUDED.xaf_per_unit, updated_at = now()`, [currency.toUpperCase(), xafPerUnit]);
  await audit({ actorKind: 'admin', actorId: actor, action: 'fx.updated', targetType: 'currency', targetId: currency.toUpperCase(), data: { xafPerUnit } });
}
