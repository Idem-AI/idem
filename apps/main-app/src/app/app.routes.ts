import { Routes } from '@angular/router';

export const routes: Routes = [
  // Public layout routes
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'home',
    loadComponent: () => import('./modules/landing/pages/home/home').then((m) => m.Home),
    data: { layout: 'public' },
  },
  {
    path: 'deployment',
    loadComponent: () =>
      import('./modules/landing/pages/deployment/deployment').then((m) => m.DeploymentPage),
    data: { layout: 'public' },
  },
  {
    path: 'african-market',
    loadComponent: () =>
      import('./modules/landing/pages/african-market-page/african-market-page').then(
        (m) => m.AfricanMarketPage
      ),
    data: { layout: 'public' },
  },
  {
    path: 'premium-beta',
    loadComponent: () =>
      import('./modules/landing/pages/premium-beta-access/premium-beta-access').then(
        (m) => m.PremiumBetaAccess
      ),
    data: { layout: 'empty' },
  },
  {
    path: 'login',
    loadComponent: () => import('./modules/auth/pages/login/login').then((m) => m.Login),
    data: { layout: 'empty' },
  },

  // ============================================
  // GLOBAL DASHBOARD ROUTES (layout: 'global')
  // ============================================
  {
    path: 'console',
    loadComponent: () =>
      import('./modules/dashboard/pages/global-dashboard/global-dashboard').then(
        (m) => m.GlobalDashboard
      ),
    data: { layout: 'global' },
  },
  {
    path: 'console/dashboard',
    loadComponent: () =>
      import('./modules/dashboard/pages/global-dashboard/global-dashboard').then(
        (m) => m.GlobalDashboard
      ),
    data: { layout: 'global' },
  },
  {
    path: 'console/projects',
    loadComponent: () =>
      import('./modules/dashboard/pages/projects-list/projects-list').then((m) => m.ProjectsList),
    data: { layout: 'global' },
  },
  {
    path: 'console/teams',
    loadComponent: () =>
      import('./modules/dashboard/pages/my-teams/my-teams').then((m) => m.MyTeams),
    data: { layout: 'global' },
  },
  {
    path: 'console/teams/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-team/create-team').then((m) => m.CreateTeam),
    data: { layout: 'global' },
  },
  {
    path: 'console/teams/:teamId',
    loadComponent: () =>
      import('./modules/dashboard/pages/team-details-global/team-details-global').then(
        (m) => m.TeamDetailsGlobal
      ),
    data: { layout: 'global' },
  },

  // ============================================
  // PROJECT DASHBOARD ROUTES (layout: 'dashboard')
  // ============================================
  {
    path: 'console/project/dashboard',
    loadComponent: () =>
      import('./modules/dashboard/pages/dashboard/dashboard').then((m) => m.DashboardComponent),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/branding',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-branding/show-branding').then(
        (m) => m.ShowBrandingComponent
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/branding/generate',
    loadComponent: () =>
      import(
        './modules/dashboard/pages/show-branding/branding-generation/branding-generation-page'
      ).then((m) => m.BrandingGenerationPage),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/business-plan',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-business-plan/show-business-plan').then(
        (m) => m.ShowBusinessPlan
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/business-plan/generate',
    loadComponent: () =>
      import(
        './modules/dashboard/pages/show-business-plan/business-plan-generation/business-plan-generation-page'
      ).then((m) => m.BusinessPlanGenerationPage),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/diagrams',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-diagrams/show-diagrams').then(
        (m) => m.ShowDiagramsComponent
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/diagrams/generate',
    loadComponent: () =>
      import(
        './modules/dashboard/pages/show-diagrams/diagram-generation/diagram-generation-page'
      ).then((m) => m.DiagramGenerationPage),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/tests',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-tests/show-tests').then((m) => m.ShowTestsComponent),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/development/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/development/create-development/create-development').then(
        (m) => m.CreateDevelopmentComponent
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/development',
    loadComponent: () =>
      import('./modules/dashboard/pages/development/show-development/show-development').then(
        (m) => m.ShowDevelopment
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/deployments/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/create-deployment/create-deployment').then(
        (m) => m.CreateDeployment
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/deployments',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/deployment-list/deployment-list').then(
        (m) => m.DeploymentList
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/deployments/:id',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/deployment-details/deployment-details').then(
        (m) => m.DeploymentDetails
      ),

    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/teams',
    loadComponent: () =>
      import('./modules/dashboard/pages/project-teams/project-teams').then((m) => m.ProjectTeams),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/teams/:teamId',
    loadComponent: () =>
      import('./modules/dashboard/pages/team-details-project/team-details-project').then(
        (m) => m.TeamDetailsProject
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/teams/add',
    loadComponent: () =>
      import('./modules/dashboard/pages/add-team-to-project/add-team-to-project').then(
        (m) => m.AddTeamToProject
      ),
    data: { layout: 'dashboard' },
  },
  {
    path: 'console/project/profile',
    loadComponent: () =>
      import('./modules/dashboard/pages/profile/profile').then((m) => m.ProfileComponent),
    data: { layout: 'dashboard' },
  },

  // Project creation route
  {
    path: 'console/create-project',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/create-project').then(
        (m) => m.CreateProjectComponent
      ),
    data: { layout: 'empty' },
  },

  // Policy pages
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./shared/components/privacy-policy/privacy-policy').then((m) => m.PrivacyPolicy),
    data: { layout: 'public' },
  },
  {
    path: 'terms-of-service',
    loadComponent: () =>
      import('./shared/components/terms-of-service/terms-of-service').then((m) => m.TermsOfService),
    data: { layout: 'public' },
  },
  {
    path: 'beta-policy',
    loadComponent: () =>
      import('./shared/components/beta-policy/beta-policy').then((m) => m.BetaPolicy),
    data: { layout: 'public' },
  },

  // 404 Not Found route
  {
    path: 'not-found',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent),
    data: { layout: 'public' },
  },

  // Catch all unknown routes and redirect to 404
  { path: '**', redirectTo: 'not-found' },
];
