import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import logger from '../config/logger';
import { teamService } from '../services/authorization/team.service';
import { CreateTeamDTO, AddTeamMemberDTO, UpdateTeamMemberRoleDTO } from '@idem/shared-models';

/**
 * Create a new team
 */
export const createTeamController = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const teamData: CreateTeamDTO = req.body;
    const team = await teamService.createTeam(userId, teamData);

    logger.info(`Team created successfully: ${team.id} by user: ${userId}`);
    res.status(201).json({ success: true, team });
  } catch (error: any) {
    logger.error(`Error creating team: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get team by ID
 */
export const getTeamController = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { teamId } = req.params;
    const team = await teamService.getTeamById(teamId as string);

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    // Check if user is a member of the team
    const isMember =
      team.ownerId === userId || team.members.some((m) => m.userId === userId && m.isActive);

    if (!isMember) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.status(200).json({ success: true, team });
  } catch (error: any) {
    logger.error(`Error getting team: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all teams for a user
 */
export const getUserTeamsController = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.uid;
    if (!requesterId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { userId } = req.params;

    // Users can only get their own teams unless they're an admin
    if (userId !== requesterId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const teams = await teamService.getUserTeams(userId);
    res.status(200).json({ success: true, teams });
  } catch (error: any) {
    logger.error(`Error getting user teams: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add member to team
 */
export const addTeamMemberController = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { teamId } = req.params;
    const memberData: AddTeamMemberDTO = req.body;

    const team = await teamService.addMember(teamId as string, userId, memberData);

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    logger.info(`Member ${memberData.email} added to team ${teamId} by user ${userId}`);
    res.status(200).json({ success: true, team });
  } catch (error: any) {
    logger.error(`Error adding team member: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update team member role
 */
export const updateTeamMemberRoleController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const requesterId = req.user?.uid;
    if (!requesterId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { teamId, userId } = req.params;
    const roleData: UpdateTeamMemberRoleDTO = req.body;

    const team = await teamService.updateMemberRole(teamId as string, userId as string, requesterId, roleData);

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    logger.info(`Member ${userId} role updated in team ${teamId} by user ${requesterId}`);
    res.status(200).json({ success: true, team });
  } catch (error: any) {
    logger.error(`Error updating team member role: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove member from team
 */
export const removeTeamMemberController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const requesterId = req.user?.uid;
    if (!requesterId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { teamId, userId } = req.params;

    const team = await teamService.removeMember(teamId as string, userId as string, requesterId);

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    logger.info(`Member ${userId} removed from team ${teamId} by user ${requesterId}`);
    res.status(200).json({ success: true, team });
  } catch (error: any) {
    logger.error(`Error removing team member: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete team
 */
export const deleteTeamController = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { teamId } = req.params;

    await teamService.deleteTeam(teamId as string, userId);

    logger.info(`Team ${teamId} deleted by user ${userId}`);
    res.status(200).json({ success: true, message: 'Team deleted successfully' });
  } catch (error: any) {
    logger.error(`Error deleting team: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: error.message });
  }
};
