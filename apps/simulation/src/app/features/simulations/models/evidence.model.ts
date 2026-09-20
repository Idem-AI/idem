/**
 * Miroir du contrat exposé par `api/models/simulation.model.ts`.
 *
 * Les types sont dupliqués plutôt que partagés : c'est la convention du dépôt
 * (le module Finance fait de même), et cela garde le front indépendant du
 * cycle de build de l'API.
 */

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * D'où vient une valeur.
 *  - `data`       : chiffre observé et sourcé.
 *  - `estimate`   : dérivé de données comparables.
 *  - `assumption` : choix assumé du moteur, faute de mieux.
 */
export type EvidenceKind = 'data' | 'estimate' | 'assumption';

export interface Evidence {
  id: string;
  label: string;
  /** Déjà formatée pour l'affichage, unité comprise. */
  value: string;
  numericValue?: number;
  unit?: string;
  kind: EvidenceKind;
  confidence: ConfidenceLevel;
  source?: string;
  sourceUrl?: string;
  /** Date de la donnée sous-jacente, pas de la simulation. */
  asOf?: string;
  note?: string;
}
