/**
 * Tarification IDEM — types et règles de résolution, partagés.
 *
 * Trois sources, dans cet ordre de priorité :
 *
 *  1. **Les surcharges** posées dans le panel admin (base de données) ;
 *  2. **Le fichier `pricing.config.json`** — les valeurs par défaut, modifiables
 *     directement pour un changement rapide ;
 *  3. rien d'autre : un prix absent des deux n'est pas un prix.
 *
 * Ce module ne lit rien : il ne fait que combiner. L'API lit le fichier sur
 * disque (pour qu'une modification s'applique sans redémarrage), le dashboard
 * l'embarque au build (pour afficher des prix même quand l'API est
 * indisponible). Les deux appliquent ici **la même règle** : c'est ce qui
 * garantit que le prix affiché et le prix encaissé ne divergent jamais.
 */

export type PricingEngine = 'business' | 'appgen' | 'ideploy' | null;
export type PricingInterval = 'month' | 'year' | 'one_time';

export interface PricedProduct {
  name: string;
  description?: string;
  kind: string;
  engine: PricingEngine;
  interval: PricingInterval;
  credits: number;
  /** Prix de la zone CFA, en F CFA entiers. */
  priceXaf: number;
  /** Prix réduit quand l'achat part d'un projet IDEM (iSimulate). */
  idemPriceXaf?: number;
  highlighted?: boolean;
  discountLabel?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CountryPricing {
  name: string;
  /** Indicatif téléphonique, sans `+`. */
  prefix: string;
  currency: string;
  decimals: 0 | 2;
  /**
   * La grille du pays, par code produit, en devise locale.
   *
   * **Absente en zone CFA** : XAF et XOF sont à parité, le prix catalogue
   * s'applique tel quel dans les sept pays. Un pays sans grille ne s'édite pas
   * seul — sinon une surcharge lui créerait une grille d'un seul produit et
   * rendrait tous les autres introuvables.
   */
  prices?: Record<string, number>;
  /** Prix « projet IDEM » par code produit (iSimulate). */
  idemPrices?: Record<string, number>;
}

export interface PricingConfig {
  $schema?: string;
  /** Date de la dernière révision du fichier. */
  version: string;
  baseCurrency: 'XAF';
  /** Remise de l'annuel : 2 mois offerts sur 12. */
  annualDiscountRate: number;
  /**
   * Unités de devise pour 1 dollar, **indicatives**.
   *
   * Servent uniquement à afficher un équivalent et à vérifier l'écart entre
   * pays dans le panel. Aucun prix n'est jamais calculé avec.
   */
  usdRates?: Record<string, number>;
  usdRatesAsOf?: string;
  products: Record<string, PricedProduct>;
  countries: Record<string, CountryPricing>;
}

export type PricingOverrideField = 'price' | 'idemPrice';

export interface PricingOverride {
  id?: string;
  /** `null` = prix catalogue (zone CFA) ; sinon le code pays ISO alpha-3. */
  country: string | null;
  productCode: string;
  field: PricingOverrideField;
  value: number;
  reason?: string;
  updatedBy?: string;
  updatedAt?: string | Date;
}

/** Vrai si le pays applique le prix catalogue (zone CFA). */
export function usesCatalogPrice(country: CountryPricing): boolean {
  return !country.prices;
}

/**
 * Configuration effective : les valeurs par défaut, surchargées.
 *
 * Ne modifie jamais `defaults` : l'appelant garde la configuration du fichier
 * intacte, pour pouvoir montrer côte à côte la valeur par défaut et la valeur
 * appliquée.
 */
export function applyOverrides(defaults: PricingConfig, overrides: PricingOverride[]): PricingConfig {
  const effective: PricingConfig = JSON.parse(JSON.stringify(defaults));

  for (const override of overrides) {
    if (!Number.isFinite(override.value) || override.value < 0) continue;

    if (override.country === null) {
      const product = effective.products[override.productCode];
      if (!product) continue;
      if (override.field === 'price') product.priceXaf = override.value;
      else product.idemPriceXaf = override.value;
      continue;
    }

    const country = effective.countries[override.country];
    // Pays inconnu, ou pays de la zone CFA : voir `CountryPricing.prices`.
    if (!country || usesCatalogPrice(defaults.countries[override.country] ?? country)) continue;

    const grid = override.field === 'price' ? 'prices' : 'idemPrices';
    country[grid] = { ...(country[grid] ?? {}), [override.productCode]: override.value };
  }

  return effective;
}

export interface LocalPrice {
  amount: number;
  currency: string;
}

/**
 * Prix d'un produit dans un pays, en devise locale.
 *
 * `null` quand le pays n'a pas de prix pour ce produit : l'appelant doit alors
 * refuser la vente plutôt qu'inventer un montant.
 */
export function priceInCountry(
  config: PricingConfig,
  productCode: string,
  countryCode: string,
  options: { idem?: boolean } = {}
): LocalPrice | null {
  const product = config.products[productCode];
  const country = config.countries[countryCode.toUpperCase()];
  if (!product || !country) return null;

  if (usesCatalogPrice(country)) {
    const amount = options.idem && product.idemPriceXaf ? product.idemPriceXaf : product.priceXaf;
    return { amount, currency: country.currency };
  }

  const amount = options.idem
    ? country.idemPrices?.[productCode] ?? country.prices?.[productCode]
    : country.prices?.[productCode];

  return amount === undefined ? null : { amount, currency: country.currency };
}

/** Pose un montant sur un palier lisible dans sa magnitude. */
export function readableAmount(amount: number): number {
  const step =
    amount < 100 ? 1 : amount < 1000 ? 10 : amount < 10000 ? 50 : amount < 100000 ? 500 : 1000;
  return Math.max(step, Math.round(amount / step) * step);
}

/**
 * Prix annuel à partir du prix mensuel local.
 *
 * La remise s'applique au prix **local** : un annuel calculé en F CFA puis
 * transposé tomberait hors de la grille du pays. Arrondi lisible hors zone CFA,
 * exact en zone CFA (où le F CFA entier est déjà la norme du catalogue).
 */
export function annualPrice(monthly: number, config: PricingConfig, catalogZone: boolean): number {
  const annual = Math.round(monthly * 12 * (1 - config.annualDiscountRate));
  return catalogZone ? annual : readableAmount(annual);
}

export interface PricingWarning {
  country: string | null;
  productCode?: string;
  kind: 'order' | 'spread_low' | 'spread_high' | 'missing';
  message: string;
}

/**
 * Anomalies d'une configuration, pour le panel.
 *
 * Ce sont des **avertissements**, pas des refus : un prix bas volontaire pour
 * une promotion est légitime. Mais une grille inversée — un Cabinet moins cher
 * qu'un Essentiel — est presque toujours une faute de frappe.
 */
export function pricingWarnings(
  config: PricingConfig,
  /**
   * Bornes de l'écart avec la zone CFA, en dollars.
   *
   * Le plafond est une règle : aucun pays ne paie plus cher que la zone CFA.
   * Le plancher, lui, est **relevé de la grille livrée** — les arbitrages par
   * pays descendent à 55 % sur les petits tickets au Malawi, au Mozambique et
   * en RDC, et c'est voulu. Un prix sous ce plancher n'est donc pas interdit,
   * il est signalé : c'est presque toujours un zéro oublié.
   */
  bounds: { minRatio: number; maxRatio: number } = { minRatio: 0.55, maxRatio: 1.0 }
): PricingWarning[] {
  const warnings: PricingWarning[] = [];
  const catalogUsdRate = config.usdRates?.[config.baseCurrency];

  const paid = Object.entries(config.products)
    .filter(([, product]) => product.isActive && product.priceXaf > 0)
    .sort(([, a], [, b]) => a.priceXaf - b.priceXaf);

  for (const [countryCode, country] of Object.entries(config.countries)) {
    if (usesCatalogPrice(country)) continue;

    let previous: { code: string; amount: number; xaf: number } | null = null;

    for (const [code, product] of paid) {
      const amount = country.prices?.[code];

      if (amount === undefined) {
        warnings.push({
          country: countryCode,
          productCode: code,
          kind: 'missing',
          message: `${product.name} n'a pas de prix en ${country.currency}.`,
        });
        continue;
      }

      // Un produit plus cher au catalogue ne doit pas devenir moins cher ici.
      if (previous && product.priceXaf > previous.xaf && amount < previous.amount) {
        warnings.push({
          country: countryCode,
          productCode: code,
          kind: 'order',
          message: `${product.name} (${amount} ${country.currency}) coûte moins cher qu'une offre moins chère au catalogue (${previous.amount} ${country.currency}).`,
        });
      }
      previous = { code, amount, xaf: product.priceXaf };

      const localRate = config.usdRates?.[country.currency];
      if (!catalogUsdRate || !localRate) continue;

      const ratio = amount / localRate / (product.priceXaf / catalogUsdRate);
      if (ratio < bounds.minRatio) {
        warnings.push({
          country: countryCode,
          productCode: code,
          kind: 'spread_low',
          message: `${product.name} vaut ${Math.round(ratio * 100)} % du prix CFA en dollars — sous le plancher de ${Math.round(bounds.minRatio * 100)} %.`,
        });
      } else if (ratio > bounds.maxRatio * 1.001) {
        warnings.push({
          country: countryCode,
          productCode: code,
          kind: 'spread_high',
          message: `${product.name} vaut ${Math.round(ratio * 100)} % du prix CFA en dollars — au-dessus du prix de la zone CFA.`,
        });
      }
    }
  }

  return warnings;
}
