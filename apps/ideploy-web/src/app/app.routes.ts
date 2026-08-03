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
  // Workspaces group the projects of one application onto a shared server and
  // network. Listed before `projects` because it is now the entry point.
  {
    path: 'workspaces',
    loadComponent: () =>
      import('./modules/workspaces/workspaces-list/workspaces-list').then(
        (m) => m.WorkspacesListComponent
      ),
  },
  {
    path: 'workspaces/new',
    loadComponent: () =>
      import('./modules/workspaces/workspace-create/workspace-create').then(
        (m) => m.WorkspaceCreateComponent
      ),
  },
  {
    path: 'workspaces/:uuid',
    loadComponent: () =>
      import('./modules/workspaces/workspace-detail/workspace-detail').then(
        (m) => m.WorkspaceDetailComponent
      ),
  },
  // `/projects` predates the Workspace vocabulary and named the same thing.
  // Redirected, not removed outright, so bookmarks and old links still land
  // somewhere real.
  { path: 'projects', redirectTo: 'workspaces' },
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
  { path: 'projects/:uuid', redirectTo: 'workspaces/:uuid' },
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
  // Public pricing page (no auth required).
  {
    path: 'pricing',
    loadComponent: () => import('./modules/landing/pricing/pricing').then((m) => m.PricingComponent),
  },
  // SSO callback from the central app after login.
  {
    path: 'auth/idem',
    loadComponent: () =>
      import('./modules/auth/sso-callback/sso-callback').then((m) => m.SsoCallbackComponent),
  },
  // Full-screen guarded flows (no sidebar), like Vercel's New Project.
  {
    path: 'new-project',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./modules/projects/new-project/new-project').then((m) => m.NewProjectComponent),
  },
  {
    path: 'new-project/import',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./modules/projects/import-config/import-config').then((m) => m.ImportConfigComponent),
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
