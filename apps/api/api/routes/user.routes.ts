import { Router } from "express";
import { profileController } from "../controllers/user.controller";
import { authRoutes } from "./auth.routes";

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
userRoutes.get("/profile", profileController);
