import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ProjectPermissionsService } from '@idem/shared-auth-client';
import { AuthClientService } from '../services/auth-client.service';

export const projectEditGuard: CanActivateFn = async (route) => {
  const permissionsService = inject(ProjectPermissionsService);
  const authClientService = inject(AuthClientService);
  const router = inject(Router);

  // Initialize the service
  permissionsService.initialize(authClientService.getClient());

  const projectId = route.params['projectId'];

  if (!projectId) {
    router.navigate(['/']);
    return false;
  }

  await permissionsService.fetchPermissions(projectId);

  if (permissionsService.hasPermission('canEdit')) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

export const projectDeleteGuard: CanActivateFn = async (route) => {
  const permissionsService = inject(ProjectPermissionsService);
  const authClientService = inject(AuthClientService);
  const router = inject(Router);

  permissionsService.initialize(authClientService.getClient());

  const projectId = route.params['projectId'];

  if (!projectId) {
    router.navigate(['/']);
    return false;
  }

  await permissionsService.fetchPermissions(projectId);

  if (permissionsService.hasPermission('canDelete')) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};

export const projectDeployGuard: CanActivateFn = async (route) => {
  const permissionsService = inject(ProjectPermissionsService);
  const authClientService = inject(AuthClientService);
  const router = inject(Router);

  permissionsService.initialize(authClientService.getClient());

  const projectId = route.params['projectId'];

  if (!projectId) {
    router.navigate(['/']);
    return false;
  }

  await permissionsService.fetchPermissions(projectId);

  if (permissionsService.hasPermission('canDeploy')) {
    return true;
  }

  router.navigate(['/unauthorized']);
  return false;
};
