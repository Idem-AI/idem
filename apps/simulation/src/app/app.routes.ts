import { Routes } from '@angular/router';

import { anonymousGuard, authGuard } from './core/auth';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/app-shell/app-shell').then((m) => m.AppShell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'simulations' },
      {
        path: 'simulations',
        title: 'nav.simulations',
        loadComponent: () =>
          import('./features/simulations/pages/simulation-list/simulation-list').then(
            (m) => m.SimulationList,
          ),
      },
      {
        path: 'simulations/new',
        title: 'newRun.title',
        loadComponent: () =>
          import('./features/simulations/pages/new-simulation/new-simulation').then(
            (m) => m.NewSimulation,
          ),
      },
      {
        path: 'simulations/:id',
        loadComponent: () =>
          import('./features/simulations/pages/simulation-run/simulation-run').then(
            (m) => m.SimulationRun,
          ),
        title: 'run.title',
      },
      {
        path: 'simulations/:id/results',
        loadComponent: () =>
          import('./features/simulations/pages/simulation-results/simulation-results').then(
            (m) => m.SimulationResults,
          ),
        title: 'results.title',
      },
      {
        path: 'simulations/:id/report',
        loadComponent: () =>
          import('./features/simulations/pages/simulation-report/simulation-report').then(
            (m) => m.SimulationReportPage,
          ),
        title: 'report.title',
      },
      {
        path: 'simulations/:id/compare',
        loadComponent: () =>
          import('./features/simulations/pages/simulation-compare/simulation-compare').then(
            (m) => m.SimulationCompare,
          ),
        title: 'compare.title',
      },
    ],
  },
  {
    path: 'login',
    canActivate: [anonymousGuard],
    title: 'auth.signIn',
    loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.Login),
  },
  {
    // Landing spot for the "Simuler mon entreprise" button in the IDEM
    // dashboard: consumes the handoff token, then continues to the run.
    path: 'auth/idem',
    loadComponent: () => import('./features/auth/pages/handoff/handoff').then((m) => m.Handoff),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/components/not-found/not-found').then((m) => m.NotFound),
  },
];
