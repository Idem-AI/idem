import { Routes } from '@angular/router';

export const routes: Routes = [
  // Public layout routes (Landing Page)
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    data: { layout: 'public' },
  },
  {
    path: 'deployment',
    loadComponent: () => import('./pages/deployment/deployment').then((m) => m.DeploymentPage),
    data: { layout: 'public' },
  },
  {
    path: 'african-market',
    loadComponent: () =>
      import('./pages/african-market-page/african-market-page').then((m) => m.AfricanMarketPage),
    data: { layout: 'public' },
  },
  {
    path: 'open-source',
    loadComponent: () =>
      import('./pages/open-source-page/open-source-page').then((m) => m.OpenSourcePage),
    data: { layout: 'public' },
  },
  {
    path: 'architecture',
    loadComponent: () =>
      import('./pages/architecture-page/architecture-page').then((m) => m.ArchitecturePage),
    data: { layout: 'public' },
  },
  {
    path: 'pricing',
    loadComponent: () => import('./pages/pricing-page/pricing-page').then((m) => m.PricingPage),
    data: { layout: 'public' },
  },
  {
    path: 'solutions',
    loadComponent: () =>
      import('./pages/solutions-page/solutions-page').then((m) => m.SolutionsPage),
    data: { layout: 'public' },
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about-page/about-page').then((m) => m.AboutPage),
    data: { layout: 'public' },
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact-page/contact-page').then((m) => m.ContactPage),
    data: { layout: 'public' },
  },
  {
    path: 'premium-beta',
    loadComponent: () =>
      import('./pages/premium-beta-access/premium-beta-access').then((m) => m.PremiumBetaAccess),
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
