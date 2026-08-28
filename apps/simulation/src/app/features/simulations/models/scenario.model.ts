/**
 * Scenarios are not just optimistic/realistic/pessimistic: the engine
 * combines factor shifts, so a run can be a routine downside, a deliberate
 * stress test, or a rare compound shock.
 */
export type ScenarioKind = 'baseline' | 'favourable' | 'adverse' | 'stress' | 'extreme';

export interface ScenarioShift {
  factorId: string;
  label: string;
  /** Human-readable delta, e.g. "-30 %" or "+6 mois". */
  delta: string;
}

export interface Scenario {
  id: string;
  name: string;
  kind: ScenarioKind;
  question: string;
  shifts: ScenarioShift[];
  /** Simulated viability under this scenario, 0-100. */
  viability: number;
  /** Months to break-even, or null when the scenario never breaks even. */
  breakEvenMonth: number | null;
  runwayMonths: number | null;
  /** Whether the model still holds together in this scenario. */
  survives: boolean;
  outcome: string;
}
