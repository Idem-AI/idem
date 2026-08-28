/**
 * How confident the engine is in a value it used.
 *
 * Kept separate from the value itself because the product's core promise is
 * that a reader can always tell a measurement from a guess.
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Where a number came from.
 *
 * - `data`       — an observed, sourced figure.
 * - `estimate`   — derived from comparable data.
 * - `assumption` — chosen by the engine because nothing better existed.
 */
export type EvidenceKind = 'data' | 'estimate' | 'assumption';

/** A single value used by the simulation, with its provenance. */
export interface Evidence {
  id: string;
  label: string;
  /** Already formatted for display, including its unit. */
  value: string;
  kind: EvidenceKind;
  confidence: ConfidenceLevel;
  /** Publisher or derivation, e.g. "Prix à la pompe, MINEE". */
  source?: string;
  sourceUrl?: string;
  /** ISO date of the underlying figure, not of the simulation. */
  asOf?: string;
  note?: string;
}
