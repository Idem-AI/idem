/**
 * PublicPriceCatalogService — le prix public d'iDomain par extension et par opération, en francs.
 * Il ne dépend d'aucun fournisseur. Chaque changement ferme la ligne active et en ouvre une
 * nouvelle : on retrouve toujours le tarif qu'un client a vu.
 */
import { z } from 'zod';
import { Db, one, query, withTransaction } from '../../config/db';
import { audit } from '../audit/audit.service';
import { Operation } from './engine';

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
