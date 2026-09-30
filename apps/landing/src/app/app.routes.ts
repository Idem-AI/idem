import { Routes } from '@angular/router';

export const routes: Routes = [
  // Public layout routes (Landing Page)
  // L'accueil est servi à la racine de la langue (/fr/, /en/) : c'est son URL
  // canonique, sans redirection. /home reste accepté pour les anciens liens.
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    data: { layout: 'public', seo: 'home' },
  },
  {
    path: 'home',
    pathMatch: 'full',
    redirectTo: '',
  },
  {
    path: 'african-market',
    loadComponent: () =>
      import('./pages/african-market-page/african-market-page').then((m) => m.AfricanMarketPage),
    data: { layout: 'public', seo: 'african-market' },
  },
  {
    path: 'open-source',
    loadComponent: () =>
      import('./pages/open-source-page/open-source-page').then((m) => m.OpenSourcePage),
    data: { layout: 'public', seo: 'open-source' },
  },
  {
    path: 'pricing',
    loadComponent: () => import('./pages/pricing-page/pricing-page').then((m) => m.PricingPage),
    data: { layout: 'public', seo: 'pricing' },
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about-page/about-page').then((m) => m.AboutPage),
    data: { layout: 'public', seo: 'about' },
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact-page/contact-page').then((m) => m.ContactPage),
    data: { layout: 'public', seo: 'contact' },
  },
  {
    path: 'idev',
    loadComponent: () => import('./pages/idev-page/idev-page').then((m) => m.IdevPage),
    data: { layout: 'public', seo: 'icode' },
  },
  {
    path: 'simulator',
    loadComponent: () =>
      import('./pages/simulation-page/simulation-page').then((m) => m.SimulationPage),
    data: { layout: 'public', seo: 'simulator' },
  },
  {
    path: 'ideploy',
    loadComponent: () => import('./pages/ideploy-page/ideploy-page').then((m) => m.IdeployPage),
    data: { layout: 'public', seo: 'ideploy' },
  },
  {
    path: 'premium-beta',
    loadComponent: () =>
      import('./pages/premium-beta-access/premium-beta-access').then((m) => m.PremiumBetaAccess),
    data: { layout: 'empty', seo: 'premium-beta' },
  },

  // Policy pages
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./shared/components/privacy-policy/privacy-policy').then((m) => m.PrivacyPolicy),
    data: { layout: 'public', seo: 'privacy-policy' },
  },
  {
    path: 'terms-of-service',
    loadComponent: () =>
      import('./shared/components/terms-of-service/terms-of-service').then((m) => m.TermsOfService),
    data: { layout: 'public', seo: 'terms-of-service' },
  },
  {
    path: 'beta-policy',
    loadComponent: () =>
      import('./shared/components/beta-policy/beta-policy').then((m) => m.BetaPolicy),
    data: { layout: 'public', seo: 'beta-policy' },
  },
  {
    // Conditions propres à la simulation : les conditions générales ne disent
    // rien de ce qu'un indice de viabilité vaut, ni du trajet d'un business
    // plan importé. C'est ce que l'utilisateur accepte avant chaque exécution.
    path: 'simulation-terms',
    loadComponent: () =>
      import('./shared/components/simulation-terms/simulation-terms').then(
        (m) => m.SimulationTerms,
      ),
    data: { layout: 'public', seo: 'simulation-terms' },
  },

  // 404 Not Found route
  {
    path: 'not-found',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent),
    data: { layout: 'public', seo: 'not-found' },
  },

  // Catch all unknown routes and redirect to 404
  { path: '**', redirectTo: 'not-found' },
];
