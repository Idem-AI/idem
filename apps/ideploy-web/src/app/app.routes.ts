import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { ShellComponent } from './layouts/shell/shell';

// Guarded app routes (rendered inside the authenticated shell layout).
const children: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./modules/dashboard/dashboard/dashboard').then((m) => m.DashboardComponent),
  },
  {
    path: 'sources',
    loadComponent: () =>
      import('./modules/sources/sources-list/sources-list').then((m) => m.SourcesListComponent),
  },
  {
    path: 'destinations',
    loadComponent: () =>
      import('./modules/destinations/destinations-list/destinations-list').then(
        (m) => m.DestinationsListComponent
      ),
  },
  {
    path: 'storages',
    loadComponent: () =>
      import('./modules/storages/storages-list/storages-list').then((m) => m.StoragesListComponent),
  },
  {
    path: 'shared-variables',
    loadComponent: () =>
      import('./modules/shared-variables/shared-variables/shared-variables').then(
        (m) => m.SharedVariablesComponent
      ),
  },
  {
    path: 'servers',
    loadComponent: () =>
      import('./modules/servers/servers-list/servers-list').then((m) => m.ServersListComponent),
  },
  {
    path: 'servers/new',
    loadComponent: () =>
      import('./modules/servers/server-create/server-create').then((m) => m.ServerCreateComponent),
  },
  {
    path: 'team',
    loadComponent: () => import('./modules/team/team-page/team-page').then((m) => m.TeamPageComponent),
  },
  {
    path: 'subscription',
    loadComponent: () =>
      import('./modules/subscription/subscription-page/subscription-page').then(
        (m) => m.SubscriptionPageComponent
      ),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./modules/notifications/notifications/notifications').then((m) => m.NotificationsComponent),
  },
  {
    path: 'tags',
    loadComponent: () => import('./modules/tags/tags-list/tags-list').then((m) => m.TagsListComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./modules/settings/settings-page/settings-page').then((m) => m.SettingsPageComponent),
  },
  {
    path: 'security/keys',
    loadComponent: () =>
      import('./modules/security/private-keys/private-keys').then((m) => m.PrivateKeysComponent),
  },
  {
    path: 'projects',
    loadComponent: () =>
      import('./modules/projects/projects-list/projects-list').then((m) => m.ProjectsListComponent),
  },
  {
    path: 'applications',
    loadComponent: () =>
      import('./modules/applications/applications-list/applications-list').then(
        (m) => m.ApplicationsListComponent
      ),
  },
  {
    path: 'databases',
    loadComponent: () =>
      import('./modules/databases/databases-list/databases-list').then(
        (m) => m.DatabasesListComponent
      ),
  },
  {
    path: 'services',
    loadComponent: () =>
      import('./modules/services/services-list/services-list').then((m) => m.ServicesListComponent),
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./modules/templates/templates-page/templates-page').then((m) => m.TemplatesPageComponent),
  },
  {
    path: 'projects/:uuid',
    loadComponent: () =>
      import('./modules/projects/project-detail/project-detail').then((m) => m.ProjectDetailComponent),
  },
  {
    path: 'applications/:uuid',
    loadComponent: () =>
      import('./modules/applications/application-detail/application-detail').then(
        (m) => m.ApplicationDetailComponent
      ),
  },
  {
    path: 'deployments/:uuid',
    loadComponent: () =>
      import('./modules/deploy/deployment-logs/deployment-logs').then(
        (m) => m.DeploymentLogsComponent
      ),
  },
];

export const routes: Routes = [
  // Public iDeploy landing page (no auth required).
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./modules/landing/landing/landing').then((m) => m.LandingComponent),
  },
  // SSO callback from the central app after login.
  {
    path: 'auth/idem',
    loadComponent: () =>
      import('./modules/auth/sso-callback/sso-callback').then((m) => m.SsoCallbackComponent),
  },
  // Authenticated app — shell layout + guard.
  {
    path: '',
    component: ShellComponent,
    canActivateChild: [authGuard],
    children,
  },
  { path: '**', redirectTo: '' },
];
