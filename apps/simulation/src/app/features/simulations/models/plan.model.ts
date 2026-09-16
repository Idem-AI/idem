import { SimulationTier } from './simulation.model';

/**
 * Simulation is billed separately from the rest of IDEM: a run spends real
 * research, agent and compute budget, so the price is shown and confirmed
 * before anything starts.
 */
export interface SimulationPlan {
  tier: SimulationTier;
  /**
   * Produit du catalogue correspondant à ce niveau, servi par l'API.
   *
   * C'est lui qu'on passe au paiement : sans cela, l'écran devrait tenir sa
   * propre table niveau → produit, qui divergerait du catalogue au premier
   * changement d'offre.
   */
  productCode: string;
  price: number;
  /** Undiscounted price, present only when a discount applies. */
  listPrice?: number;
  currency: string;
  /** Translation keys for the bullet list, resolved by the template. */
  includes: string[];
  recommended: boolean;
}

export interface SimulationPricing {
  /** True when the run starts from an IDEM project, which costs less to analyse. */
  idemProjectDiscount: boolean;
  plans: SimulationPlan[];
}
