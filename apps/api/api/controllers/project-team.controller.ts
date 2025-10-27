import { Request, Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { projectTeamService } from '../services/authorization/project-team.service';
import { AddTeamToProjectDTO, UpdateProjectTeamRolesDTO } from '@idem/shared-models';
import logger from '../config/logger';

/**
 * Ajouter une équipe à un projet
 */
export async function addTeamToProject(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res
        .status(401)
        .json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      return;
    }

    const { projectId } = req.params;
    const data: AddTeamToProjectDTO = req.body;

    const projectTeam = await projectTeamService.addTeamToProject(projectId, userId, data);
    res.status(201).json({ success: true, data: projectTeam });
  } catch (error: any) {
    logger.error(`Error adding team to project: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'ADD_TEAM_ERROR', message: error.message } });
  }
}

/**
 * Récupérer toutes les équipes d'un projet
 */
export async function getProjectTeams(req: CustomRequest, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;
    const teams = await projectTeamService.getProjectTeams(projectId);

    res.status(200).json({ success: true, data: teams });
  } catch (error: any) {
    logger.error(`Error getting project teams: ${error.message}`);
    res
      .status(500)
      .json({ success: false, error: { code: 'GET_PROJECT_TEAMS_ERROR', message: error.message } });
  }
}

/**
 * Mettre à jour les rôles d'une équipe dans un projet
 */
export async function updateTeamRoles(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res
        .status(401)
        .json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      return;
    }

    const { projectId } = req.params;
    const data: UpdateProjectTeamRolesDTO = req.body;

    const projectTeam = await projectTeamService.updateTeamRoles(projectId, userId, data);
    res.status(200).json({ success: true, data: projectTeam });
  } catch (error: any) {
    logger.error(`Error updating team roles: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'UPDATE_ROLES_ERROR', message: error.message } });
  }
}

/**
 * Retirer une équipe d'un projet
 */
export async function removeTeamFromProject(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res
        .status(401)
        .json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      return;
    }

    const { projectId, teamId } = req.params;

    const success = await projectTeamService.removeTeamFromProject(projectId, teamId);

    if (!success) {
      res
        .status(404)
        .json({
          success: false,
          error: { code: 'TEAM_NOT_FOUND', message: 'Team not found in project' },
        });
      return;
    }

    res.status(200).json({ success: true, data: { message: 'Team removed from project' } });
  } catch (error: any) {
    logger.error(`Error removing team from project: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'REMOVE_TEAM_ERROR', message: error.message } });
  }
}

/**
 * Récupérer les permissions d'un utilisateur dans un projet
 */
export async function getUserPermissions(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res
        .status(401)
        .json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      return;
    }

    const { projectId } = req.params;
    const permissions = await projectTeamService.getUserPermissions(projectId, userId);

    res.status(200).json({ success: true, data: permissions });
  } catch (error: any) {
    logger.error(`Error getting user permissions: ${error.message}`);
    res
      .status(500)
      .json({ success: false, error: { code: 'GET_PERMISSIONS_ERROR', message: error.message } });
  }
}

/**
 * Vérifier si un utilisateur a accès à un projet
 */
export async function checkUserAccess(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res
        .status(401)
        .json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      return;
    }

    const { projectId } = req.params;
    const hasAccess = await projectTeamService.userHasAccess(projectId, userId);

    res.status(200).json({ success: true, data: { hasAccess } });
  } catch (error: any) {
    logger.error(`Error checking user access: ${error.message}`);
    res
      .status(500)
      .json({ success: false, error: { code: 'CHECK_ACCESS_ERROR', message: error.message } });
  }
}
