/**
 * Team member interface
 */
export interface TeamMemberModel {
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  photoURL?: string;
  joinedAt?: Date;
}

/**
 * Team interface
 */
export interface TeamModel {
  id?: string;
  name: string;
  description?: string;
  createdBy: string;
  members: TeamMemberModel[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Project Team interface - represents a team assigned to a project
 */
export interface ProjectTeamModel {
  teamId: string;
  projectId: string;
  roles: ProjectRole[];
  team?: TeamModel;
}

/**
 * Project roles for teams
 */
export type ProjectRole =
  | 'project-owner'
  | 'project-admin'
  | 'developer'
  | 'designer'
  | 'viewer'
  | 'contributor';

/**
 * User permissions in a project
 */
export interface UserPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canManageTeams: boolean;
  canManageMembers: boolean;
  roles: ProjectRole[];
}

/**
 * User access check response
 */
export interface UserAccessResponse {
  hasAccess: boolean;
  permissions?: UserPermissions;
}

/**
 * DTO for creating a team
 */
export interface CreateTeamDTO {
  name: string;
  description?: string;
  members?: Array<{
    email: string;
    displayName: string;
    role: 'admin' | 'member' | 'viewer';
  }>;
}

/**
 * DTO for adding a member to a team
 */
export interface AddTeamMemberDTO {
  email: string;
  displayName: string;
  role: 'admin' | 'member' | 'viewer';
}

/**
 * DTO for adding a team to a project
 */
export interface AddTeamToProjectDTO {
  teamId: string;
  roles: ProjectRole[];
}
