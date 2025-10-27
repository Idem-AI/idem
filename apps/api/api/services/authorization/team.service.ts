import {
  TeamModel,
  CreateTeamDTO,
  AddTeamMemberDTO,
  UpdateTeamMemberRoleDTO,
  TeamMember,
  TeamRole,
} from '@idem/shared-models';
import { FirestoreRepository } from '../../repository/FirestoreRepository';
import logger from '../../config/logger';
import { v4 as uuidv4 } from 'uuid';

const TEAMS_COLLECTION = 'teams';

class TeamService {
  private repository: FirestoreRepository<TeamModel>;

  constructor() {
    this.repository = new FirestoreRepository<TeamModel>();
  }

  /**
   * Créer une nouvelle équipe
   */
  async createTeam(ownerId: string, data: CreateTeamDTO): Promise<TeamModel> {
    logger.info(`Creating team: ${data.name} for owner: ${ownerId}`);

    const members: TeamMember[] = [
      {
        userId: ownerId,
        email: '', // À remplir depuis le user
        displayName: '', // À remplir depuis le user
        role: 'owner',
        addedAt: new Date(),
        addedBy: ownerId,
        isActive: true,
      },
    ];

    // Ajouter les membres initiaux si fournis
    if (data.members && data.members.length > 0) {
      for (const member of data.members) {
        members.push({
          userId: '', // Sera rempli lors de l'invitation
          email: member.email,
          displayName: member.displayName,
          role: member.role,
          addedAt: new Date(),
          addedBy: ownerId,
          isActive: false, // Inactif jusqu'à acceptation de l'invitation
        });
      }
    }

    const team: Omit<TeamModel, 'id'> = {
      name: data.name,
      description: data.description,
      ownerId,
      members,
      projectIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    const createdTeam = await this.repository.create(team, TEAMS_COLLECTION);
    logger.info(`Team created successfully: ${createdTeam.id}`);
    return createdTeam;
  }

  /**
   * Récupérer une équipe par ID
   */
  async getTeamById(teamId: string): Promise<TeamModel | null> {
    return await this.repository.findById(teamId, TEAMS_COLLECTION);
  }

  /**
   * Récupérer toutes les équipes d'un utilisateur
   */
  async getUserTeams(userId: string): Promise<TeamModel[]> {
    const allTeams = await this.repository.findAll(TEAMS_COLLECTION);
    return allTeams.filter(
      (team) =>
        team.ownerId === userId || team.members.some((m) => m.userId === userId && m.isActive)
    );
  }

  /**
   * Ajouter un membre à une équipe
   */
  async addMember(
    teamId: string,
    addedBy: string,
    data: AddTeamMemberDTO
  ): Promise<TeamModel | null> {
    logger.info(`Adding member ${data.email} to team ${teamId}`);

    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Vérifier les permissions
    const requester = team.members.find((m) => m.userId === addedBy);
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      throw new Error('Insufficient permissions to add members');
    }

    // Vérifier si le membre existe déjà
    const existingMember = team.members.find((m) => m.email === data.email);
    if (existingMember) {
      throw new Error('Member already exists in team');
    }

    const newMember: TeamMember = {
      userId: '', // Sera rempli lors de l'invitation
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      addedAt: new Date(),
      addedBy,
      isActive: false, // Inactif jusqu'à acceptation
    };

    team.members.push(newMember);
    team.updatedAt = new Date();

    return await this.repository.update(teamId, { members: team.members }, TEAMS_COLLECTION);
  }

  /**
   * Mettre à jour le rôle d'un membre
   */
  async updateMemberRole(
    teamId: string,
    updatedBy: string,
    data: UpdateTeamMemberRoleDTO
  ): Promise<TeamModel | null> {
    logger.info(`Updating role for user ${data.userId} in team ${teamId}`);

    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Vérifier les permissions
    const requester = team.members.find((m) => m.userId === updatedBy);
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      throw new Error('Insufficient permissions to update member roles');
    }

    // Ne pas permettre de changer le rôle du owner
    const targetMember = team.members.find((m) => m.userId === data.userId);
    if (!targetMember) {
      throw new Error('Member not found in team');
    }

    if (targetMember.role === 'owner') {
      throw new Error('Cannot change owner role');
    }

    // Mettre à jour le rôle
    team.members = team.members.map((m) =>
      m.userId === data.userId ? { ...m, role: data.role } : m
    );
    team.updatedAt = new Date();

    return await this.repository.update(teamId, { members: team.members }, TEAMS_COLLECTION);
  }

  /**
   * Retirer un membre d'une équipe
   */
  async removeMember(teamId: string, removedBy: string, userId: string): Promise<TeamModel | null> {
    logger.info(`Removing user ${userId} from team ${teamId}`);

    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Vérifier les permissions
    const requester = team.members.find((m) => m.userId === removedBy);
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      throw new Error('Insufficient permissions to remove members');
    }

    // Ne pas permettre de retirer le owner
    const targetMember = team.members.find((m) => m.userId === userId);
    if (!targetMember) {
      throw new Error('Member not found in team');
    }

    if (targetMember.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    team.members = team.members.filter((m) => m.userId !== userId);
    team.updatedAt = new Date();

    return await this.repository.update(teamId, { members: team.members }, TEAMS_COLLECTION);
  }

  /**
   * Vérifier si un utilisateur a un rôle spécifique dans une équipe
   */
  async hasRole(teamId: string, userId: string, roles: TeamRole[]): Promise<boolean> {
    const team = await this.getTeamById(teamId);
    if (!team) return false;

    const member = team.members.find((m) => m.userId === userId && m.isActive);
    return member ? roles.includes(member.role) : false;
  }

  /**
   * Activer un membre (après acceptation d'invitation)
   */
  async activateMember(teamId: string, email: string, userId: string): Promise<TeamModel | null> {
    logger.info(`Activating member ${email} in team ${teamId}`);

    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    team.members = team.members.map((m) =>
      m.email === email ? { ...m, userId, isActive: true } : m
    );
    team.updatedAt = new Date();

    return await this.repository.update(teamId, { members: team.members }, TEAMS_COLLECTION);
  }
}

export const teamService = new TeamService();
