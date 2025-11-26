import { useState, useEffect, useCallback } from 'react';
import { AuthClient } from '../core/AuthClient';
import { TeamModel, RolePermissions } from '@idem/shared-models';

export interface UseAuthReturn {
  teams: TeamModel[];
  loading: boolean;
  error: Error | null;
  refetchTeams: () => Promise<void>;
  createTeam: (name: string, description?: string) => Promise<TeamModel>;
  inviteUser: (email: string, displayName: string, teamId: string, role: string) => Promise<void>;
}

export function useAuth(authClient: AuthClient): UseAuthReturn {
  const [teams, setTeams] = useState<TeamModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await authClient.getMyTeams();
      setTeams(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [authClient]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = useCallback(
    async (name: string, description?: string) => {
      const team = await authClient.createTeam({ name, description });
      await fetchTeams();
      return team;
    },
    [authClient, fetchTeams]
  );

  const inviteUser = useCallback(
    async (email: string, displayName: string, teamId: string, role: string) => {
      await authClient.createInvitation({
        email,
        displayName,
        invitationType: 'team',
        teamId,
        teamRole: role as any,
      });
    },
    [authClient]
  );

  return {
    teams,
    loading,
    error,
    refetchTeams: fetchTeams,
    createTeam,
    inviteUser,
  };
}

export interface UseProjectPermissionsReturn {
  permissions: RolePermissions | null;
  loading: boolean;
  error: Error | null;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  refetch: () => Promise<void>;
}

export function useProjectPermissions(
  authClient: AuthClient,
  projectId: string | null
): UseProjectPermissionsReturn {
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!projectId) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await authClient.getProjectPermissions(projectId);
      setPermissions(data);
    } catch (err) {
      setError(err as Error);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, [authClient, projectId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permission: keyof RolePermissions) => {
      return permissions ? permissions[permission] : false;
    },
    [permissions]
  );

  return {
    permissions,
    loading,
    error,
    hasPermission,
    refetch: fetchPermissions,
  };
}
