import { Router } from "express";
import { GitHubController } from "../controllers/github.controller";
import { authenticate } from "../services/auth.service";

const router = Router();
const githubController = new GitHubController();

/**
 * @openapi
 * /github/auth/url:
 *   get:
 *     summary: Get GitHub OAuth authorization URL
 *     tags: [GitHub Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: GitHub authorization URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 authUrl:
 *                   type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Internal server error
 */
router.get(
  "/auth/url",
  authenticate,
  githubController.getAuthUrlController.bind(githubController)
);

/**
 * @openapi
 * /github/auth/callback:
 *   get:
 *     summary: Handle GitHub OAuth callback
 *     tags: [GitHub Integration]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: GitHub authorization code
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State parameter for security
 *     responses:
 *       200:
 *         description: GitHub authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GitHubOAuthResponse'
 *       400:
 *         description: Bad request or authentication failed
 *       500:
 *         description: Internal server error
 */
router.get(
  "/auth/callback",
  githubController.handleOAuthCallbackController.bind(githubController)
);

/**
 * @openapi
 * /github/projects/{projectId}/push:
 *   post:
 *     summary: Push project files to GitHub repository
 *     tags: [GitHub Integration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PushToGitHubRequest'
 *     responses:
 *       200:
 *         description: Project pushed to GitHub successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PushToGitHubResponse'
 *       400:
 *         description: Bad request or push failed
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Internal server error
 */
router.post(
  "/projects/:projectId/push",
  authenticate,
  githubController.pushProjectToGitHubController.bind(githubController)
);

/**
 * @openapi
 * /github/repositories:
 *   get:
 *     summary: Get user's GitHub repositories
 *     tags: [GitHub Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: GitHub repositories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 repositories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GitHubRepositoryInfo'
 *                 message:
 *                   type: string
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Internal server error
 */
router.get(
  "/repositories",
  authenticate,
  githubController.getUserRepositoriesController.bind(githubController)
);

/**
 * @openapi
 * /github/user:
 *   get:
 *     summary: Get GitHub user information
 *     tags: [GitHub Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: GitHub user info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 userInfo:
 *                   $ref: '#/components/schemas/GitHubUserInfo'
 *                 message:
 *                   type: string
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: GitHub account not connected
 *       500:
 *         description: Internal server error
 */
router.get(
  "/user",
  authenticate,
  githubController.getGitHubUserInfoController.bind(githubController)
);

/**
 * @openapi
 * /github/disconnect:
 *   delete:
 *     summary: Disconnect GitHub account
 *     tags: [GitHub Integration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: GitHub account disconnected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: User not authenticated
 *       400:
 *         description: Failed to disconnect GitHub account
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/disconnect",
  authenticate,
  githubController.disconnectGitHubController.bind(githubController)
);

export default router;
