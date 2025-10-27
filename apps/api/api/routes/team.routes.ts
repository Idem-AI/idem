import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import * as teamController from '../controllers/team.controller';

const router = Router();

/**
 * @openapi
 * /api/teams:
 *   post:
 *     summary: Créer une nouvelle équipe
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     displayName:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [owner, admin, member, viewer]
 *     responses:
 *       201:
 *         description: Équipe créée avec succès
 *       401:
 *         description: Non authentifié
 */
router.post('/', authenticate, teamController.createTeam);

/**
 * @openapi
 * /api/teams/my-teams:
 *   get:
 *     summary: Récupérer toutes les équipes de l'utilisateur
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des équipes
 *       401:
 *         description: Non authentifié
 */
router.get('/my-teams', authenticate, teamController.getUserTeams);

/**
 * @openapi
 * /api/teams/{teamId}:
 *   get:
 *     summary: Récupérer une équipe par ID
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de l'équipe
 *       404:
 *         description: Équipe non trouvée
 */
router.get('/:teamId', authenticate, teamController.getTeam);

/**
 * @openapi
 * /api/teams/{teamId}/members:
 *   post:
 *     summary: Ajouter un membre à une équipe
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - displayName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               displayName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, member, viewer]
 *     responses:
 *       200:
 *         description: Membre ajouté avec succès
 *       400:
 *         description: Erreur lors de l'ajout
 */
router.post('/:teamId/members', authenticate, teamController.addTeamMember);

/**
 * @openapi
 * /api/teams/{teamId}/members/role:
 *   put:
 *     summary: Mettre à jour le rôle d'un membre
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - role
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, member, viewer]
 *     responses:
 *       200:
 *         description: Rôle mis à jour avec succès
 */
router.put('/:teamId/members/role', authenticate, teamController.updateMemberRole);

/**
 * @openapi
 * /api/teams/{teamId}/members/{memberId}:
 *   delete:
 *     summary: Retirer un membre d'une équipe
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Membre retiré avec succès
 */
router.delete('/:teamId/members/:memberId', authenticate, teamController.removeMember);

export default router;
