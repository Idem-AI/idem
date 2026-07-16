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
    title: 'navigation.titles.login',
    loadComponent: () => import('./modules/auth/pages/login/login').then((m) => m.Login),
    canActivate: [publicGuard],
    data: { layout: 'empty' },
  },

  // ============================================
  // GLOBAL DASHBOARD ROUTES (layout: 'global')
  // ============================================
  {
    path: 'console',
    title: 'navigation.titles.console',
    loadComponent: () =>
      import('./modules/dashboard/pages/global-dashboard/global-dashboard').then(
        (m) => m.GlobalDashboard,
      ),
    canActivate: [authGuard],
    data: { layout: 'empty' },
  },
  {
    path: 'dashboard',
    redirectTo: 'console',
    pathMatch: 'full',
  },
  {
    path: 'projects',
    title: 'navigation.titles.projects',
    loadComponent: () =>
      import('./modules/dashboard/pages/projects-list/projects-list').then((m) => m.ProjectsList),
    canActivate: [authGuard],
    data: { layout: 'global' },
  },

  // ============================================
  // CHAT MODE ROUTES (layout: 'chat')
  // ============================================
  {
    path: 'chat',
    title: 'navigation.titles.chat',
    loadComponent: () =>
      import('./modules/chat/pages/chat-home/chat-home').then((m) => m.ChatHomePage),
    canActivate: [authGuard],
    data: { layout: 'chat' },
  },
  {
    path: 'chat/new',
    title: 'navigation.titles.chatNew',
    loadComponent: () =>
      import('./modules/chat/pages/chat-home/chat-home').then((m) => m.ChatHomePage),
    canActivate: [authGuard],
    data: { layout: 'chat', onboarding: true },
  },

  // ============================================
  // PROJECT DASHBOARD ROUTES (layout: 'dashboard')
  // ============================================
  {
    path: 'project/dashboard',
    title: 'navigation.titles.dashboard',
    loadComponent: () =>
      import('./modules/dashboard/pages/dashboard/dashboard').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding',
    title: 'navigation.titles.branding',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-branding/show-branding').then(
        (m) => m.ShowBrandingComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/complete-branding',
    title: 'navigation.titles.completeBranding',
    loadComponent: () =>
      import('./modules/dashboard/pages/complete-branding/complete-branding').then(
        (m) => m.CompleteBrandingPage,
      ),
    canActivate: [authGuard],
    data: { layout: 'empty' },
  },
  {
    path: 'project/branding/display',
    title: 'navigation.titles.brandingDisplay',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-branding/components/branding-display/branding-display').then(
        (m) => m.BrandingDisplayComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding/generate',
    title: 'navigation.titles.brandingGenerate',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-branding/branding-generation/branding-generation-page').then(
        (m) => m.BrandingGenerationPage,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding/logo-variations',
    title: 'navigation.titles.logoVariations',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/components/logo-variations/logo-variations').then(
        (m) => m.LogoVariationsComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding/select-colors',
    title: 'navigation.titles.selectColors',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/components/color-selection/color-selection').then(
        (m) => m.ColorSelectionComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/branding/select-typography',
    title: 'navigation.titles.selectTypography',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/components/typography-selection/typography-selection').then(
        (m) => m.TypographySelectionComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/business-plan',
    title: 'navigation.titles.businessPlan',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-business-plan/show-business-plan').then(
        (m) => m.ShowBusinessPlan,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/business-plan/generate',
    title: 'navigation.titles.businessPlanGenerate',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-business-plan/business-plan-generation/business-plan-generation-page').then(
        (m) => m.BusinessPlanGenerationPage,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/communication',
    title: 'navigation.titles.communication',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-communication/show-communication').then(
        (m) => m.ShowCommunication,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/pitch-deck',
    title: 'navigation.titles.pitchDeck',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-pitch-deck/show-pitch-deck').then(
        (m) => m.ShowPitchDeck,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/legal-docs',
    title: 'navigation.titles.legalDocs',
    loadComponent: () =>
      import('./modules/dashboard/pages/legal-docs/legal-docs').then((m) => m.LegalDocsPage),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/advisor',
    title: 'navigation.titles.advisor',
    loadComponent: () =>
      import('./modules/dashboard/pages/advisor/advisor').then((m) => m.AdvisorPage),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/diagrams',
    title: 'navigation.titles.diagrams',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-diagrams/show-diagrams').then(
        (m) => m.ShowDiagramsComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/diagrams/generate',
    title: 'navigation.titles.diagramsGenerate',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-diagrams/diagram-generation/diagram-generation-page').then(
        (m) => m.DiagramGenerationPage,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/tests',
    title: 'navigation.titles.tests',
    loadComponent: () =>
      import('./modules/dashboard/pages/show-tests/show-tests').then((m) => m.ShowTestsComponent),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/development/create',
    title: 'navigation.titles.createDevelopment',
    loadComponent: () =>
      import('./modules/dashboard/pages/development/create-development/create-development').then(
        (m) => m.CreateDevelopmentComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/development',
    title: 'navigation.titles.development',
    loadComponent: () =>
      import('./modules/dashboard/pages/development/show-development/show-development').then(
        (m) => m.ShowDevelopment,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/ideploy',
    title: 'navigation.titles.ideploy',
    loadComponent: () =>
      import('./modules/dashboard/pages/ideploy-overview/ideploy-overview').then(
        (m) => m.IDeployOverview,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/deployments/create',
    title: 'navigation.titles.createDeployment',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/create-deployment/create-deployment').then(
        (m) => m.CreateDeployment,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/deployments',
    title: 'navigation.titles.deployments',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/deployment-list/deployment-list').then(
        (m) => m.DeploymentList,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/deployments/:id',
    title: 'navigation.titles.deploymentDetails',
    loadComponent: () =>
      import('./modules/dashboard/pages/deployment/deployment-details/deployment-details').then(
        (m) => m.DeploymentDetails,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },

  {
    path: 'project/profile',
    title: 'navigation.titles.profilePage',
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
    title: 'navigation.titles.finance',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-overview/finance-overview').then(
        (m) => m.FinanceOverviewComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard' },
  },
  {
    path: 'project/finance/products',
    title: 'navigation.titles.financeProducts',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'products' },
  },
  {
    path: 'project/finance/sales',
    title: 'navigation.titles.financeSales',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'salesObjectives' },
  },
  {
    path: 'project/finance/charges',
    title: 'navigation.titles.financeCharges',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'variableCharges' },
  },
  {
    path: 'project/finance/fixed-charges',
    title: 'navigation.titles.financeFixedCharges',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'fixedCharges' },
  },
  {
    path: 'project/finance/taxes',
    title: 'navigation.titles.financeTaxes',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'taxesParams' },
  },
  {
    path: 'project/finance/revenue',
    title: 'navigation.titles.financeRevenue',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'revenueParams' },
  },
  {
    path: 'project/finance/investments',
    title: 'navigation.titles.financeInvestments',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'investments' },
  },
  {
    path: 'project/finance/amortization',
    title: 'navigation.titles.financeAmortization',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'amortization' },
  },
  {
    path: 'project/finance/financing',
    title: 'navigation.titles.financeFinancing',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'financing' },
  },
  {
    path: 'project/finance/ratios-params',
    title: 'navigation.titles.financeRatiosParams',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'ratiosParams' },
  },
  {
    path: 'project/finance/exploitation',
    title: 'navigation.titles.financeExploitation',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'compteExploitation' },
  },
  {
    path: 'project/finance/bilan',
    title: 'navigation.titles.financeBilan',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'bilan' },
  },
  {
    path: 'project/finance/cashflow',
    title: 'navigation.titles.financeCashflow',
    loadComponent: () =>
      import('./modules/dashboard/pages/finance/finance-section-stub/finance-section-stub').then(
        (m) => m.FinanceSectionStubComponent,
      ),
    canActivate: [authGuard],
    data: { layout: 'dashboard', sectionKey: 'fluxTresorerie' },
  },
  {
    path: 'project/finance/ratios',
    title: 'navigation.titles.financeRatios',
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
    title: 'navigation.titles.createProject',
    loadComponent: () =>
      import('./modules/dashboard/pages/create-project/create-project').then(
        (m) => m.CreateProjectComponent,
      ),
    data: { layout: 'empty' },
  },
  // 404 Not Found route
  {
    path: 'not-found',
    title: 'navigation.titles.notFound',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent),
    data: { layout: 'empty' },
  },

  // Catch all unknown routes and redirect to 404
  { path: '**', redirectTo: 'not-found' },
];
