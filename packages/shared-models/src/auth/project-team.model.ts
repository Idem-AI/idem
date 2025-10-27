/**
 * Rôles disponibles pour une équipe dans un projet
 */
export type ProjectTeamRole =
  | 'project-owner'
  | 'project-admin'
  | 'developer'
  | 'designer'
  | 'viewer'
  | 'contributor';

/**
 * Permissions associées aux rôles
 */
export interface RolePermissions {
  canEdit: boolean;
  canDelete: boolean;
  canInvite: boolean;
  canDeploy: boolean;
  canViewAnalytics: boolean;
  canManageTeams: boolean;
  canManageSettings: boolean;
}

/**
 * Mapping des rôles vers les permissions
 */
export const ROLE_PERMISSIONS: Record<ProjectTeamRole, RolePermissions> = {
  'project-owner': {
    canEdit: true,
    canDelete: true,
    canInvite: true,
    canDeploy: true,
    canViewAnalytics: true,
    canManageTeams: true,
    canManageSettings: true,
  },
  'project-admin': {
    canEdit: true,
    canDelete: false,
    canInvite: true,
    canDeploy: true,
    canViewAnalytics: true,
    canManageTeams: true,
    canManageSettings: true,
  },
  developer: {
    canEdit: true,
    canDelete: false,
    canInvite: false,
    canDeploy: true,
    canViewAnalytics: true,
    canManageTeams: false,
    canManageSettings: false,
  },
  designer: {
    canEdit: true,
    canDelete: false,
    canInvite: false,
    canDeploy: false,
    canViewAnalytics: true,
    canManageTeams: false,
    canManageSettings: false,
  },
  contributor: {
    canEdit: true,
    canDelete: false,
    canInvite: false,
    canDeploy: false,
    canViewAnalytics: false,
    canManageTeams: false,
    canManageSettings: false,
  },
  viewer: {
    canEdit: false,
    canDelete: false,
    canInvite: false,
    canDeploy: false,
    canViewAnalytics: true,
    canManageTeams: false,
    canManageSettings: false,
  },
};

/**
 * Association entre une équipe et un projet avec rôles
 */
export interface ProjectTeam {
  teamId: string;
  teamName: string;
  roles: ProjectTeamRole[];
  addedAt: Date;
  addedBy: string; // userId
}

/**
 * Modèle d'association projet-équipe
 */
export interface ProjectTeamModel {
  id?: string;
  projectId: string;
  teamId: string;
  roles: ProjectTeamRole[];
  addedAt: Date;
  addedBy: string;
  isActive: boolean;
}

/**
 * DTO pour ajouter une équipe à un projet
 */
export interface AddTeamToProjectDTO {
  teamId: string;
  roles: ProjectTeamRole[];
}

/**
 * DTO pour mettre à jour les rôles d'une équipe dans un projet
 */
export interface UpdateProjectTeamRolesDTO {
  teamId: string;
  roles: ProjectTeamRole[];
}
