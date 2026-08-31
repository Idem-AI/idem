/**
 * Vue allégée d'une simulation, telle que l'API la renvoie pour les listes.
 *
 * Le simulateur est une application à part (`apps/simulation`) : le dashboard
 * n'en montre qu'un récapitulatif et renvoie vers elle pour tout le reste.
 * Ce modèle suit `SimulationSummary` côté API.
 */

export type SimulationStatus =
  | 'draft'
  | 'awaiting-confirmation'
  | 'running'
  | 'completed'
  | 'failed';

export type SimulationVerdict = 'go' | 'go-with-conditions' | 'no-go';

export type SimulationOrigin = 'idem-project' | 'imported-document';

export type SimulationTier = 'run' | 'report' | 'pack';

export interface SimulationSummary {
  id: string;
  projectId: string;
  name: string;
  origin: SimulationOrigin;
  projectName?: string;
  documentName?: string;
  status: SimulationStatus;
  tier: SimulationTier;
  hasReport: boolean;
  revision: number;
  /** Présent une fois l'exécution terminée. */
  viabilityIndex?: number;
  verdict?: SimulationVerdict;
  createdAt: string;
  updatedAt: string;
}
