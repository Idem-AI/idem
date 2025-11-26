import {
  UserModel,
  TeamModel,
  ProjectModel,
  CreateTeamDTO,
  AddTeamMemberDTO,
  CreateInvitationDTO,
  RolePermissions,
} from '@idem/shared-models';

export interface AuthClientConfig {
  apiBaseUrl: string;
  getAuthToken: () => Promise<string | null>;
}

export class AuthClient {
  private config: AuthClientConfig;

  constructor(config: AuthClientConfig) {
    this.config = config;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: any }> {
    const token = await this.config.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    return response.json();
  }

  // ============ TEAMS ============

  async createTeam(data: CreateTeamDTO): Promise<TeamModel> {
    const result = await this.fetch<TeamModel>('/api/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to create team');
    }

    return result.data;
  }

  async getMyTeams(): Promise<TeamModel[]> {
    const result = await this.fetch<TeamModel[]>('/api/teams/my-teams');

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to fetch teams');
    }

    return result.data;
  }

  async getTeam(teamId: string): Promise<TeamModel> {
    const result = await this.fetch<TeamModel>(`/api/teams/${teamId}`);

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to fetch team');
    }

    return result.data;
  }

  async addTeamMember(teamId: string, data: AddTeamMemberDTO): Promise<TeamModel> {
    const result = await this.fetch<TeamModel>(`/api/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to add team member');
    }

    return result.data;
  }

  async updateMemberRole(teamId: string, userId: string, role: string): Promise<TeamModel> {
    const result = await this.fetch<TeamModel>(`/api/teams/${teamId}/members/role`, {
      method: 'PUT',
      body: JSON.stringify({ userId, role }),
    });

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to update member role');
    }

    return result.data;
  }

  async removeMember(teamId: string, memberId: string): Promise<TeamModel> {
    const result = await this.fetch<TeamModel>(`/api/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
    });

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to remove member');
    }

    return result.data;
  }

  // ============ INVITATIONS ============

  async createInvitation(data: CreateInvitationDTO): Promise<any> {
    const result = await this.fetch('/api/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to create invitation');
    }

    return result.data;
  }

  async acceptInvitation(
    invitationToken: string,
    temporaryPassword: string,
    newPassword: string
  ): Promise<{ userId: string; teamId?: string }> {
    const result = await this.fetch<{ userId: string; teamId?: string }>(
      '/api/invitations/accept',
      {
        method: 'POST',
        body: JSON.stringify({ invitationToken, temporaryPassword, newPassword }),
      }
    );

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to accept invitation');
    }

    return result.data;
  }

  async getInvitationByToken(token: string): Promise<any> {
    const result = await this.fetch(`/api/invitations/${token}`);

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to fetch invitation');
    }

    return result.data;
  }

  async resendInvitation(invitationId: string): Promise<void> {
    const result = await this.fetch(`/api/invitations/${invitationId}/resend`, {
      method: 'POST',
    });

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to resend invitation');
    }
  }

  // ============ PROJECT PERMISSIONS ============

  async addTeamToProject(projectId: string, teamId: string, roles: string[]): Promise<any> {
    const result = await this.fetch(`/api/projects/${projectId}/teams`, {
      method: 'POST',
      body: JSON.stringify({ teamId, roles }),
    });

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to add team to project');
    }

    return result.data;
  }

  async getProjectTeams(projectId: string): Promise<any[]> {
    const result = await this.fetch<any[]>(`/api/projects/${projectId}/teams`);

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to fetch project teams');
    }

    return result.data;
  }

  async updateProjectTeamRoles(projectId: string, teamId: string, roles: string[]): Promise<any> {
    const result = await this.fetch(`/api/projects/${projectId}/teams/roles`, {
      method: 'PUT',
      body: JSON.stringify({ teamId, roles }),
    });

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to update team roles');
    }

    return result.data;
  }

  async removeTeamFromProject(projectId: string, teamId: string): Promise<void> {
    const result = await this.fetch(`/api/projects/${projectId}/teams/${teamId}`, {
      method: 'DELETE',
    });

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to remove team from project');
    }
  }

  async getProjectPermissions(projectId: string): Promise<RolePermissions> {
    const result = await this.fetch<RolePermissions>(`/api/projects/${projectId}/permissions`);

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to fetch permissions');
    }

    return result.data;
  }

  async checkProjectAccess(projectId: string): Promise<boolean> {
    const result = await this.fetch<{ hasAccess: boolean }>(`/api/projects/${projectId}/access`);

    if (!result.success || !result.data) {
      return false;
    }

    return result.data.hasAccess;
  }
}
