import { Router } from 'express';
import {
  createTeamController,
  getTeamController,
  getUserTeamsController,
  addTeamMemberController,
  updateTeamMemberRoleController,
  removeTeamMemberController,
  deleteTeamController,
} from '../controllers/teams.controller';
import { authenticate } from '../services/auth.service';

export const teamsRoutes = Router();

/**
 * @openapi
 * /teams:
 *   post:
 *     tags:
 *       - Teams
 *     summary: Create a new team
 *     security:
 *       - cookieAuth: []
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
 *                       enum: [admin, member]
 *     responses:
 *       '201':
 *         description: Team created successfully
 *       '401':
 *         description: Unauthorized
 */
teamsRoutes.post('/', authenticate, createTeamController);

/**
 * @openapi
 * /teams/{teamId}:
 *   get:
 *     tags:
 *       - Teams
 *     summary: Get team by ID
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Team retrieved successfully
 *       '404':
 *         description: Team not found
 */
teamsRoutes.get('/:teamId', authenticate, getTeamController);

/**
 * @openapi
 * /teams/user/{userId}:
 *   get:
 *     tags:
 *       - Teams
 *     summary: Get all teams for a user
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Teams retrieved successfully
 */
teamsRoutes.get('/user/:userId', authenticate, getUserTeamsController);

/**
 * @openapi
 * /teams/{teamId}/members:
 *   post:
 *     tags:
 *       - Teams
 *     summary: Add member to team
 *     security:
 *       - cookieAuth: []
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
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               displayName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *     responses:
 *       '200':
 *         description: Member added successfully
 */
teamsRoutes.post('/:teamId/members', authenticate, addTeamMemberController);

/**
 * @openapi
 * /teams/{teamId}/members/{userId}:
 *   put:
 *     tags:
 *       - Teams
 *     summary: Update team member role
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [owner, admin, member]
 *     responses:
 *       '200':
 *         description: Member role updated successfully
 */
teamsRoutes.put('/:teamId/members/:userId', authenticate, updateTeamMemberRoleController);

/**
 * @openapi
 * /teams/{teamId}/members/{userId}:
 *   delete:
 *     tags:
 *       - Teams
 *     summary: Remove member from team
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Member removed successfully
 */
teamsRoutes.delete('/:teamId/members/:userId', authenticate, removeTeamMemberController);

/**
 * @openapi
 * /teams/{teamId}:
 *   delete:
 *     tags:
 *       - Teams
 *     summary: Delete team
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Team deleted successfully
 */
teamsRoutes.delete('/:teamId', authenticate, deleteTeamController);
