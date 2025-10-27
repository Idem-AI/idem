import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import * as projectTeamController from '../controllers/project-team.controller';

const router = Router();

/**
 * @openapi
 * /api/projects/{projectId}/teams:
 *   post:
 *     summary: Ajouter une équipe à un projet
 *     tags: [Project Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *               - teamId
 *               - roles
 *             properties:
 *               teamId:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [project-owner, project-admin, developer, designer, viewer, contributor]
 *     responses:
 *       201:
 *         description: Équipe ajoutée au projet
 */
router.post('/:projectId/teams', authenticate, projectTeamController.addTeamToProject);

/**
 * @openapi
 * /api/projects/{projectId}/teams:
 *   get:
 *     summary: Récupérer toutes les équipes d'un projet
 *     tags: [Project Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liste des équipes du projet
 */
router.get('/:projectId/teams', authenticate, projectTeamController.getProjectTeams);

/**
 * @openapi
 * /api/projects/{projectId}/teams/roles:
 *   put:
 *     summary: Mettre à jour les rôles d'une équipe dans un projet
 *     tags: [Project Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *               - teamId
 *               - roles
 *             properties:
 *               teamId:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Rôles mis à jour
 */
router.put('/:projectId/teams/roles', authenticate, projectTeamController.updateTeamRoles);

/**
 * @openapi
 * /api/projects/{projectId}/teams/{teamId}:
 *   delete:
 *     summary: Retirer une équipe d'un projet
 *     tags: [Project Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Équipe retirée du projet
 */
router.delete(
  '/:projectId/teams/:teamId',
  authenticate,
  projectTeamController.removeTeamFromProject
);

/**
 * @openapi
 * /api/projects/{projectId}/permissions:
 *   get:
 *     summary: Récupérer les permissions de l'utilisateur dans un projet
 *     tags: [Project Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permissions de l'utilisateur
 */
router.get('/:projectId/permissions', authenticate, projectTeamController.getUserPermissions);

/**
 * @openapi
 * /api/projects/{projectId}/access:
 *   get:
 *     summary: Vérifier si l'utilisateur a accès au projet
 *     tags: [Project Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut d'accès
 */
router.get('/:projectId/access', authenticate, projectTeamController.checkUserAccess);

export default router;
