import { ReactNode } from 'react';
import { useProjectPermissions, type RolePermissions } from '@idem/shared-auth-client';
import { authClient } from '../../lib/authClient';

interface ProjectPermissionGuardProps {
  projectId: string;
  permission: keyof RolePermissions;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProjectPermissionGuard({
  projectId,
  permission,
  children,
  fallback = null,
}: ProjectPermissionGuardProps) {
  const { hasPermission, loading } = useProjectPermissions(authClient, projectId);

  if (loading) {
    return null;
  }

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
