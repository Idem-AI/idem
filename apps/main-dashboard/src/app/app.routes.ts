import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Redirect root to console
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'console',
  },

  {
    path: 'login',
    loadComponent: () => import('./modules/auth/pages/login/login').then((m) => m.Login),
    canActivate: [publicGuard],
    data: { layout: 'empty' },
  },

  // ============================================
  // GLOBAL DASHBOARD ROUTES (layout: 'global')
  // ============================================
  {
    path: 'console',
    loadComponent: () =>
      import('./modules/dashboard/pages/global-dashboard/global-dashboard').then(
        (m) => m.GlobalDashboard,
      ),
    canActivate: [authGuard],
    data: { layout: 'empty' },
  },
  {
    path: 'console/dashboard',
    loadComponent: () =>
      import('./modules/dashboard/pages/global-dashboard/global-dashboard').then(
        (m) => m.GlobalDashboard,
      ),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },
  {
    path: 'console/projects',
    loadComponent: () =>
      import('./modules/dashboard/pages/projects-list/projects-list').then((m) => m.ProjectsList),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },
  {
    path: 'console/teams',
    loadComponent: () =>
      import('./modules/dashboard/pages/my-teams/my-teams').then((m) => m.MyTeams),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },
  {
    path: 'console/teams/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-team/create-team').then((m) => m.CreateTeam),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },
  {
    path: 'console/teams/:teamId',
    loadComponent: () =>
      import('./modules/dashboard/pages/team-details-global/team-details-global').then(
        (m) => m.TeamDetailsGlobal,
      ),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },

  // ============================================
  // PROJECT DASHBOARD ROUTES (layout: 'dashboard')
  // ============================================
  {
    path: 'console/project/dashboard',
    loadComponent: () =>
      import('./modules/dashboard/pages/dashboard/dashboard').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/branding',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-branding/show-branding').then(
        (m) => m.ShowBrandingComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/branding/generate',
    loadComponent: () =>
      import(
        './modules/dashboard/pages/show-branding/branding-generation/branding-generation-page'
      ).then((m) => m.BrandingGenerationPage),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/business-plan',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-business-plan/show-business-plan').then(
        (m) => m.ShowBusinessPlan,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/business-plan/generate',
    loadComponent: () =>
      import(
        './modules/dashboard/pages/show-business-plan/business-plan-generation/business-plan-generation-page'
      ).then((m) => m.BusinessPlanGenerationPage),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/diagrams',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-diagrams/show-diagrams').then(
        (m) => m.ShowDiagramsComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/diagrams/generate',
    loadComponent: () =>
      import(
        './modules/dashboard/pages/show-diagrams/diagram-generation/diagram-generation-page'
      ).then((m) => m.DiagramGenerationPage),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/tests',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-tests/show-tests').then((m) => m.ShowTestsComponent),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/development/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/development/create-development/create-development').then(
        (m) => m.CreateDevelopmentComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/development',
    loadComponent: () =>
      import('./modules/dashboard/pages/development/show-development/show-development').then(
        (m) => m.ShowDevelopment,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/deployments/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/create-deployment/create-deployment').then(
        (m) => m.CreateDeployment,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/deployments',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/deployment-list/deployment-list').then(
        (m) => m.DeploymentList,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/deployments/:id',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/deployment-details/deployment-details').then(
        (m) => m.DeploymentDetails,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/teams',
    loadComponent: () =>
      import('./modules/dashboard/pages/project-teams/project-teams').then((m) => m.ProjectTeams),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/teams/:teamId',
    loadComponent: () =>
      import('./modules/dashboard/pages/team-details-project/team-details-project').then(
        (m) => m.TeamDetailsProject,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/teams/add',
    loadComponent: () =>
      import('./modules/dashboard/pages/add-team-to-project/add-team-to-project').then(
        (m) => m.AddTeamToProject,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/profile',
    loadComponent: () =>
      import('./modules/dashboard/pages/profile/profile').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },

  // Project creation route
  {
    path: 'create-project',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/create-project').then(
        (m) => m.CreateProjectComponent,
      ),
    data: { layout: 'empty' },
  },
  // 404 Not Found route
  {
    path: 'not-found',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent),
    data: { layout: 'empty' },
  },

  // Catch all unknown routes and redirect to 404
  { path: '**', redirectTo: 'not-found' },
];
