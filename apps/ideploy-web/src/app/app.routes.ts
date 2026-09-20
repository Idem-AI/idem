import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { instanceAdminGuard } from './shared/guards/instance-admin.guard';
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
    path: 'servers/new/cloud',
    loadComponent: () =>
      import('./modules/servers/server-provision/server-provision').then(
        (m) => m.ServerProvisionComponent
      ),
  },
  {
    path: 'servers/new',
    loadComponent: () =>
      import('./modules/servers/server-create/server-create').then((m) => m.ServerCreateComponent),
  },
  // After `servers/new`, so the literal segment is not captured as a uuid.
  {
    path: 'servers/:uuid',
    loadComponent: () =>
      import('./modules/servers/server-detail/server-detail').then((m) => m.ServerDetailComponent),
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
  // Instance administration. The guard hides the screen; the API refuses the
  // data regardless, which is what actually enforces this.
  {
    path: 'admin',
    canActivate: [instanceAdminGuard],
    loadComponent: () => import('./modules/admin/admin-page/admin-page').then((m) => m.AdminPageComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./modules/settings/settings-page/settings-page').then((m) => m.SettingsPageComponent),
  },
  {
    path: 'security/tokens',
    loadComponent: () =>
      import('./modules/security/api-tokens/api-tokens').then((m) => m.ApiTokensComponent),
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
  // The engine is part of the address: every database endpoint is keyed by
  // `{type}/{uuid}`, because each type lives in its own table.
  {
    path: 'databases/:type/:uuid',
    loadComponent: () =>
      import('./modules/databases/database-detail/database-detail').then(
        (m) => m.DatabaseDetailComponent
      ),
  },
  {
    path: 'services',
    loadComponent: () =>
      import('./modules/services/services-list/services-list').then((m) => m.ServicesListComponent),
  },
  {
    path: 'services/:uuid',
    loadComponent: () =>
      import('./modules/services/service-detail/service-detail').then((m) => m.ServiceDetailComponent),
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./modules/templates/templates-page/templates-page').then((m) => m.TemplatesPageComponent),
  },
  {
    path: 'templates/:name',
    loadComponent: () =>
      import('./modules/templates/template-detail/template-detail').then((m) => m.TemplateDetailComponent),
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
    path: 'applications/:uuid/security',
    loadComponent: () =>
      import('./modules/security/application-security/application-security').then(
        (m) => m.ApplicationSecurityComponent
      ),
  },
  {
    path: 'applications/:uuid/pipeline',
    loadComponent: () =>
      import('./modules/applications/application-pipeline/application-pipeline').then(
        (m) => m.ApplicationPipelineComponent
      ),
  },
  {
    path: 'applications/:uuid/pipeline/:executionUuid',
    loadComponent: () =>
      import('./modules/applications/pipeline-execution-detail/pipeline-execution-detail').then(
        (m) => m.PipelineExecutionDetailComponent
      ),
  },
  {
    path: 'applications/:uuid/insights',
    loadComponent: () =>
      import('./modules/applications/application-insights/application-insights').then(
        (m) => m.ApplicationInsightsComponent
      ),
  },
  {
    path: 'applications/:uuid/deployments',
    loadComponent: () =>
      import('./modules/applications/application-deployments/application-deployments').then(
        (m) => m.ApplicationDeploymentsComponent
      ),
  },
  // Interactive shells. `data.kind` tells the page what the uuid refers to,
  // so one component serves both without parsing the URL itself.
  {
    path: 'servers/:uuid/terminal',
    data: { kind: 'server' },
    loadComponent: () =>
      import('./modules/terminal/terminal-page/terminal-page').then((m) => m.TerminalPageComponent),
  },
  {
    path: 'applications/:uuid/terminal',
    data: { kind: 'application' },
    loadComponent: () =>
      import('./modules/terminal/terminal-page/terminal-page').then((m) => m.TerminalPageComponent),
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
  {
    path: 'new-project/guide/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./modules/projects/architecture-guide/architecture-guide').then((m) => m.ArchitectureGuideComponent),
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
