import { Request, Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { invitationService } from '../services/authorization/invitation.service';
import { CreateInvitationDTO, AcceptInvitationDTO } from '@idem/shared-models';
import logger from '../config/logger';

/**
 * Créer une invitation
 */
export async function createInvitation(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const data: CreateInvitationDTO = req.body;
    const invitation = await invitationService.createInvitation(userId, data);

    // Ne pas retourner le mot de passe temporaire dans la réponse
    const { temporaryPassword, ...safeInvitation } = invitation;

    res.status(201).json({ success: true, data: safeInvitation });
  } catch (error: any) {
    logger.error(`Error creating invitation: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'CREATE_INVITATION_ERROR', message: error.message } });
  }
}

/**
 * Accepter une invitation
 */
export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  try {
    const data: AcceptInvitationDTO = req.body;
    const result = await invitationService.acceptInvitation(data);

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`Error accepting invitation: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'ACCEPT_INVITATION_ERROR', message: error.message } });
  }
}

/**
 * Rejeter une invitation
 */
export async function rejectInvitation(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;
    await invitationService.rejectInvitation(token);

    res.status(200).json({ success: true, data: { message: 'Invitation rejected' } });
  } catch (error: any) {
    logger.error(`Error rejecting invitation: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'REJECT_INVITATION_ERROR', message: error.message } });
  }
}

/**
 * Renvoyer une invitation
 */
export async function resendInvitation(req: CustomRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
      return;
    }

    const { invitationId } = req.params;
    await invitationService.resendInvitation(invitationId);

    res.status(200).json({ success: true, data: { message: 'Invitation resent' } });
  } catch (error: any) {
    logger.error(`Error resending invitation: ${error.message}`);
    res
      .status(400)
      .json({ success: false, error: { code: 'RESEND_INVITATION_ERROR', message: error.message } });
  }
}

/**
 * Récupérer les détails d'une invitation par token (pour la page d'acceptation)
 */
export async function getInvitationByToken(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;
    const invitation = await invitationService.findInvitationByToken(token);

    if (!invitation) {
      res.status(404).json({
        success: false,
        error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation not found' },
      });
      return;
    }

    // Ne pas retourner le mot de passe temporaire
    const { temporaryPassword, ...safeInvitation } = invitation;

    res.status(200).json({ success: true, data: safeInvitation });
  } catch (error: any) {
    logger.error(`Error getting invitation: ${error.message}`);
    res
      .status(500)
      .json({ success: false, error: { code: 'GET_INVITATION_ERROR', message: error.message } });
  }
}
