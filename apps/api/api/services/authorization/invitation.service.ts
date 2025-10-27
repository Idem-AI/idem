import {
  InvitationModel,
  CreateInvitationDTO,
  AcceptInvitationDTO,
  InvitationEmailData,
} from '@idem/shared-models';
import { FirestoreRepository } from '../../repository/FirestoreRepository';
import logger from '../../config/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { teamService } from './team.service';
import admin from 'firebase-admin';

const INVITATIONS_COLLECTION = 'invitations';

class InvitationService {
  private repository: FirestoreRepository<InvitationModel>;

  constructor() {
    this.repository = new FirestoreRepository<InvitationModel>();
  }

  /**
   * Générer un mot de passe temporaire sécurisé
   */
  private generateTemporaryPassword(): string {
    return crypto.randomBytes(12).toString('base64').slice(0, 16);
  }

  /**
   * Générer un token d'invitation unique
   */
  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Créer une invitation
   */
  async createInvitation(invitedBy: string, data: CreateInvitationDTO): Promise<InvitationModel> {
    logger.info(`Creating invitation for ${data.email}`);

    // Vérifier si une invitation active existe déjà
    const existingInvitation = await this.findPendingInvitationByEmail(data.email);
    if (existingInvitation) {
      throw new Error('An active invitation already exists for this email');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const invitationToken = this.generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire dans 7 jours

    const invitation: Omit<InvitationModel, 'id'> = {
      email: data.email,
      displayName: data.displayName,
      invitedBy,
      invitationType: data.invitationType,
      teamId: data.teamId,
      teamRole: data.teamRole,
      projectId: data.projectId,
      temporaryPassword,
      passwordResetRequired: true,
      status: 'pending',
      createdAt: new Date(),
      expiresAt,
      invitationToken,
      emailSent: false,
      remindersSent: 0,
    };

    const created = await this.repository.create(invitation, INVITATIONS_COLLECTION);
    logger.info(`Invitation created: ${created.id}`);

    // Envoyer l'email d'invitation (async)
    this.sendInvitationEmail(created).catch((err) => {
      logger.error(`Failed to send invitation email: ${err.message}`);
    });

    return created;
  }

  /**
   * Envoyer l'email d'invitation
   */
  private async sendInvitationEmail(invitation: InvitationModel): Promise<void> {
    logger.info(`Sending invitation email to ${invitation.email}`);

    // TODO: Implémenter l'envoi d'email avec votre service d'email
    // Exemple avec SendGrid, Mailgun, ou AWS SES

    const invitationLink = `${process.env.APP_URL}/accept-invitation?token=${invitation.invitationToken}`;

    const emailData: InvitationEmailData = {
      recipientEmail: invitation.email,
      recipientName: invitation.displayName,
      inviterName: '', // À récupérer depuis le user
      temporaryPassword: invitation.temporaryPassword,
      invitationLink,
      expiresAt: invitation.expiresAt,
    };

    // Exemple de template d'email
    const emailContent = `
      Bonjour ${emailData.recipientName},
      
      Vous avez été invité à rejoindre Idem.
      
      Vos identifiants de connexion temporaires:
      Email: ${emailData.recipientEmail}
      Mot de passe temporaire: ${emailData.temporaryPassword}
      
      Cliquez sur le lien suivant pour accepter l'invitation:
      ${emailData.invitationLink}
      
      Cette invitation expire le ${emailData.expiresAt.toLocaleDateString()}.
      
      Cordialement,
      L'équipe Idem
    `;

    // TODO: Remplacer par votre service d'email
    logger.info(`Email content prepared for ${invitation.email}`);

    // Marquer l'email comme envoyé
    if (invitation.id) {
      await this.repository.update(
        invitation.id,
        { emailSent: true, emailSentAt: new Date() },
        INVITATIONS_COLLECTION
      );
    }
  }

  /**
   * Trouver une invitation en attente par email
   */
  async findPendingInvitationByEmail(email: string): Promise<InvitationModel | null> {
    const allInvitations = await this.repository.findAll(INVITATIONS_COLLECTION);
    return (
      allInvitations.find(
        (inv) => inv.email === email && inv.status === 'pending' && inv.expiresAt > new Date()
      ) || null
    );
  }

  /**
   * Trouver une invitation par token
   */
  async findInvitationByToken(token: string): Promise<InvitationModel | null> {
    const allInvitations = await this.repository.findAll(INVITATIONS_COLLECTION);
    return allInvitations.find((inv) => inv.invitationToken === token) || null;
  }

  /**
   * Accepter une invitation
   */
  async acceptInvitation(data: AcceptInvitationDTO): Promise<{ userId: string; teamId?: string }> {
    logger.info(`Accepting invitation with token: ${data.invitationToken}`);

    const invitation = await this.findInvitationByToken(data.invitationToken);
    if (!invitation || !invitation.id) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation has already been processed');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    if (invitation.temporaryPassword !== data.temporaryPassword) {
      throw new Error('Invalid temporary password');
    }

    // Créer l'utilisateur dans Firebase Auth
    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: invitation.email,
        password: data.newPassword,
        displayName: invitation.displayName,
        emailVerified: true,
      });
    } catch (error: any) {
      logger.error(`Error creating user in Firebase Auth: ${error.message}`);
      throw new Error('Failed to create user account');
    }

    // Si invitation à une équipe, activer le membre
    if (invitation.teamId) {
      await teamService.activateMember(invitation.teamId, invitation.email, userRecord.uid);
    }

    // Marquer l'invitation comme acceptée
    await this.repository.update(
      invitation.id,
      { status: 'accepted', acceptedAt: new Date() },
      INVITATIONS_COLLECTION
    );

    logger.info(`Invitation accepted for user: ${userRecord.uid}`);

    return {
      userId: userRecord.uid,
      teamId: invitation.teamId,
    };
  }

  /**
   * Rejeter une invitation
   */
  async rejectInvitation(token: string): Promise<void> {
    const invitation = await this.findInvitationByToken(token);
    if (!invitation || !invitation.id) {
      throw new Error('Invitation not found');
    }

    await this.repository.update(invitation.id, { status: 'rejected' }, INVITATIONS_COLLECTION);

    logger.info(`Invitation rejected: ${invitation.id}`);
  }

  /**
   * Renvoyer une invitation
   */
  async resendInvitation(invitationId: string): Promise<void> {
    const invitation = await this.repository.findById(invitationId, INVITATIONS_COLLECTION);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Can only resend pending invitations');
    }

    // Prolonger la date d'expiration
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await this.repository.update(
      invitationId,
      {
        expiresAt: newExpiresAt,
        remindersSent: invitation.remindersSent + 1,
        lastReminderAt: new Date(),
      },
      INVITATIONS_COLLECTION
    );

    // Renvoyer l'email
    await this.sendInvitationEmail(invitation);
  }

  /**
   * Nettoyer les invitations expirées
   */
  async cleanupExpiredInvitations(): Promise<number> {
    logger.info('Cleaning up expired invitations');

    const allInvitations = await this.repository.findAll(INVITATIONS_COLLECTION);
    const expiredInvitations = allInvitations.filter(
      (inv) => inv.status === 'pending' && inv.expiresAt < new Date()
    );

    for (const invitation of expiredInvitations) {
      if (invitation.id) {
        await this.repository.update(invitation.id, { status: 'expired' }, INVITATIONS_COLLECTION);
      }
    }

    logger.info(`Cleaned up ${expiredInvitations.length} expired invitations`);
    return expiredInvitations.length;
  }
}

export const invitationService = new InvitationService();
