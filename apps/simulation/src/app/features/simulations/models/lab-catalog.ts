import type { IllustrationName } from '../../../shared/components/illustration/illustration';
import { LabName } from './labs.model';

/** Un test complémentaire, tel que la page « Aller plus loin » le présente. */
export interface LabEntry {
  lab: LabName;
  /** Segment d'URL sous `/simulations/:id/labs/`. */
  path: string;
  /** L'objet qui dit ce que fait le test (AGENTS.md § 4). */
  illustration: IllustrationName;
}

/**
 * Les sept tests, dans l'ordre où ils servent le plus souvent : d'abord ce qui
 * protège le projet, puis ce qui aide à le vendre et à le financer.
 */
export const LAB_CATALOG: readonly LabEntry[] = [
  { lab: 'redTeam', path: 'red-team', illustration: 'shield' },
  { lab: 'customers', path: 'customers', illustration: 'cowries' },
  { lab: 'investors', path: 'investors', illustration: 'baobab' },
  { lab: 'blackSwan', path: 'black-swan', illustration: 'kyinie' },
  { lab: 'experiments', path: 'experiments', illustration: 'daba' },
  { lab: 'universes', path: 'universes', illustration: 'market' },
  { lab: 'timeMachine', path: 'time-machine', illustration: 'ladder' },
];

export function labEntry(lab: LabName): LabEntry {
  return LAB_CATALOG.find((entry) => entry.lab === lab) ?? LAB_CATALOG[0];
}
