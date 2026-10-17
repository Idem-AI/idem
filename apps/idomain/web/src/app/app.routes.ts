import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

/**
 * L'accueil (recherche et prix) est public ; tout le reste demande la session IDEM. Une seule
 * coque pour toutes les pages : l'en-tête, et les onglets en bas sur téléphone.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home/home').then((m) => m.HomePage) },
      { path: 'checkout', canActivate: [authGuard], loadComponent: () => import('./pages/checkout/checkout').then((m) => m.CheckoutPage) },
      { path: 'orders', canActivate: [authGuard], loadComponent: () => import('./pages/orders/orders').then((m) => m.OrdersPage) },
      { path: 'orders/:id', canActivate: [authGuard], loadComponent: () => import('./pages/order/order').then((m) => m.OrderPage) },
      { path: 'domains', canActivate: [authGuard], loadComponent: () => import('./pages/domains/domains').then((m) => m.DomainsPage) },
      { path: 'domains/:id', canActivate: [authGuard], loadComponent: () => import('./pages/domain/domain').then((m) => m.DomainPage) },
      { path: 'connect', canActivate: [authGuard], loadComponent: () => import('./pages/connect/connect').then((m) => m.ConnectPage) },
      { path: 'connections/:id', canActivate: [authGuard], loadComponent: () => import('./pages/connection/connection').then((m) => m.ConnectionPage) },
      { path: 'contact', canActivate: [authGuard], loadComponent: () => import('./pages/contact/contact-page').then((m) => m.ContactPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
