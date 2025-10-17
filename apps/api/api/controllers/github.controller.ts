import { Request, Response } from "express";
import logger from "../config/logger";
import { DevelopmentService } from "../services/Development/development.service";
import { PromptService } from "../services/prompt.service";
import { CustomRequest } from "../interfaces/express.interface";
import {
  GitHubOAuthRequest,
  PushToGitHubRequest,
} from "../dtos/github/github.dto";

export class GitHubController {
  private developmentService: DevelopmentService;

  constructor() {
    const promptService = new PromptService();
    this.developmentService = new DevelopmentService(promptService);
    logger.info("GitHubController initialized.");
  }

  /**
   * Get GitHub authorization URL
   */
  async getAuthUrlController(req: CustomRequest, res: Response): Promise<void> {
    const userId = req.user?.uid;

    logger.info("Getting GitHub auth URL", { userId });

    try {
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const authUrl = this.developmentService.getGitHubAuthUrl(userId);

      logger.info("Successfully generated GitHub auth URL", { userId });

      res.status(200).json({
        success: true,
        authUrl,
        message: "GitHub authorization URL generated successfully",
      });
    } catch (error) {
      logger.error("Failed to generate GitHub auth URL", {
        error: error instanceof Error ? error.message : error,
        userId,
      });

      res.status(500).json({
        success: false,
        message: "Failed to generate GitHub authorization URL",
      });
    }
  }

  /**
   * Handle GitHub OAuth callback
   */
  async handleOAuthCallbackController(req: Request, res: Response): Promise<void> {
    const { code, state } = req.query as { code?: string; state?: string };

    logger.info("Handling GitHub OAuth callback", { code: code?.substring(0, 10) + "..." });

    try {
      if (!code) {
        res.status(400).json({
          success: false,
          message: "Authorization code is required",
        });
        return;
      }

      const result = await this.developmentService.handleGitHubOAuth({
        code,
        state,
      });

      if (result.success) {
        logger.info("GitHub OAuth successful", { username: result.user?.username });
        res.status(200).json(result);
      } else {
        logger.warn("GitHub OAuth failed", { message: result.message });
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("GitHub OAuth callback error", {
        error: error instanceof Error ? error.message : error,
      });

      res.status(500).json({
        success: false,
        message: "GitHub authentication failed",
      });
    }
  }

  /**
   * Push project to GitHub
   */
  async pushProjectToGitHubController(req: CustomRequest, res: Response): Promise<void> {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    const pushRequest = req.body as PushToGitHubRequest;

    logger.info("Pushing project to GitHub", { userId, projectId, repositoryName: pushRequest.repositoryName });

    try {
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          success: false,
          message: "Project ID is required",
        });
        return;
      }

      if (!pushRequest.repositoryName) {
        res.status(400).json({
          success: false,
          message: "Repository name is required",
        });
        return;
      }

      const result = await this.developmentService.pushProjectToGitHub(
        userId,
        projectId,
        pushRequest
      );

      if (result.success) {
        logger.info("Successfully pushed project to GitHub", {
          userId,
          projectId,
          repositoryUrl: result.repositoryUrl,
          pushedFiles: result.pushedFiles?.length,
        });
        res.status(200).json(result);
      } else {
        logger.warn("Failed to push project to GitHub", {
          userId,
          projectId,
          message: result.message,
        });
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error("Push to GitHub error", {
        error: error instanceof Error ? error.message : error,
        userId,
        projectId,
        repositoryName: pushRequest.repositoryName,
      });

      res.status(500).json({
        success: false,
        message: "Failed to push project to GitHub",
      });
    }
  }

  /**
   * Get user's GitHub repositories
   */
  async getUserRepositoriesController(req: CustomRequest, res: Response): Promise<void> {
    const userId = req.user?.uid;

    logger.info("Getting user GitHub repositories", { userId });

    try {
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const repositories = await this.developmentService.getUserGitHubRepositories(userId);

      logger.info("Successfully retrieved GitHub repositories", {
        userId,
        repositoryCount: repositories.length,
      });

      res.status(200).json({
        success: true,
        repositories,
        message: "GitHub repositories retrieved successfully",
      });
    } catch (error) {
      logger.error("Failed to get GitHub repositories", {
        error: error instanceof Error ? error.message : error,
        userId,
      });

      res.status(500).json({
        success: false,
        message: "Failed to retrieve GitHub repositories",
      });
    }
  }

  /**
   * Get GitHub user info
   */
  async getGitHubUserInfoController(req: CustomRequest, res: Response): Promise<void> {
    const userId = req.user?.uid;

    logger.info("Getting GitHub user info", { userId });

    try {
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const userInfo = await this.developmentService.getGitHubUserInfo(userId);

      if (userInfo) {
        logger.info("Successfully retrieved GitHub user info", {
          userId,
          githubUsername: userInfo.username,
        });

        res.status(200).json({
          success: true,
          userInfo,
          message: "GitHub user info retrieved successfully",
        });
      } else {
        logger.warn("GitHub account not connected", { userId });

        res.status(404).json({
          success: false,
          message: "GitHub account not connected",
        });
      }
    } catch (error) {
      logger.error("Failed to get GitHub user info", {
        error: error instanceof Error ? error.message : error,
        userId,
      });

      res.status(500).json({
        success: false,
        message: "Failed to retrieve GitHub user info",
      });
    }
  }

  /**
   * Disconnect GitHub account
   */
  async disconnectGitHubController(req: CustomRequest, res: Response): Promise<void> {
    const userId = req.user?.uid;

    logger.info("Disconnecting GitHub account", { userId });

    try {
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
        return;
      }

      const success = await this.developmentService.disconnectGitHub(userId);

      if (success) {
        logger.info("Successfully disconnected GitHub account", { userId });

        res.status(200).json({
          success: true,
          message: "GitHub account disconnected successfully",
        });
      } else {
        logger.warn("Failed to disconnect GitHub account", { userId });

        res.status(400).json({
          success: false,
          message: "Failed to disconnect GitHub account",
        });
      }
    } catch (error) {
      logger.error("Disconnect GitHub error", {
        error: error instanceof Error ? error.message : error,
        userId,
      });

      res.status(500).json({
        success: false,
        message: "Failed to disconnect GitHub account",
      });
    }
  }
}
