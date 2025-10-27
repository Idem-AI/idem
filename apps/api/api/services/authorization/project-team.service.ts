import {
  ProjectTeamModel,
  AddTeamToProjectDTO,
  UpdateProjectTeamRolesDTO,
  ProjectTeamRole,
  ROLE_PERMISSIONS,
  RolePermissions,
} from '@idem/shared-models';
import { FirestoreRepository } from '../../repository/FirestoreRepository';
import logger from '../../config/logger';
import { teamService } from './team.service';

const PROJECT_TEAMS_COLLECTION = 'project_teams';

class ProjectTeamService {
  private repository: FirestoreRepository<ProjectTeamModel>;

  constructor() {
    this.repository = new FirestoreRepository<ProjectTeamModel>();
  }

  /**
   * Ajouter une équipe à un projet
   */
  async addTeamToProject(
    projectId: string,
    addedBy: string,
    data: AddTeamToProjectDTO
  ): Promise<ProjectTeamModel> {
    logger.info(`Adding team ${data.teamId} to project ${projectId}`);

    // Vérifier que l'équipe existe
    const team = await teamService.getTeamById(data.teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Vérifier si l'association existe déjà
    const existing = await this.getProjectTeam(projectId, data.teamId);
    if (existing) {
      throw new Error('Team already associated with this project');
    }

    const projectTeam: Omit<ProjectTeamModel, 'id'> = {
      projectId,
      teamId: data.teamId,
      roles: data.roles,
      addedAt: new Date(),
      addedBy,
      isActive: true,
    };

    const created = await this.repository.create(projectTeam, PROJECT_TEAMS_COLLECTION);

    logger.info(`Team ${data.teamId} added to project ${projectId}`);
    return created;
  }

  /**
   * Récupérer l'association entre un projet et une équipe
   */
  async getProjectTeam(projectId: string, teamId: string): Promise<ProjectTeamModel | null> {
    const allAssociations = await this.repository.findAll(PROJECT_TEAMS_COLLECTION);
    return (
      allAssociations.find(
        (pt) => pt.projectId === projectId && pt.teamId === teamId && pt.isActive
      ) || null
    );
  }

  /**
   * Récupérer toutes les équipes d'un projet
   */
  async getProjectTeams(projectId: string): Promise<ProjectTeamModel[]> {
    const allAssociations = await this.repository.findAll(PROJECT_TEAMS_COLLECTION);
    return allAssociations.filter((pt) => pt.projectId === projectId && pt.isActive);
  }

  /**
   * Récupérer tous les projets d'une équipe
   */
  async getTeamProjects(teamId: string): Promise<ProjectTeamModel[]> {
    const allAssociations = await this.repository.findAll(PROJECT_TEAMS_COLLECTION);
    return allAssociations.filter((pt) => pt.teamId === teamId && pt.isActive);
  }

  /**
   * Mettre à jour les rôles d'une équipe dans un projet
   */
  async updateTeamRoles(
    projectId: string,
    updatedBy: string,
    data: UpdateProjectTeamRolesDTO
  ): Promise<ProjectTeamModel | null> {
    logger.info(`Updating roles for team ${data.teamId} in project ${projectId}`);

    const projectTeam = await this.getProjectTeam(projectId, data.teamId);
    if (!projectTeam || !projectTeam.id) {
      throw new Error('Project-Team association not found');
    }

    return await this.repository.update(
      projectTeam.id,
      { roles: data.roles },
      PROJECT_TEAMS_COLLECTION
    );
  }

  /**
   * Retirer une équipe d'un projet
   */
  async removeTeamFromProject(projectId: string, teamId: string): Promise<boolean> {
    logger.info(`Removing team ${teamId} from project ${projectId}`);

    const projectTeam = await this.getProjectTeam(projectId, teamId);
    if (!projectTeam || !projectTeam.id) {
      return false;
    }

    // Soft delete
    await this.repository.update(projectTeam.id, { isActive: false }, PROJECT_TEAMS_COLLECTION);

    return true;
  }

  /**
   * Vérifier si un utilisateur a une permission spécifique dans un projet
   */
  async userHasPermission(
    projectId: string,
    userId: string,
    permission: keyof RolePermissions
  ): Promise<boolean> {
    // Récupérer toutes les équipes du projet
    const projectTeams = await this.getProjectTeams(projectId);

    for (const pt of projectTeams) {
      // Vérifier si l'utilisateur est dans cette équipe
      const team = await teamService.getTeamById(pt.teamId);
      if (!team) continue;

      const member = team.members.find((m) => m.userId === userId && m.isActive);
      if (!member) continue;

      // Vérifier les permissions pour chaque rôle de l'équipe dans le projet
      for (const role of pt.roles) {
        const permissions = ROLE_PERMISSIONS[role];
        if (permissions[permission]) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Récupérer toutes les permissions d'un utilisateur dans un projet
   */
  async getUserPermissions(projectId: string, userId: string): Promise<RolePermissions> {
    const permissions: RolePermissions = {
      canEdit: false,
      canDelete: false,
      canInvite: false,
      canDeploy: false,
      canViewAnalytics: false,
      canManageTeams: false,
      canManageSettings: false,
    };

    const projectTeams = await this.getProjectTeams(projectId);

    for (const pt of projectTeams) {
      const team = await teamService.getTeamById(pt.teamId);
      if (!team) continue;

      const member = team.members.find((m) => m.userId === userId && m.isActive);
      if (!member) continue;

      // Fusionner les permissions de tous les rôles
      for (const role of pt.roles) {
        const rolePerms = ROLE_PERMISSIONS[role];
        Object.keys(rolePerms).forEach((key) => {
          const permKey = key as keyof RolePermissions;
          if (rolePerms[permKey]) {
            permissions[permKey] = true;
          }
        });
      }
    }

    return permissions;
  }

  /**
   * Vérifier si un utilisateur a accès à un projet
   */
  async userHasAccess(projectId: string, userId: string): Promise<boolean> {
    const projectTeams = await this.getProjectTeams(projectId);

    for (const pt of projectTeams) {
      const team = await teamService.getTeamById(pt.teamId);
      if (!team) continue;

      const member = team.members.find((m) => m.userId === userId && m.isActive);
      if (member) return true;
    }

    return false;
  }
}

export const projectTeamService = new ProjectTeamService();
