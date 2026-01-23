import { Request, Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { teamService } from '../services/authorization/team.service';
import { CreateTeamDTO, AddTeamMemberDTO, UpdateTeamMemberRoleDTO } from '@idem/shared-models';
import logger from '../config/logger';

/**
 * Créer une nouvelle équipe
 */
export async function createTeam(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const data: CreateTeamDTO = req.body;
    const team = await teamService.createTeam(userId, data);

    res.status(201).json({ success: true, data: team });
  } catch (error: any) {
    logger.error(`Error creating team: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'CREATE_TEAM_ERROR', message: error.message } });
  }
}

/**
 * Récupérer une équipe par ID
 */
export async function getTeam(req: CustomRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const team = await teamService.getTeamById(teamId as string);

    if (!team) {
      res
        .status(404)
        .json({ success: false, error: { code: 'TEAM_NOT_FOUND', message: 'Team not found' } });
      return;
    }

    res.status(200).json({ success: true, data: team });
  } catch (error: any) {
    logger.error(`Error getting team: ${error.message}`);
    res
      .status(500)
      .json({ success: false, error: { code: 'GET_TEAM_ERROR', message: error.message } });
  }
}

/**
 * Récupérer toutes les équipes de l'utilisateur
 */
export async function getUserTeams(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const teams = await teamService.getUserTeams(userId);
    res.status(200).json({ success: true, data: teams });
  } catch (error: any) {
    logger.error(`Error getting user teams: ${error.message}`);
    res
      .status(500)
      .json({ success: false, error: { code: 'GET_USER_TEAMS_ERROR', message: error.message } });
  }
}

/**
 * Ajouter un membre à une équipe
 */
export async function addTeamMember(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const { teamId } = req.params;
    const data: AddTeamMemberDTO = req.body;

    const team = await teamService.addMember(teamId as string, userId, data);
    res.status(200).json({ success: true, data: team });
  } catch (error: any) {
    logger.error(`Error adding team member: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'ADD_MEMBER_ERROR', message: error.message } });
  }
}

/**
 * Mettre à jour le rôle d'un membre
 */
export async function updateMemberRole(req: CustomRequest, res: Response): Promise<void> {
  try {
    const updatedBy = req.user?.uid;
    if (!updatedBy) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const { teamId } = req.params;
    const data: UpdateTeamMemberRoleDTO = req.body;

    const team = await teamService.updateMemberRole(teamId as string, data.userId, updatedBy, data);
    res.status(200).json({ success: true, data: team });
  } catch (error: any) {
    logger.error(`Error updating member role: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'UPDATE_ROLE_ERROR', message: error.message } });
  }
}

/**
 * Retirer un membre d'une équipe
 */
export async function removeMember(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const { teamId, memberId } = req.params;

    const team = await teamService.removeMember(teamId as string, userId, memberId as string);
    res.status(200).json({ success: true, data: team });
  } catch (error: any) {
    logger.error(`Error removing member: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'REMOVE_MEMBER_ERROR', message: error.message } });
  }
}
