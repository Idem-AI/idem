import { Router } from 'express';
import {
  sessionLoginController,
  refreshTokenController,
  logoutController,
  logoutAllController,
  getRefreshTokensController,
  verifySessionController,
} from '../controllers/auth.controller';
import { authenticate } from '../services/auth.service';
import { verifyApiKey } from '../middleware/verifyApiKey';

export const authRoutes = Router();

/**
 * @openapi
 * /sessionLogin:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Create a session cookie for the user
 *     description: Exchanges a Firebase ID token for a session cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: objects
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase ID token obtained from client-side authentication.
 *     responses:
 *       '200':
 *         description: Session cookie created successfully. The session cookie is set in the HTTP response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Session cookie created successfully.
 *       '401':
 *         description: Unauthorized. Invalid ID token or error creating session cookie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: UNAUTHORIZED REQUEST!
 *                 error:
 *                   type: string
 *                   example: Error message details.
 *       '500':
 *         description: Internal server error.
 */
authRoutes.post('/sessionLogin', sessionLoginController);

/**
 * @openapi
 * /refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token using refresh token
 *     description: Uses a refresh token to generate a new session cookie.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token (can also be provided via cookie)
 *     responses:
 *       '200':
 *         description: Access token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Access token refreshed successfully.
 *                 sessionCookie:
 *                   type: string
 *       '400':
 *         description: Refresh token missing
 *       '401':
 *         description: Invalid or expired refresh token
 */
authRoutes.post('/refresh', refreshTokenController);

/**
 * @openapi
 * /logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     description: Revokes the current refresh token and clears cookies.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to revoke (can also be provided via cookie)
 *     responses:
 *       '200':
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully.
 *       '401':
 *         description: User not authenticated
 */
authRoutes.post('/logout', authenticate, logoutController);

/**
 * @openapi
 * /logout-all:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user from all devices
 *     description: Revokes all refresh tokens for the user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Logged out from all devices successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out from all devices successfully.
 *       '401':
 *         description: User not authenticated
 */
authRoutes.post('/logout-all', authenticate, logoutAllController);

/**
 * @openapi
 * /refresh-tokens:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get user's refresh tokens info
 *     description: Returns information about active refresh tokens (without the actual tokens).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Refresh tokens retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 refreshTokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastUsed:
 *                         type: string
 *                         format: date-time
 *                       deviceInfo:
 *                         type: string
 *                       ipAddress:
 *                         type: string
 *       '401':
 *         description: User not authenticated
 */
authRoutes.get('/refresh-tokens', authenticate, getRefreshTokensController);

/**
 * @openapi
 * /verify-session:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify session cookie and return user data
 *     description: Used by external services (like Laravel) to verify Firebase sessions
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionCookie:
 *                 type: string
 *                 description: Firebase session cookie (can also be sent via cookie header)
 *     responses:
 *       '200':
 *         description: Session verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   description: User profile data
 *       '401':
 *         description: Invalid or expired session
 *       '403':
 *         description: Invalid API key
 */
authRoutes.post('/verify-session', verifyApiKey, verifySessionController);
