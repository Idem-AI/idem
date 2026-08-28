import { Routes } from '@angular/router';

import { authGuard } from './core/auth';

/** Écrans d'une exécution : chargés sous la coquille de contexte. */
const simulationRoutes: Routes = [
  {
    path: '',
    title: 'nav.overview',
    loadComponent: () =>
      import('./features/simulations/pages/simulation-overview/simulation-overview').then(
        (m) => m.SimulationOverview,
      ),
  },
  {
    path: 'understanding',
    title: 'nav.understanding',
    loadComponent: () =>
      import('./features/simulations/pages/simulation-understanding/simulation-understanding').then(
        (m) => m.SimulationUnderstanding,
      ),
  },
  {
    path: 'factors',
    title: 'nav.factors',
    loadComponent: () =>
      import('./features/simulations/pages/simulation-factors/simulation-factors').then(
        (m) => m.SimulationFactors,
      ),
  },
  {
    path: 'scenarios',
    title: 'nav.scenarios',
    loadComponent: () =>
      import('./features/simulations/pages/simulation-scenarios/simulation-scenarios').then(
        (m) => m.SimulationScenarios,
      ),
  },
  {
    path: 'financials',
    title: 'nav.financials',
    loadComponent: () =>
      import('./features/simulations/pages/simulation-financials/simulation-financials').then(
        (m) => m.SimulationFinancials,
      ),
  },
  {
    path: 'labs/red-team',
    title: 'nav.lab.redTeam',
    loadComponent: () =>
      import('./features/simulations/pages/labs/lab-red-team/lab-red-team').then((m) => m.LabRedTeam),
  },
  {
    path: 'labs/customers',
    title: 'nav.lab.customers',
    loadComponent: () =>
      import('./features/simulations/pages/labs/lab-customers/lab-customers').then(
        (m) => m.LabCustomers,
      ),
  },
  {
    path: 'labs/investors',
    title: 'nav.lab.investors',
    loadComponent: () =>
      import('./features/simulations/pages/labs/lab-investors/lab-investors').then(
        (m) => m.LabInvestors,
      ),
  },
  {
    path: 'labs/black-swan',
    title: 'nav.lab.blackSwan',
    loadComponent: () =>
      import('./features/simulations/pages/labs/lab-black-swan/lab-black-swan').then(
        (m) => m.LabBlackSwan,
      ),
  },
  {
    path: 'labs/universes',
    title: 'nav.lab.universes',
    loadComponent: () =>
      import('./features/simulations/pages/labs/lab-universes/lab-universes').then(
        (m) => m.LabUniverses,
      ),
  },
  {
    path: 'labs/time-machine',
    title: 'nav.lab.timeMachine',
    loadComponent: () =>
      import('./features/simulations/pages/labs/lab-time-machine/lab-time-machine').then(
        (m) => m.LabTimeMachine,
      ),
  },
  {
    path: 'labs/experiments',
    title: 'nav.lab.experiments',
    loadComponent: () =>
      import('./features/simulations/pages/labs/lab-experiments/lab-experiments').then(
        (m) => m.LabExperiments,
      ),
  },
  {
    path: 'report',
    title: 'nav.report',
    loadComponent: () =>
      import('./features/simulations/pages/simulation-report/simulation-report').then(
        (m) => m.SimulationReportPage,
      ),
  },
  {
    path: 'compare',
    title: 'nav.compare',
    loadComponent: () =>
      import('./features/simulations/pages/simulation-compare/simulation-compare').then(
        (m) => m.SimulationCompare,
      ),
  },
];

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/app-shell/app-shell').then((m) => m.AppShell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'simulations' },
      {
        path: 'simulations',
        pathMatch: 'full',
        title: 'nav.simulations',
        loadComponent: () =>
          import('./features/simulations/pages/simulation-list/simulation-list').then(
            (m) => m.SimulationList,
          ),
      },
      {
        path: 'simulations/new',
        title: 'nav.new',
        loadComponent: () =>
          import('./features/simulations/pages/new-simulation/new-simulation').then(
            (m) => m.NewSimulation,
          ),
      },
      {
        path: 'simulations/:id',
        loadComponent: () =>
          import('./features/simulations/pages/simulation-workspace/simulation-workspace').then(
            (m) => m.SimulationWorkspace,
          ),
        children: simulationRoutes,
      },
    ],
  },
  {
    // Retour du login central, et point d'arrivée du bouton « Simuler mon
    // entreprise » du dashboard IDEM : confirme la session, puis entre dans
    // l'application. Aucune connexion ne se fait ici.
    path: 'auth/idem',
    loadComponent: () =>
      import('./features/auth/pages/sso-callback/sso-callback').then((m) => m.SsoCallback),
  },
  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found/not-found').then((m) => m.NotFound),
  },
];
