/**
 * PublicPriceCatalogService — le prix public d'iDomain par extension et par opération, en francs.
 * Il ne dépend d'aucun fournisseur. Chaque changement ferme la ligne active et en ouvre une
 * nouvelle : on retrouve toujours le tarif qu'un client a vu.
 */
import { z } from 'zod';
import { Db, one, query, withTransaction } from '../../config/db';
import { audit } from '../audit/audit.service';
import { isSellableSuffix } from '../../utils/domain-name';
import { minimumPriceXaf, Operation } from './engine';
import { activeRules } from './rules.service';

/**
 * Les extensions mises en avant, dans cet ordre : la recherche essaie le nom tapé sur celles-ci
 * (jamais sur tout le catalogue, qui compte des centaines d'extensions), et la page d'accueil n'en
 * affiche pas d'autres. La première en vente est celle qu'on ajoute à un nom tapé sans extension.
 * Toute autre extension du catalogue se vend quand même : il suffit de la taper.
 */
export const FEATURED_TLDS = ['com', 'net', 'org', 'co', 'shop', 'store', 'online', 'site', 'pro', 'biz', 'info', 'app', 'io', 'tech', 'me'];
/** Au plus, combien d'extensions mises en avant sont montrées et interrogées à la fois. */
export const FEATURED_LIMIT = 8;

/** Les extensions mises en avant parmi celles en vente, dans l'ordre de `FEATURED_TLDS`. */
export function featuredTlds(onSale: string[]): string[] {
  const set = new Set(onSale);
  const featured = FEATURED_TLDS.filter((t) => set.has(t));
  // Catalogue sans aucune extension mise en avant : les premières par ordre alphabétique.
  return (featured.length ? featured : [...onSale].sort()).slice(0, FEATURED_LIMIT);
}

/** Auteur des lignes de catalogue posées par le code (le seul qu'il a le droit de réviser). */
const SYNC_AUTHOR = (providerCode: string) => `sync:${providerCode}`;
const MAX_PRICE_XAF = 5_000_000;

export interface CatalogRow {
  id: number;
  tld: string;
  register_xaf: number | null;
  renew_xaf: number | null;
  transfer_xaf: number | null;
  pack_xaf: number | null;
  on_sale: boolean;
  valid_from: Date;
  note: string | null;
}

export interface PromotionRow {
  id: number;
  tld: string;
  operation: Operation;
  price_xaf: number;
  funding: 'pack' | 'registry' | 'budget';
  registry_cost: string | null;
  registry_cost_currency: string | null;
  starts_at: Date;
  ends_at: Date;
  max_uses: number | null;
  uses: number;
  note: string | null;
}

const toRow = (r: CatalogRow & { id: string }): CatalogRow => ({ ...r, id: Number(r.id) });

export async function activeCatalog(tld: string, db?: Db): Promise<CatalogRow | null> {
  const row = await one<CatalogRow & { id: string }>(`SELECT * FROM public_price_catalog WHERE tld = $1 AND valid_to IS NULL`, [tld], db);
  return row ? toRow(row) : null;
}

export async function listCatalog(onlyOnSale = true): Promise<CatalogRow[]> {
  const rows = await query<CatalogRow & { id: string }>(`SELECT * FROM public_price_catalog WHERE valid_to IS NULL ${onlyOnSale ? 'AND on_sale' : ''} ORDER BY tld`);
  return rows.map(toRow);
}

export async function catalogHistory(tld: string): Promise<CatalogRow[]> {
  const rows = await query<CatalogRow & { id: string }>(`SELECT * FROM public_price_catalog WHERE tld = $1 ORDER BY valid_from DESC LIMIT 50`, [tld]);
  return rows.map(toRow);
}

export const catalogInput = z.object({
  tld: z.string().regex(/^[a-z]{2,24}$|^[a-z]{2,10}\.[a-z]{2,10}$/),
  registerXaf: z.number().int().positive().max(5_000_000).nullable(),
  renewXaf: z.number().int().positive().max(5_000_000).nullable(),
  transferXaf: z.number().int().positive().max(5_000_000).nullable(),
  packXaf: z.number().int().positive().max(5_000_000).nullable(),
  onSale: z.boolean(),
  note: z.string().max(500).optional(),
});

/** Nouveau prix d'une extension (ou première mise en vente). */
export async function setCatalogPrice(input: z.infer<typeof catalogInput>, actor: string): Promise<CatalogRow> {
  return withTransaction(async (client) => {
    const before = await activeCatalog(input.tld, client);
    if (before) await client.query(`UPDATE public_price_catalog SET valid_to = now() WHERE id = $1`, [before.id]);
    const row = await one<CatalogRow & { id: string }>(
      `INSERT INTO public_price_catalog (tld, register_xaf, renew_xaf, transfer_xaf, pack_xaf, on_sale, created_by, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [input.tld, input.registerXaf, input.renewXaf, input.transferXaf, input.packXaf, input.onSale, actor, input.note ?? null],
      client
    );
    await audit({ actorKind: 'admin', actorId: actor, action: 'catalog.price_set', targetType: 'tld', targetId: input.tld, data: { before, after: row } }, client);
    return toRow(row!);
  });
}

/** La promotion en cours sur une extension et une opération (la moins chère s'il y en a plusieurs). */
export async function activePromotion(tld: string, operation: Operation, db?: Db): Promise<PromotionRow | null> {
  const row = await one<PromotionRow & { id: string }>(
    `SELECT * FROM promotions
      WHERE tld = $1 AND operation = $2 AND starts_at <= now() AND ends_at > now() AND (max_uses IS NULL OR uses < max_uses)
      ORDER BY price_xaf ASC LIMIT 1`,
    [tld, operation],
    db
  );
  return row ? { ...row, id: Number(row.id) } : null;
}

export const promotionInput = z
  .object({
    tld: z.string().regex(/^[a-z]{2,24}$|^[a-z]{2,10}\.[a-z]{2,10}$/),
    operation: z.enum(['register', 'renew', 'transfer']),
    priceXaf: z.number().int().positive().max(5_000_000),
    funding: z.enum(['pack', 'registry', 'budget']),
    registryCost: z.number().nonnegative().nullable().optional(),
    registryCostCurrency: z.string().length(3).nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    maxUses: z.number().int().positive().nullable().optional(),
    note: z.string().max(500).optional(),
  })
  .refine((p) => p.endsAt > p.startsAt, { message: 'La fin doit suivre le début.', path: ['endsAt'] });

export async function createPromotion(input: z.infer<typeof promotionInput>, actor: string): Promise<PromotionRow> {
  return withTransaction(async (client) => {
    const row = await one<PromotionRow & { id: string }>(
      `INSERT INTO promotions (tld, operation, price_xaf, funding, registry_cost, registry_cost_currency, starts_at, ends_at, max_uses, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [input.tld, input.operation, input.priceXaf, input.funding, input.registryCost ?? null, input.registryCostCurrency ?? null, input.startsAt, input.endsAt, input.maxUses ?? null, input.note ?? null, actor],
      client
    );
    await audit({ actorKind: 'admin', actorId: actor, action: 'promotion.created', targetType: 'promotion', targetId: row!.id, data: { ...input } }, client);
    return { ...row!, id: Number(row!.id) };
  });
}

/** Arrête une promotion maintenant (retour automatique au prix normal). */
export async function endPromotion(id: number, actor: string): Promise<void> {
  await query(`UPDATE promotions SET ends_at = now() WHERE id = $1 AND ends_at > now()`, [id]);
  await audit({ actorKind: 'admin', actorId: actor, action: 'promotion.ended', targetType: 'promotion', targetId: String(id) });
}

export async function listPromotions(): Promise<PromotionRow[]> {
  const rows = await query<PromotionRow & { id: string }>(`SELECT * FROM promotions WHERE ends_at > now() - interval '90 days' ORDER BY starts_at DESC LIMIT 200`);
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

/**
 * Met en vente le catalogue d'un fournisseur : chaque extension qu'il sait enregistrer ET renouveler
 * reçoit un prix public calculé par le code — le plancher de marge (`minimumPriceXaf`) sur son coût
 * de grille majoré de la réserve `autoPriceCostCushionRate`.
 *
 * Le code ne révise que ses propres lignes (`created_by = sync:<fournisseur>`) : un prix fixé en
 * console, ou une extension retirée de la vente à la main (`.africa`), n'est jamais touché. Une
 * extension que le fournisseur ne vend plus sort de la vente. Chaque changement ferme la ligne
 * active et en ouvre une nouvelle, comme `setCatalogPrice`.
 */
export async function priceProviderCatalog(providerCode: string): Promise<{ opened: number; repriced: number; withdrawn: number }> {
  const { rules } = await activeRules();
  const author = SYNC_AUTHOR(providerCode);
  const rows = await query<{
    tld: string;
    can_register: boolean;
    can_renew: boolean;
    can_transfer: boolean;
    currency: string;
    xaf_per_unit: string | null;
    membership_fee_year: string;
    expected_operations_year: number;
    fee_per_operation: string;
    costs: Record<string, string> | null;
  }>(
    `SELECT c.tld, c.can_register, c.can_renew, c.can_transfer, p.currency, fx.xaf_per_unit, p.membership_fee_year, p.expected_operations_year, p.fee_per_operation,
            (SELECT json_object_agg(pc.operation, pc.cost) FROM provider_costs pc
              WHERE pc.provider_code = c.provider_code AND pc.tld = c.tld AND pc.years = 1 AND pc.currency = p.currency) AS costs
       FROM provider_capabilities c
       JOIN registrar_providers p ON p.code = c.provider_code
       LEFT JOIN fx_rates fx ON fx.currency = p.currency
      WHERE c.provider_code = $1`,
    [providerCode]
  );

  const priceOf = (cost: string | undefined, row: (typeof rows)[number]): number | null => {
    if (cost === undefined || !row.xaf_per_unit) return null;
    const perOperation = Number(row.membership_fee_year) / Math.max(1, row.expected_operations_year) + Number(row.fee_per_operation);
    const totalCostXaf = Math.round((Number(cost) * (1 + rules.autoPriceCostCushionRate) + perOperation) * Number(row.xaf_per_unit));
    const price = minimumPriceXaf(totalCostXaf, rules);
    return Number.isFinite(price) && price > 0 && price <= MAX_PRICE_XAF ? price : null;
  };

  const wanted = new Map<string, { register: number; renew: number; transfer: number | null }>();
  for (const r of rows) {
    if (!r.can_register || !r.can_renew || !isSellableSuffix(r.tld)) continue;
    const register = priceOf(r.costs?.register, r);
    const renew = priceOf(r.costs?.renew, r);
    if (register === null || renew === null) continue;
    wanted.set(r.tld, { register, renew, transfer: r.can_transfer ? priceOf(r.costs?.transfer, r) : null });
  }

  const counts = { opened: 0, repriced: 0, withdrawn: 0 };
  await withTransaction(async (client) => {
    const active = await query<CatalogRow & { id: string; created_by: string }>(`SELECT * FROM public_price_catalog WHERE valid_to IS NULL`, [], client);
    const byTld = new Map(active.map((a) => [a.tld, a]));
    const open = (tld: string, p: { register: number | null; renew: number | null; transfer: number | null }, onSale: boolean, note: string) =>
      client.query(
        `INSERT INTO public_price_catalog (tld, register_xaf, renew_xaf, transfer_xaf, pack_xaf, on_sale, created_by, note) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)`,
        [tld, p.register, p.renew, p.transfer, onSale, author, note]
      );
    const close = (id: string) => client.query(`UPDATE public_price_catalog SET valid_to = now() WHERE id = $1`, [id]);

    for (const [tld, p] of wanted) {
      const current = byTld.get(tld);
      if (!current) {
        await open(tld, p, true, 'Catalogue du fournisseur, au plancher de marge');
        counts.opened++;
      } else if (current.created_by === author && (current.register_xaf !== p.register || current.renew_xaf !== p.renew || current.transfer_xaf !== p.transfer || !current.on_sale)) {
        await close(current.id);
        await open(tld, p, true, 'Catalogue du fournisseur, au plancher de marge');
        counts.repriced++;
      }
    }
    // Ce que le fournisseur ne vend plus (ou plus à un prix calculable) sort de la vente.
    for (const current of active) {
      if (current.created_by !== author || !current.on_sale || wanted.has(current.tld)) continue;
      await close(current.id);
      await open(current.tld, { register: current.register_xaf, renew: current.renew_xaf, transfer: current.transfer_xaf }, false, 'Plus proposé par le fournisseur');
      counts.withdrawn++;
    }
    if (counts.opened || counts.repriced || counts.withdrawn) {
      await audit({ actorKind: 'system', actorId: author, action: 'catalog.provider_priced', targetType: 'provider', targetId: providerCode, data: counts }, client);
    }
  });
  return counts;
}
