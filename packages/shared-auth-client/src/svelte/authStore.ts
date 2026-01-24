import { writable, derived, get } from 'svelte/store';
import { AuthClient } from '../core/AuthClient';
import { TeamModel, RolePermissions } from '@idem/shared-models';

export interface AuthState {
  teams: TeamModel[];
  loading: boolean;
  error: Error | null;
}

export function createAuthStore(authClient: AuthClient) {
  const { subscribe, set, update } = writable<AuthState>({
    teams: [],
    loading: true,
    error: null,
  });

  async function fetchTeams() {
    update((state) => ({ ...state, loading: true, error: null }));
    try {
      const teams = await authClient.getMyTeams();
      update((state) => ({ ...state, teams, loading: false }));
    } catch (error) {
      update((state) => ({ ...state, error: error as Error, loading: false }));
    }
  }

  async function createTeam(name: string, description?: string) {
    const team = await authClient.createTeam({ name, description });
    await fetchTeams();
    return team;
  }

  async function inviteUser(email: string, displayName: string, teamId: string, role: string) {
    await authClient.createInvitation({
      email,
      displayName,
      invitationType: 'team',
      teamId,
      teamRole: role as any,
    });
  }

  // Initialize
  fetchTeams();

  return {
    subscribe,
    fetchTeams,
    createTeam,
    inviteUser,
  };
}

export interface ProjectPermissionsState {
  permissions: RolePermissions | null;
  loading: boolean;
  error: Error | null;
}

export function createProjectPermissionsStore(authClient: AuthClient, projectId: string | null) {
  const { subscribe, set, update } = writable<ProjectPermissionsState>({
    permissions: null,
    loading: true,
    error: null,
  });

  async function fetchPermissions() {
    if (!projectId) {
      set({ permissions: null, loading: false, error: null });
      return;
    }

    update((state) => ({ ...state, loading: true, error: null }));
    try {
      const permissions = await authClient.getProjectPermissions(projectId);
      update((state) => ({ ...state, permissions, loading: false }));
    } catch (error) {
      update((state) => ({ ...state, error: error as Error, loading: false, permissions: null }));
    }
  }

  // Initialize
  fetchPermissions();

  const hasPermission = derived({ subscribe }, ($state) => (permission: keyof RolePermissions) => {
    return $state.permissions ? $state.permissions[permission] : false;
  });

  return {
    subscribe,
    fetchPermissions,
    hasPermission,
  };
}
