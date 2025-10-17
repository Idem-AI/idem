import { Octokit } from "@octokit/rest";
import logger from "../config/logger";
import { UserModel, GitHubIntegration } from "../models/userModel";
import { RepositoryFactory } from "../repository/RepositoryFactory";
import { IRepository } from "../repository/IRepository";
import { TargetModelType } from "../enums/targetModelType.enum";
import {
  GitHubOAuthRequest,
  GitHubOAuthResponse,
  PushToGitHubRequest,
  PushToGitHubResponse,
  GitHubRepositoryInfo,
  GitHubUserInfo,
} from "../dtos/github/github.dto";

export class GitHubService {
  private userRepository: IRepository<UserModel>;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.userRepository = RepositoryFactory.getRepository<UserModel>();
    this.clientId = process.env.GITHUB_CLIENT_ID || "";
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET || "";

    if (!this.clientId || !this.clientSecret) {
      logger.warn(
        "GitHub OAuth credentials not configured. GitHub integration will not work."
      );
    }

    logger.info("GitHubService initialized.");
  }

  /**
   * Get GitHub OAuth authorization URL
   */
  getAuthorizationUrl(userId: string): string {
    const scopes = ["repo", "user:email"].join(" ");
    const state = Buffer.from(
      JSON.stringify({ userId, timestamp: Date.now() })
    ).toString("base64");

    const authUrl =
      `https://github.com/login/oauth/authorize?` +
      `client_id=${this.clientId}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state}&` +
      `redirect_uri=${encodeURIComponent(
        process.env.GITHUB_REDIRECT_URI || ""
      )}`;

    logger.info(`Generated GitHub auth URL for userId: ${userId}`);
    return authUrl;
  }

  /**
   * Handle GitHub OAuth callback
   */
  async handleOAuthCallback(
    request: GitHubOAuthRequest
  ): Promise<GitHubOAuthResponse> {
    try {
      logger.info("Processing GitHub OAuth callback", {
        code: request.code?.substring(0, 10) + "...",
      });

      // Decode state to get userId
      const stateData = JSON.parse(
        Buffer.from(request.state || "", "base64").toString()
      );
      const userId = stateData.userId;

      if (!userId) {
        throw new Error("Invalid state parameter - userId not found");
      }

      // Exchange code for access token
      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code: request.code,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(`GitHub OAuth error: ${tokenData.error_description}`);
      }

      // Get user info from GitHub
      const octokit = new Octokit({ auth: tokenData.access_token });
      const { data: githubUser } = await octokit.rest.users.getAuthenticated();
      const { data: emails } =
        await octokit.rest.users.listEmailsForAuthenticatedUser();

      const primaryEmail =
        emails.find((email) => email.primary)?.email || githubUser.email;

      // Update user with GitHub integration
      const user = await this.userRepository.findById(
        userId,
        TargetModelType.USER
      );
      if (!user) {
        throw new Error("User not found");
      }

      const githubIntegration: GitHubIntegration = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        connectedAt: new Date(),
        scopes: tokenData.scope?.split(",") || ["repo", "user:email"],
      };

      user.githubIntegration = githubIntegration;
      await this.userRepository.update(userId, user, TargetModelType.USER);

      logger.info(
        `GitHub integration successful for userId: ${userId}, username: ${githubUser.login}`
      );

      return {
        success: true,
        message: "GitHub account connected successfully",
        user: {
          username: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          email: primaryEmail || "",
        },
      };
    } catch (error) {
      logger.error("GitHub OAuth callback failed", {
        error: error instanceof Error ? error.message : error,
      });
      return {
        success: false,
        message: `GitHub authentication failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Push files to GitHub repository
   */
  async pushToGitHub(
    userId: string,
    request: PushToGitHubRequest,
    files: Record<string, string>
  ): Promise<PushToGitHubResponse> {
    try {
      logger.info(
        `Starting GitHub push for userId: ${userId}, repository: ${request.repositoryName}`
      );

      // Get user with GitHub integration
      const user = await this.userRepository.findById(
        userId,
        TargetModelType.USER
      );
      if (!user || !user.githubIntegration) {
        throw new Error(
          "GitHub account not connected. Please connect your GitHub account first."
        );
      }

      const octokit = new Octokit({ auth: user.githubIntegration.accessToken });
      const filesToPush = request.files || files;

      // Check if repository exists, create if it doesn't
      let repository: any;
      try {
        const { data } = await octokit.rest.repos.get({
          owner: user.githubIntegration.username,
          repo: request.repositoryName,
        });
        repository = data;
        logger.info(`Repository ${request.repositoryName} already exists`);
      } catch (error: any) {
        if (error.status === 404) {
          // Create new repository
          logger.info(`Creating new repository: ${request.repositoryName}`);
          const { data } = await octokit.rest.repos.createForAuthenticatedUser({
            name: request.repositoryName,
            description:
              request.description || `Project generated from Idem API`,
            private: request.isPrivate || false,
            auto_init: true,
          });
          repository = data;
        } else {
          throw error;
        }
      }

      // Get the default branch (usually 'main' or 'master')
      const { data: branches } = await octokit.rest.repos.listBranches({
        owner: user.githubIntegration.username,
        repo: request.repositoryName,
      });
      const defaultBranch =
        branches.find((b) => b.name === repository.default_branch) ||
        branches[0];

      if (!defaultBranch) {
        throw new Error("No branches found in repository");
      }

      // Get the latest commit SHA
      const { data: latestCommit } = await octokit.rest.git.getRef({
        owner: user.githubIntegration.username,
        repo: request.repositoryName,
        ref: `heads/${defaultBranch.name}`,
      });

      // Create blobs for all files
      const fileBlobs: Array<{ path: string; sha: string; mode: string }> = [];
      const pushedFiles: string[] = [];

      for (const [filePath, content] of Object.entries(filesToPush)) {
        const normalizedPath = filePath.startsWith("/")
          ? filePath.substring(1)
          : filePath;

        const { data: blob } = await octokit.rest.git.createBlob({
          owner: user.githubIntegration.username,
          repo: request.repositoryName,
          content: Buffer.from(content).toString("base64"),
          encoding: "base64",
        });

        fileBlobs.push({
          path: normalizedPath,
          sha: blob.sha,
          mode: "100644",
        });
        pushedFiles.push(normalizedPath);
      }

      // Create new tree
      const { data: newTree } = await octokit.rest.git.createTree({
        owner: user.githubIntegration.username,
        repo: request.repositoryName,
        base_tree: latestCommit.object.sha,
        tree: fileBlobs.map((file) => ({
          path: file.path,
          mode: "100644" as any,
          type: "blob" as any,
          sha: file.sha,
        })),
      });

      // Create new commit
      const { data: newCommit } = await octokit.rest.git.createCommit({
        owner: user.githubIntegration.username,
        repo: request.repositoryName,
        message:
          request.commitMessage ||
          `Update project files - ${new Date().toISOString()}`,
        tree: newTree.sha,
        parents: [latestCommit.object.sha],
      });

      // Update reference
      await octokit.rest.git.updateRef({
        owner: user.githubIntegration.username,
        repo: request.repositoryName,
        ref: `heads/${defaultBranch.name}`,
        sha: newCommit.sha,
      });

      // Update user's last used timestamp
      user.githubIntegration.lastUsed = new Date();
      await this.userRepository.update(userId, user, TargetModelType.USER);

      logger.info(
        `Successfully pushed ${pushedFiles.length} files to ${repository.html_url}`
      );

      return {
        success: true,
        message: `Successfully pushed ${pushedFiles.length} files to GitHub`,
        repositoryUrl: repository.html_url,
        repositoryName: repository.name,
        owner: repository.owner.login,
        pushedFiles,
      };
    } catch (error) {
      logger.error("GitHub push failed", {
        error: error instanceof Error ? error.message : error,
        userId,
        repositoryName: request.repositoryName,
      });
      return {
        success: false,
        message: `Failed to push to GitHub: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Get user's GitHub repositories
   */
  async getUserRepositories(userId: string): Promise<GitHubRepositoryInfo[]> {
    try {
      const user = await this.userRepository.findById(userId, `users`);
      if (!user || !user.githubIntegration) {
        throw new Error("GitHub account not connected");
      }

      const octokit = new Octokit({ auth: user.githubIntegration.accessToken });
      const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser(
        {
          sort: "updated",
          per_page: 50,
        }
      );

      return repos.map((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || "",
        private: repo.private,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        createdAt: repo.created_at || "",
        updatedAt: repo.updated_at || "",
      }));
    } catch (error) {
      logger.error("Failed to get user repositories", {
        error: error instanceof Error ? error.message : error,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get GitHub user info
   */
  async getGitHubUserInfo(userId: string): Promise<GitHubUserInfo | null> {
    try {
      const user = await this.userRepository.findById(userId, `users`);
      if (!user || !user.githubIntegration) {
        return null;
      }

      const octokit = new Octokit({ auth: user.githubIntegration.accessToken });
      const { data: githubUser } = await octokit.rest.users.getAuthenticated();
      const { data: emails } =
        await octokit.rest.users.listEmailsForAuthenticatedUser();

      const primaryEmail =
        emails.find((email) => email.primary)?.email || githubUser.email;

      return {
        username: githubUser.login,
        email: primaryEmail || "",
        name: githubUser.name || "",
        avatarUrl: githubUser.avatar_url,
        publicRepos: githubUser.public_repos,
        followers: githubUser.followers,
        following: githubUser.following,
      };
    } catch (error) {
      logger.error("Failed to get GitHub user info", {
        error: error instanceof Error ? error.message : error,
        userId,
      });
      return null;
    }
  }

  /**
   * Disconnect GitHub account
   */
  async disconnectGitHub(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId, `users`);
      if (!user) {
        throw new Error("User not found");
      }

      user.githubIntegration = undefined;
      await this.userRepository.update(userId, user, TargetModelType.USER);

      logger.info(`GitHub account disconnected for userId: ${userId}`);
      return true;
    } catch (error) {
      logger.error("Failed to disconnect GitHub account", {
        error: error instanceof Error ? error.message : error,
        userId,
      });
      return false;
    }
  }
}
