import logger from '../../config/logger';
import { PricingCountry, pricingService } from '../billing/pricing.service';
import { pawapayClient } from './pawapay.client';

/**
 * Les pays réellement proposables à l'écran.
 *
 * Deux conditions, et il faut les deux :
 *
 *  1. **Le pays est tarifé** — il figure dans la tarification effective (le
 *     fichier `pricing.config.json`, surchargé par le panel admin) ;
 *  2. **Le compte pawaPay y est provisionné** — il figure dans `/active-conf`,
 *     qui décrit la configuration de *notre* compte, pas la couverture
 *     commerciale de pawaPay.
 *
 * L'intersection n'est pas un raffinement : sans elle, un pays apparaît dans la
 * liste, l'utilisateur saisit son numéro, et l'échec ne survient qu'au moment
 * de payer. C'est le pire endroit pour apprendre qu'un marché n'est pas ouvert.
 */

/** Dix minutes : la configuration d'un compte ne change pas dans la journée. */
const TTL_MS = 10 * 60_000;

/**
 * Repli si pawaPay est injoignable.
 *
 * Renvoyer une liste vide bloquerait tout paiement, y compris là où il
 * fonctionne. On retombe donc sur ce que le compte portait au dernier relevé
 * connu (16/09/2026) — à corriger si le provisionnement change pendant une
 * panne, ce qui est le cas le moins probable qui soit.
 */
const FALLBACK_CODES = [
  'BEN',
  'CIV',
  'CMR',
  'COD',
  'COG',
  'GAB',
  'KEN',
  'MOZ',
  'RWA',
  'SEN',
  'SLE',
  'UGA',
  'ZMB',
];

let provisionedCache: { at: number; codes: Set<string> } | null = null;

class PaymentCountriesService {
  /** Pays proposables : tarifés ici et provisionnés chez pawaPay. */
  async available(): Promise<PricingCountry[]> {
    const priced = await pricingService.countries();
    const provisioned = await this.provisionedCodes();

    if (!provisioned) {
      return priced.filter((country) => FALLBACK_CODES.includes(country.code));
    }

    const countries = priced.filter((country) => provisioned.has(country.code));

    // Un pays provisionné que nous ne savons pas tarifer ne peut pas être
    // proposé non plus : on le signale, c'est du revenu qui attend un prix.
    const unpriced = [...provisioned].filter(
      (code) => !priced.some((country) => country.code === code)
    );
    if (unpriced.length > 0) {
      logger.warn('billing.countries_unpriced', { event: 'billing.countries_unpriced', codes: unpriced });
    }

    if (countries.length === 0) {
      logger.error('billing.countries_empty', {
        event: 'billing.countries_empty',
        provisioned: [...provisioned],
      });
      return priced.filter((country) => FALLBACK_CODES.includes(country.code));
    }

    return countries;
  }

  /** Vrai si le pays est proposable — le contrôle que fait le devis. */
  async isAvailable(code: string): Promise<boolean> {
    const countries = await this.available();
    return countries.some((country) => country.code === code.toUpperCase());
  }

  /** Vide le cache après un changement de configuration côté pawaPay. */
  invalidate(): void {
    provisionedCache = null;
  }

  /**
   * Codes provisionnés sur le compte, ou `null` si pawaPay est injoignable.
   *
   * Seul le provisionnement est mis en cache : la tarification a son propre
   * cache, et un prix modifié dans le panel doit se voir sans attendre dix
   * minutes.
   */
  private async provisionedCodes(): Promise<Set<string> | null> {
    if (provisionedCache && Date.now() - provisionedCache.at < TTL_MS) {
      return provisionedCache.codes;
    }

    try {
      const conf = await pawapayClient.getActiveConfiguration();
      const codes = new Set(
        (conf.countries ?? []).map((entry) => String(entry.country).toUpperCase())
      );
      provisionedCache = { at: Date.now(), codes };
      return codes;
    } catch (error: any) {
      logger.warn(`billing.countries_conf_failed: ${error.message}`, {
        event: 'billing.countries_conf_failed',
      });
      // Le dernier relevé réussi vaut mieux que le repli figé.
      return provisionedCache?.codes ?? null;
    }
  }
}

export const paymentCountriesService = new PaymentCountriesService();
