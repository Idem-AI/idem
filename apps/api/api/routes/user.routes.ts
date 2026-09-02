import { Router } from 'express';
import {
  getOnboardingProfileController,
  profileController,
  saveOnboardingProfileController,
} from '../controllers/user.controller';
import { authenticate } from '../services/auth.service';
import { authRoutes } from './auth.routes';

export const userRoutes = Router();
/**
 * @openapi
 * /profile:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get authenticated user's profile
 *     description: Retrieves profile information for the user associated with the current session cookie.
 *     security:
 *       - cookieAuth: [] # Implies that a 'session' cookie is required
 *     responses:
 *       '200':
 *         description: User profile retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: string
 *                   description: User's unique ID.
 *                 email:
 *                   type: string
 *                   description: User's email address.
 *       '401':
 *         description: Unauthenticated. No session cookie, or invalid/expired session.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'Unauthenticated: No session cookie provided.'
 *                 error:
 *                   type: string
 *                   nullable: true
 *                   example: 'Error message details if applicable.'
 *       '500':
 *         description: Internal server error.
 */
userRoutes.get('/profile', profileController);

/**
 * @openapi
 * /auth/onboarding-profile:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get the authenticated user's onboarding survey profile
 *     description: >
 *       Returns the four survey answers and the resulting interface mode.
 *       `profile` is null when the survey has never been completed — which is
 *       the case for every account created before the feature shipped.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Profile retrieved (may be null).
 *       '401':
 *         description: Unauthenticated.
 *   put:
 *     tags:
 *       - Authentication
 *     summary: Save the onboarding survey answers
 *     description: All four answers are required; partial profiles are rejected.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Profile saved.
 *       '400':
 *         description: Missing or invalid answers.
 *       '401':
 *         description: Unauthenticated.
 */
userRoutes.get('/onboarding-profile', authenticate, getOnboardingProfileController);
userRoutes.put('/onboarding-profile', authenticate, saveOnboardingProfileController);
