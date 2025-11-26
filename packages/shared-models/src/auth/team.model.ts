/**
 * Rôle d'un membre dans une équipe
 */
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Membre d'une équipe
 */
export interface TeamMember {
  userId: string;
  email: string;
  displayName: string;
  role: TeamRole;
  addedAt: Date;
  addedBy: string; // userId qui a ajouté ce membre
  isActive: boolean;
}

/**
 * Modèle d'équipe
 */
export interface TeamModel {
  id?: string;
  name: string;
  description?: string;
  ownerId: string; // Créateur de la team
  members: TeamMember[];
  projectIds: string[]; // IDs des projets associés
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * DTO pour créer une équipe
 */
export interface CreateTeamDTO {
  name: string;
  description?: string;
  members?: Array<{
    email: string;
    displayName: string;
    role: TeamRole;
  }>;
}

/**
 * DTO pour ajouter un membre à une équipe
 */
export interface AddTeamMemberDTO {
  email: string;
  displayName: string;
  role: TeamRole;
}

/**
 * DTO pour mettre à jour le rôle d'un membre
 */
export interface UpdateTeamMemberRoleDTO {
  userId: string;
  role: TeamRole;
}
