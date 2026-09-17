import * as fs from 'fs';
import * as path from 'path';
import logger from './logger';
import type { PricingConfig } from '../../../../packages/shared-models/src/pricing/pricing';

/**
 * Chargement du fichier de tarification.
 *
 * **Relu sur disque, pas importé.** Un `import` figerait les prix au démarrage
 * du processus ; relire le fichier dès que sa date de modification change fait
 * qu'un prix corrigé s'applique sans redémarrer l'API. En développement, le
 * dossier `packages/` est monté en volume dans le conteneur : une modification
 * sur la machine atteint l'API en direct.
 *
 * **Une faute de frappe ne fait pas tomber la tarification.** Si le fichier
 * devient invalide, on garde la dernière configuration valide et on le
 * journalise fort — un JSON mal fermé ne doit pas rendre les paiements
 * impossibles.
 *
 * Le chemin est surchargeable par `PRICING_CONFIG_PATH`, pour la production où
 * le fichier peut vivre ailleurs que dans le dépôt.
 */

const DEFAULT_PATH = path.resolve(
  __dirname,
  '../../../../packages/shared-models/src/pricing/pricing.config.json'
);

interface LoadedPricing {
  path: string;
  mtimeMs: number;
  loadedAt: Date;
  config: PricingConfig;
}

let current: LoadedPricing | null = null;

export function pricingConfigPath(): string {
  const override = process.env.PRICING_CONFIG_PATH?.trim();
  return override ? path.resolve(override) : DEFAULT_PATH;
}

/** Valeurs par défaut, relues si le fichier a changé depuis la dernière lecture. */
export function loadPricingDefaults(): PricingConfig {
  const file = pricingConfigPath();

  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch (error: any) {
    if (current) {
      logger.error(`billing.pricing_file_missing: ${error.message}`, {
        event: 'billing.pricing_file_missing',
        path: file,
      });
      return current.config;
    }
    throw new Error(`Fichier de tarification introuvable : ${file}`);
  }

  if (current && current.path === file && current.mtimeMs === stat.mtimeMs) {
    return current.config;
  }

  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf-8'));
    assertPricingConfig(config);

    const firstLoad = current === null;
    current = { path: file, mtimeMs: stat.mtimeMs, loadedAt: new Date(), config };

    logger.info(firstLoad ? 'billing.pricing_loaded' : 'billing.pricing_reloaded', {
      event: firstLoad ? 'billing.pricing_loaded' : 'billing.pricing_reloaded',
      version: config.version,
      products: Object.keys(config.products).length,
      countries: Object.keys(config.countries).length,
    });

    return config;
  } catch (error: any) {
    if (current) {
      logger.error(`billing.pricing_file_invalid: ${error.message}`, {
        event: 'billing.pricing_file_invalid',
        path: file,
        keptVersion: current.config.version,
      });
      return current.config;
    }
    throw new Error(`Fichier de tarification invalide (${file}) : ${error.message}`);
  }
}

/** D'où viennent les valeurs par défaut en cours — affiché dans le panel. */
export function pricingSource(): { path: string; version: string; loadedAt: Date } | null {
  return current
    ? { path: current.path, version: current.config.version, loadedAt: current.loadedAt }
    : null;
}

/**
 * Vérification structurelle minimale.
 *
 * Le JSON Schema guide l'édition dans l'éditeur ; cette vérification protège
 * l'exécution, qui ne doit jamais tarifer à partir d'un fichier incohérent.
 */
function assertPricingConfig(value: any): asserts value is PricingConfig {
  if (!value || typeof value !== 'object') throw new Error('racine absente');
  if (typeof value.version !== 'string') throw new Error('« version » manquante');

  const rate = value.annualDiscountRate;
  if (typeof rate !== 'number' || rate < 0 || rate > 0.5) {
    throw new Error('« annualDiscountRate » doit être un nombre entre 0 et 0,5');
  }

  if (!value.products || typeof value.products !== 'object') throw new Error('« products » manquant');
  for (const [code, product] of Object.entries<any>(value.products)) {
    if (!Number.isInteger(product?.priceXaf) || product.priceXaf < 0) {
      throw new Error(`${code} : « priceXaf » doit être un entier positif`);
    }
    if (product.idemPriceXaf !== undefined && (!Number.isInteger(product.idemPriceXaf) || product.idemPriceXaf < 0)) {
      throw new Error(`${code} : « idemPriceXaf » doit être un entier positif`);
    }
  }

  if (!value.countries || typeof value.countries !== 'object') throw new Error('« countries » manquant');
  for (const [code, country] of Object.entries<any>(value.countries)) {
    if (!/^[A-Z]{3}$/.test(code)) throw new Error(`pays « ${code} » : code ISO alpha-3 attendu`);
    if (typeof country?.currency !== 'string') throw new Error(`${code} : « currency » manquant`);
    for (const grid of ['prices', 'idemPrices']) {
      for (const [productCode, amount] of Object.entries<any>(country[grid] ?? {})) {
        if (!value.products[productCode]) {
          throw new Error(`${code}.${grid} : produit inconnu « ${productCode} »`);
        }
        if (typeof amount !== 'number' || amount < 0) {
          throw new Error(`${code}.${grid}.${productCode} : montant invalide`);
        }
      }
    }
  }
}
