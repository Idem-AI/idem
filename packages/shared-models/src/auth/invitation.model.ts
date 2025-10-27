import { TeamRole } from './team.model';

/**
 * Statut d'une invitation
 */
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/**
 * Type d'invitation
 */
export type InvitationType = 'team' | 'project';

/**
 * Modèle d'invitation utilisateur
 */
export interface InvitationModel {
  id?: string;
  email: string;
  displayName: string;
  invitedBy: string; // userId de l'inviteur
  invitationType: InvitationType;

  // Pour invitation à une team
  teamId?: string;
  teamRole?: TeamRole;

  // Pour invitation à un projet
  projectId?: string;

  // Credentials temporaires
  temporaryPassword: string;
  passwordResetRequired: boolean;

  // Statut
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;

  // Métadonnées
  invitationToken: string;
  emailSent: boolean;
  emailSentAt?: Date;
  remindersSent: number;
  lastReminderAt?: Date;
}

/**
 * DTO pour créer une invitation
 */
export interface CreateInvitationDTO {
  email: string;
  displayName: string;
  invitationType: InvitationType;
  teamId?: string;
  teamRole?: TeamRole;
  projectId?: string;
}

/**
 * DTO pour accepter une invitation
 */
export interface AcceptInvitationDTO {
  invitationToken: string;
  temporaryPassword: string;
  newPassword: string;
}

/**
 * Données pour l'email d'invitation
 */
export interface InvitationEmailData {
  recipientEmail: string;
  recipientName: string;
  inviterName: string;
  teamName?: string;
  projectName?: string;
  temporaryPassword: string;
  invitationLink: string;
  expiresAt: Date;
}
