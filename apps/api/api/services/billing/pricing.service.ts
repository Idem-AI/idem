import logger from '../../config/logger';
import { loadPricingDefaults, pricingConfigPath, pricingSource } from '../../config/pricing.loader';
import { BillingProduct } from '../../schemas/billing.schema';
import { PricingChange, PricingOverride } from '../../schemas/pricingOverride.schema';
import {
  LocalPrice,
  PricingConfig,
  PricingOverride as PricingOverrideValue,
  PricingOverrideField,
  PricingWarning,
  annualPrice,
  applyOverrides,
  priceInCountry,
  pricingWarnings,
  usesCatalogPrice,
} from '../../../../../packages/shared-models/src/pricing/pricing';

/**
 * La tarification effective : le fichier, surchargé par le panel admin.
 *
 * **Une seule règle de calcul**, partagée avec le dashboard (voir
 * `packages/shared-models/src/pricing/pricing.ts`) : le prix affiché et le prix
 * encaissé ne peuvent pas diverger.
 *
 * **Les prix effectifs sont recopiés sur les produits** (`billing_products`).
 * Tout le code existant lit `product.priceXaf` — renouvellements, suggestions du
 * paywall, rentabilité. Recopier plutôt que réécrire ces lecteurs évite de
 * disperser la règle, et un produit en base reflète toujours le prix appliqué.
 *
 * Les abonnements en cours ne sont **pas** repricés : leur montant est figé sur
 * l'abonnement au moment de la souscription. Changer un prix ne surprend pas un
 * client déjà engagé.
 */

const OVERRIDES_TTL_MS = 60_000;

export interface PricingCountry {
  code: string;
  name: string;
  prefix: string;
  currency: string;
  decimals: 0 | 2;
  /** Vrai en zone CFA : le prix catalogue s'applique, sans grille propre. */
  catalogZone: boolean;
}

export interface PricingChangeInput {
  /** `null` = prix catalogue (zone CFA). */
  country: string | null;
  productCode: string;
  field: PricingOverrideField;
  /** `null` revient à la valeur du fichier. */
  value: number | null;
}

export class PricingValidationError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = 'PricingValidationError';
  }
}

class PricingService {
  private overridesCache: { at: number; overrides: PricingOverrideValue[] } | null = null;

  /** Surcharges en vigueur, mises en cache une minute. */
  async overrides(): Promise<PricingOverrideValue[]> {
    if (this.overridesCache && Date.now() - this.overridesCache.at < OVERRIDES_TTL_MS) {
      return this.overridesCache.overrides;
    }

    const documents = await PricingOverride.find().lean();
    const overrides = documents.map((document: any) => ({
      id: String(document._id),
      country: document.country ?? null,
      productCode: document.productCode,
      field: document.field,
      value: document.value,
      reason: document.reason,
      updatedBy: document.updatedBy,
      updatedAt: document.updatedAt,
    }));

    this.overridesCache = { at: Date.now(), overrides };
    return overrides;
  }

  invalidate(): void {
    this.overridesCache = null;
  }

  /** Configuration appliquée : fichier + surcharges. */
  async effective(): Promise<PricingConfig> {
    return applyOverrides(loadPricingDefaults(), await this.overrides());
  }

  /** Pays tarifés, dans l'ordre du fichier. */
  async countries(): Promise<PricingCountry[]> {
    const config = await this.effective();
    return Object.entries(config.countries).map(([code, country]) => ({
      code,
      name: country.name,
      prefix: country.prefix,
      currency: country.currency,
      decimals: country.decimals,
      catalogZone: usesCatalogPrice(country),
    }));
  }

  async getCountry(code: string): Promise<PricingCountry | undefined> {
    const upper = code.toUpperCase();
    return (await this.countries()).find((country) => country.code === upper);
  }

  /** Prix d'un produit dans un pays, ou `null` s'il n'y est pas fixé. */
  async priceFor(
    productCode: string,
    countryCode: string,
    options: { idem?: boolean } = {}
  ): Promise<LocalPrice | null> {
    return priceInCountry(await this.effective(), productCode, countryCode, options);
  }

  /** Prix annuel local à partir du prix mensuel local. */
  async annualFor(monthly: number, countryCode: string): Promise<number> {
    const config = await this.effective();
    const country = config.countries[countryCode.toUpperCase()];
    return annualPrice(monthly, config, country ? usesCatalogPrice(country) : true);
  }

  /**
   * Recopie les prix catalogue effectifs sur les produits en base.
   *
   * N'écrit que ce qui diffère : lancée à chaque minute par le planificateur,
   * elle reste gratuite quand rien n'a changé, et propage en moins d'une minute
   * une modification du fichier.
   */
  async materialize(): Promise<{ updated: number }> {
    const config = await this.effective();
    const products = await BillingProduct.find({}, { code: 1, priceXaf: 1, idemPriceXaf: 1 }).lean();

    let updated = 0;
    for (const product of products as any[]) {
      const target = config.products[product.code];
      if (!target) continue;

      const set: Record<string, number> = {};
      if (product.priceXaf !== target.priceXaf) set.priceXaf = target.priceXaf;
      if (target.idemPriceXaf !== undefined && product.idemPriceXaf !== target.idemPriceXaf) {
        set.idemPriceXaf = target.idemPriceXaf;
      }
      if (Object.keys(set).length === 0) continue;

      await BillingProduct.updateOne({ code: product.code }, { $set: set });
      updated += 1;

      logger.info('billing.pricing_materialized', {
        event: 'billing.pricing_materialized',
        productCode: product.code,
        from: product.priceXaf,
        to: target.priceXaf,
      });
    }

    return { updated };
  }

  /** Tout ce que le panel affiche : défauts, surcharges, effectif, anomalies. */
  async adminView(): Promise<{
    source: { path: string; version: string; loadedAt: Date | null };
    defaults: PricingConfig;
    effective: PricingConfig;
    overrides: PricingOverrideValue[];
    warnings: PricingWarning[];
  }> {
    const defaults = loadPricingDefaults();
    const overrides = await this.overrides();
    const effective = applyOverrides(defaults, overrides);
    const loaded = pricingSource();

    return {
      source: {
        path: loaded?.path ?? pricingConfigPath(),
        version: defaults.version,
        loadedAt: loaded?.loadedAt ?? null,
      },
      defaults,
      effective,
      overrides,
      warnings: pricingWarnings(effective),
    };
  }

  /** Derniers changements de prix, du plus récent au plus ancien. */
  async history(filter: { country?: string | null; productCode?: string; limit?: number } = {}) {
    const query: Record<string, unknown> = {};
    if (filter.country !== undefined) query.country = filter.country;
    if (filter.productCode) query.productCode = filter.productCode;

    return PricingChange.find(query)
      .sort({ changedAt: -1 })
      .limit(Math.min(filter.limit ?? 100, 500))
      .lean();
  }

  /**
   * Applique un lot de modifications de prix.
   *
   * **Tout ou rien à la validation** : un lot où une seule valeur est invalide
   * est refusé en entier, avec la liste des fautes. Enregistrer la moitié d'une
   * grille laisserait un pays avec des prix incohérents entre eux.
   */
  async applyChanges(
    changes: PricingChangeInput[],
    reason: string,
    changedBy?: string
  ): Promise<{ set: number; reset: number; warnings: PricingWarning[] }> {
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 5) {
      throw new PricingValidationError('Indiquez le motif du changement (5 caractères minimum).');
    }
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new PricingValidationError('Aucune modification à enregistrer.');
    }

    const defaults = loadPricingDefaults();
    const faults: string[] = [];

    for (const change of changes) {
      const label = `${change.country ?? 'catalogue'} / ${change.productCode}`;
      const product = defaults.products[change.productCode];

      if (!product) faults.push(`${label} : produit inconnu.`);
      if (change.field !== 'price' && change.field !== 'idemPrice') faults.push(`${label} : champ inconnu.`);
      if (change.field === 'idemPrice' && product && product.idemPriceXaf === undefined) {
        faults.push(`${label} : ce produit n'a pas de prix « projet IDEM ».`);
      }

      if (change.country !== null) {
        const country = defaults.countries[change.country];
        if (!country) faults.push(`${label} : pays inconnu.`);
        else if (usesCatalogPrice(country)) {
          faults.push(`${label} : la zone CFA applique le prix catalogue, modifiez-le sur « Zone CFA ».`);
        }
      }

      if (change.value !== null) {
        if (!Number.isFinite(change.value) || change.value < 0) {
          faults.push(`${label} : le prix doit être un nombre positif.`);
        } else if (change.country === null && !Number.isInteger(change.value)) {
          // Le franc CFA n'a pas de centimes : « 2999.5 » serait rejeté à l'encaissement.
          faults.push(`${label} : un prix en F CFA doit être un entier.`);
        }
      }
    }

    if (faults.length > 0) {
      throw new PricingValidationError('Certaines modifications sont invalides.', faults);
    }

    let set = 0;
    let reset = 0;

    for (const change of changes) {
      const key = { country: change.country, productCode: change.productCode, field: change.field };
      const existing = await PricingOverride.findOne(key).lean();
      const previousValue = existing ? (existing as any).value : null;

      if (change.value === null) {
        if (!existing) continue;
        await PricingOverride.deleteOne(key);
        reset += 1;
      } else {
        if (existing && (existing as any).value === change.value) continue;
        await PricingOverride.updateOne(
          key,
          { $set: { value: change.value, reason: trimmedReason, updatedBy: changedBy } },
          { upsert: true }
        );
        set += 1;
      }

      await PricingChange.create({
        ...key,
        previousValue,
        newValue: change.value,
        action: change.value === null ? 'reset' : 'set',
        reason: trimmedReason,
        changedBy,
      });
    }

    this.invalidate();
    await this.materialize();

    logger.info('billing.pricing_changed', {
      event: 'billing.pricing_changed',
      set,
      reset,
      changedBy,
    });

    return { set, reset, warnings: pricingWarnings(await this.effective()) };
  }
}

export const pricingService = new PricingService();
