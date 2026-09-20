import type { PricingConfig } from './pricing';
import config from './pricing.config.json';

/**
 * Les prix par défaut, embarqués au build.
 *
 * Réservé au **front** : il s'en sert pour afficher des prix quand l'API est
 * indisponible, plutôt qu'une page vide. L'API ne l'importe pas — elle relit le
 * fichier sur disque, pour qu'une modification s'applique sans redémarrage.
 *
 * Ces valeurs ne tiennent pas compte des surcharges posées dans le panel : le
 * front les signale donc comme **indicatives**.
 */
export const PRICING_DEFAULTS = config as unknown as PricingConfig;
