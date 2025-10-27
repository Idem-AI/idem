import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import * as invitationController from '../controllers/invitation.controller';

const router = Router();

/**
 * @openapi
 * /invitations:
 *   post:
 *     summary: Créer une invitation utilisateur
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - displayName
 *               - invitationType
 *             properties:
 *               email:
 *                 type: string
 *               displayName:
 *                 type: string
 *               invitationType:
 *                 type: string
 *                 enum: [team, project]
 *               teamId:
 *                 type: string
 *               teamRole:
 *                 type: string
 *                 enum: [admin, member, viewer]
 *               projectId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invitation créée avec succès
 *       400:
 *         description: Erreur lors de la création
 */
router.post('/', authenticate, invitationController.createInvitation);

/**
 * @openapi
 * /invitations/accept:
 *   post:
 *     summary: Accepter une invitation
 *     tags: [Invitations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invitationToken
 *               - temporaryPassword
 *               - newPassword
 *             properties:
 *               invitationToken:
 *                 type: string
 *               temporaryPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitation acceptée avec succès
 *       400:
 *         description: Erreur lors de l'acceptation
 */
router.post('/accept', invitationController.acceptInvitation);

/**
 * @openapi
 * /invitations/{token}:
 *   get:
 *     summary: Récupérer les détails d'une invitation par token
 *     tags: [Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de l'invitation
 *       404:
 *         description: Invitation non trouvée
 */
router.get('/:token', invitationController.getInvitationByToken);

/**
 * @openapi
 * /invitations/{token}/reject:
 *   post:
 *     summary: Rejeter une invitation
 *     tags: [Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation rejetée avec succès
 */
router.post('/:token/reject', invitationController.rejectInvitation);

/**
 * @openapi
 * /invitations/{invitationId}/resend:
 *   post:
 *     summary: Renvoyer une invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation renvoyée avec succès
 */
router.post('/:invitationId/resend', authenticate, invitationController.resendInvitation);

export default router;
