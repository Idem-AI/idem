import logger from '../../config/logger';
import { PaymentCountry, SUPPORTED_COUNTRIES } from '../../models/payment.model';
import { pawapayClient } from './pawapay.client';

/**
 * Les pays réellement proposables à l'écran.
 *
 * Deux conditions, et il faut les deux :
 *
 *  1. **Nous savons tarifer le pays** — il figure dans `SUPPORTED_COUNTRIES`
 *     avec son prix de référence arbitré ;
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

let cache: { at: number; countries: PaymentCountry[] } | null = null;

class PaymentCountriesService {
  /** Pays proposables, tarifés ici et provisionnés chez pawaPay. */
  async available(): Promise<PaymentCountry[]> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.countries;

    try {
      const conf = await pawapayClient.getActiveConfiguration();
      const provisioned = new Set(
        (conf.countries ?? []).map((entry) => String(entry.country).toUpperCase())
      );

      const countries = SUPPORTED_COUNTRIES.filter((country) => provisioned.has(country.code));

      // Un pays provisionné que nous ne savons pas tarifer ne peut pas être
      // proposé non plus : on le signale, c'est du revenu qui attend un prix.
      const unpriced = [...provisioned].filter(
        (code) => !SUPPORTED_COUNTRIES.some((country) => country.code === code)
      );

      if (unpriced.length > 0) {
        logger.warn('billing.countries_unpriced', {
          event: 'billing.countries_unpriced',
          codes: unpriced,
        });
      }

      if (countries.length === 0) {
        logger.error('billing.countries_empty', {
          event: 'billing.countries_empty',
          provisioned: [...provisioned],
        });
        return this.fallback();
      }

      cache = { at: Date.now(), countries };
      return countries;
    } catch (error: any) {
      logger.warn(`billing.countries_conf_failed: ${error.message}`, {
        event: 'billing.countries_conf_failed',
      });

      // Le dernier relevé réussi vaut mieux que le repli figé.
      if (cache) return cache.countries;
      return this.fallback();
    }
  }

  /** Vrai si le pays est proposable — le contrôle que fait le devis. */
  async isAvailable(code: string): Promise<boolean> {
    const countries = await this.available();
    return countries.some((country) => country.code === code.toUpperCase());
  }

  /** Vide le cache après un changement de configuration côté pawaPay. */
  invalidate(): void {
    cache = null;
  }

  private fallback(): PaymentCountry[] {
    return SUPPORTED_COUNTRIES.filter((country) => FALLBACK_CODES.includes(country.code));
  }
}

export const paymentCountriesService = new PaymentCountriesService();
