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
    path: 'dashboard',
    loadComponent: () =>
      import('./modules/dashboard/pages/global-dashboard/global-dashboard').then(
        (m) => m.GlobalDashboard,
      ),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },
  {
    path: 'projects',
    loadComponent: () =>
      import('./modules/dashboard/pages/projects-list/projects-list').then((m) => m.ProjectsList),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },
  {
    path: 'teams',
    loadComponent: () =>
      import('./modules/dashboard/pages/my-teams/my-teams').then((m) => m.MyTeams),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },
  {
    path: 'teams/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-team/create-team').then((m) => m.CreateTeam),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },
  {
    path: 'teams/:teamId',
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
    path: 'project/dashboard',
    loadComponent: () =>
      import('./modules/dashboard/pages/dashboard/dashboard').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-branding/show-branding').then(
        (m) => m.ShowBrandingComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/complete-branding',
    loadComponent: () =>
      import('./modules/dashboard/pages/complete-branding/complete-branding').then(
        (m) => m.CompleteBrandingPage,
      ),
    canActivate: [authGuard],
    data: { layout: 'empty' },
  },
  {
    path: 'project/branding/display',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-branding/components/branding-display/branding-display').then(
        (m) => m.BrandingDisplayComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding/generate',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-branding/branding-generation/branding-generation-page').then(
        (m) => m.BrandingGenerationPage,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding/logo-variations',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/components/logo-variations/logo-variations').then(
        (m) => m.LogoVariationsComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding/select-colors',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/components/color-selection/color-selection').then(
        (m) => m.ColorSelectionComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding/select-typography',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/components/typography-selection/typography-selection').then(
        (m) => m.TypographySelectionComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/business-plan',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-business-plan/show-business-plan').then(
        (m) => m.ShowBusinessPlan,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/business-plan/generate',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-business-plan/business-plan-generation/business-plan-generation-page').then(
        (m) => m.BusinessPlanGenerationPage,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/communication',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-communication/show-communication').then(
        (m) => m.ShowCommunication,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/pitch-deck',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-pitch-deck/show-pitch-deck').then(
        (m) => m.ShowPitchDeck,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/legal-docs',
    loadComponent: () =>
      import('./modules/dashboard/pages/legal-docs/legal-docs').then((m) => m.LegalDocsPage),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/advisor',
    loadComponent: () =>
      import('./modules/dashboard/pages/advisor/advisor').then((m) => m.AdvisorPage),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/diagrams',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-diagrams/show-diagrams').then(
        (m) => m.ShowDiagramsComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/diagrams/generate',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-diagrams/diagram-generation/diagram-generation-page').then(
        (m) => m.DiagramGenerationPage,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/tests',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-tests/show-tests').then((m) => m.ShowTestsComponent),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/development/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/development/create-development/create-development').then(
        (m) => m.CreateDevelopmentComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/development',
    loadComponent: () =>
      import('./modules/dashboard/pages/development/show-development/show-development').then(
        (m) => m.ShowDevelopment,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/ideploy',
    loadComponent: () =>
      import('./modules/dashboard/pages/ideploy-overview/ideploy-overview').then(
        (m) => m.IDeployOverview,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/deployments/create',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/create-deployment/create-deployment').then(
        (m) => m.CreateDeployment,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/deployments',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/deployment-list/deployment-list').then(
        (m) => m.DeploymentList,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/deployments/:id',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/deployment-details/deployment-details').then(
        (m) => m.DeploymentDetails,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/teams',
    loadComponent: () =>
      import('./modules/dashboard/pages/project-teams/project-teams').then((m) => m.ProjectTeams),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/teams/:teamId',
    loadComponent: () =>
      import('./modules/dashboard/pages/team-details-project/team-details-project').then(
        (m) => m.TeamDetailsProject,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/teams/add',
    loadComponent: () =>
      import('./modules/dashboard/pages/add-team-to-project/add-team-to-project').then(
        (m) => m.AddTeamToProject,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/profile',
    loadComponent: () =>
      import('./modules/dashboard/pages/profile/profile').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },

  // ============================================
  // FINANCE MODULE ROUTES (layout: 'dashboard')
  // ============================================
  {
    path: 'project/finance',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-overview/finance-overview').then(
        (m) => m.FinanceOverviewComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/finance/products',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'products' },
  },
  {
    path: 'project/finance/sales',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'salesObjectives' },
  },
  {
    path: 'project/finance/charges',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'variableCharges' },
  },
  {
    path: 'project/finance/fixed-charges',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'fixedCharges' },
  },
  {
    path: 'project/finance/taxes',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'taxesParams' },
  },
  {
    path: 'project/finance/revenue',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'revenueParams' },
  },
  {
    path: 'project/finance/investments',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'investments' },
  },
  {
    path: 'project/finance/amortization',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'amortization' },
  },
  {
    path: 'project/finance/financing',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'financing' },
  },
  {
    path: 'project/finance/ratios-params',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'ratiosParams' },
  },
  {
    path: 'project/finance/exploitation',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'compteExploitation' },
  },
  {
    path: 'project/finance/bilan',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'bilan' },
  },
  {
    path: 'project/finance/cashflow',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'fluxTresorerie' },
  },
  {
    path: 'project/finance/ratios',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'ratios' },
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
