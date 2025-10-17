import logger from "../../config/logger";
import { GenericService } from "../common/generic.service";
import { PromptService } from "../prompt.service";
import {
  DevelopmentConfigsModel,
  LandingPageConfig,
} from "../../models/development.model";
import { ProjectModel } from "../../models/project.model";
import { GitHubService } from "../github.service";
import {
  PushToGitHubRequest,
  PushToGitHubResponse,
} from "../../dtos/github/github.dto";

export class DevelopmentService extends GenericService {
  private githubService: GitHubService;

  constructor(promptService: PromptService) {
    super(promptService);
    this.githubService = new GitHubService();
    logger.info("DevelopmentService initialized.");
  }

  /**
   * Generate development context for a project
   */
  async saveDevelopmentConfigs(
    userId: string,
    projectId: string,
    developmentConfigs: DevelopmentConfigsModel
  ): Promise<ProjectModel> {
    logger.info(
      `Saving development configs for projectId: ${projectId}, userId: ${userId}`
    );

    const project = await this.getProject(projectId, userId);
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId}`
      );
      throw new Error("Project not found");
    }

    if (!project.analysisResultModel.development) {
      logger.info(
        `Creating new development section for projectId: ${projectId}`
      );
      project.analysisResultModel.development = {
        configs: developmentConfigs,
      };
    } else {
      logger.info(
        `Updating existing development section for projectId: ${projectId}`
      );
    }

    // Adjust configs based on landingPageConfig in payload
    const lp = developmentConfigs.landingPageConfig;
    if (lp === LandingPageConfig.ONLY_LANDING) {
      // Landing-only: remove app-related configs
      logger.info(
        `landingPageConfig=ONLY_LANDING: removing frontend, backend and database configs for projectId: ${projectId}`
      );
      developmentConfigs.frontend = {} as any;
      developmentConfigs.backend = {} as any;
      developmentConfigs.database = {} as any;
    } else if (lp === LandingPageConfig.SEPARATE) {
      // Separate landing and app: keep all provided configs
      logger.info(
        `landingPageConfig=SEPARATE: keeping all provided configs (landing + app) for projectId: ${projectId}`
      );
    } else if (lp === LandingPageConfig.NONE) {
      // No landing page: keep app configs as provided
      logger.info(
        `landingPageConfig=NONE: keeping app configs (no landing) for projectId: ${projectId}`
      );
    } else {
      // INTEGRATED or undefined -> keep provided configs and default to INTEGRATED
      logger.info(
        `landingPageConfig=${
          lp ?? "INTEGRATED (default)"
        }: keeping provided configs for projectId: ${projectId}`
      );
      if (!developmentConfigs.landingPageConfig) {
        developmentConfigs.landingPageConfig = LandingPageConfig.INTEGRATED;
      }
    }

    project.analysisResultModel.development.configs = developmentConfigs;

    await this.projectRepository.update(
      projectId,
      project,
      `users/${userId}/projects`
    );
    logger.info(
      `Successfully saved development configs for projectId: ${projectId}`
    );
    return project;
  }

  async getDevelopmentConfigs(
    userId: string,
    projectId: string
  ): Promise<DevelopmentConfigsModel | null> {
    logger.info(
      `Fetching development configs for projectId: ${projectId}, userId: ${userId}`
    );

    const project = await this.getProject(projectId, userId);
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId}`
      );
      return null;
    }

    if (!project.analysisResultModel.development) {
      logger.info(`Development section not found for projectId: ${projectId}`);
      return null;
    }

    return project.analysisResultModel.development.configs;
  }

  /**
   * Push project files to GitHub repository
   */
  async pushProjectToGitHub(
    userId: string,
    projectId: string,
    request: PushToGitHubRequest
  ): Promise<PushToGitHubResponse> {
    logger.info(
      `Pushing project to GitHub for projectId: ${projectId}, userId: ${userId}, repository: ${request.repositoryName}`
    );

    try {
      // Get the project
      const project = await this.getProject(projectId, userId);
      if (!project) {
        logger.warn(
          `Project not found with ID: ${projectId} for user: ${userId}`
        );
        throw new Error("Project not found");
      }

      // Extract files from the request data (like the example you provided)
      let filesToPush: Record<string, string> = {};

      // If files are provided in the request, use them
      if (request.files && Object.keys(request.files).length > 0) {
        filesToPush = request.files;
        logger.info(
          `Using ${Object.keys(filesToPush).length} files from request`
        );
      } else {
        // If no files in request, check if project has development files
        // This could be from WebContainer or other sources
        if (project.analysisResultModel?.development) {
          // Check for WebContainer files in development array
          const development = project.analysisResultModel.development;

          // If development is an array (WebContainerModel[])
          if (Array.isArray(development)) {
            const webContainer = development.find(
              (wc) => wc.metadata?.fileContents
            );
            if (webContainer?.metadata?.fileContents) {
              filesToPush = webContainer.metadata.fileContents;
              logger.info(
                `Using ${
                  Object.keys(filesToPush).length
                } files from WebContainer`
              );
            }
          }
          // If development has configs with files
          else if (development.configs) {
            // You might want to generate files based on configs here
            logger.info(
              "Development configs found but no direct files available"
            );
          }
        }

        // If still no files, create a basic project structure
        if (Object.keys(filesToPush).length === 0) {
          filesToPush = this.generateBasicProjectStructure(project);
          logger.info(
            `Generated basic project structure with ${
              Object.keys(filesToPush).length
            } files`
          );
        }
      }

      // Use the GitHub service to push files
      const result = await this.githubService.pushToGitHub(
        userId,
        request,
        filesToPush
      );

      // If successful, update project with GitHub URL
      if (result.success && result.repositoryUrl) {
        // Update WebContainer or project with GitHub info
        if (
          project.analysisResultModel?.development &&
          Array.isArray(project.analysisResultModel.development)
        ) {
          const webContainer = project.analysisResultModel.development.find(
            (wc) => wc.metadata?.fileContents
          );
          if (webContainer?.metadata) {
            webContainer.metadata.githubUrl = result.repositoryUrl;
            webContainer.metadata.lastPushedAt = new Date().toISOString();
          }
        }

        await this.projectRepository.update(
          projectId,
          project,
          `users/${userId}/projects`
        );

        logger.info(
          `Successfully updated project with GitHub URL: ${result.repositoryUrl}`
        );
      }

      logger.info(
        `GitHub push completed for projectId: ${projectId}, success: ${result.success}`
      );

      return result;
    } catch (error) {
      logger.error("Failed to push project to GitHub", {
        error: error instanceof Error ? error.message : error,
        userId,
        projectId,
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
   * Generate basic project structure when no files are available
   */
  private generateBasicProjectStructure(
    project: ProjectModel
  ): Record<string, string> {
    const files: Record<string, string> = {};

    // Create README.md
    files["README.md"] = `# ${project.name || "Project"}

${project.description || "A project generated from Idem API"}

## Description
${project.description || "No description available"}

## Getting Started
This project was generated automatically. Please refer to the documentation for setup instructions.

## Generated on
${new Date().toISOString()}
`;

    // Create package.json if it's a web project
    if (project.analysisResultModel?.development?.configs?.frontend) {
      const frontend = project.analysisResultModel.development.configs.frontend;
      files["package.json"] = JSON.stringify(
        {
          name:
            project.name?.toLowerCase().replace(/\s+/g, "-") || "idem-project",
          version: "1.0.0",
          description: project.description || "Generated project",
          main: "index.js",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {},
          devDependencies: {
            vite: "^4.5.0",
          },
        },
        null,
        2
      );
    }

    // Create basic HTML file
    files["index.html"] = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name || "Project"}</title>
</head>
<body>
    <h1>${project.name || "Welcome to your project"}</h1>
    <p>${project.description || "This project was generated from Idem API"}</p>
</body>
</html>`;

    return files;
  }

  /**
   * Get GitHub authorization URL for user
   */
  getGitHubAuthUrl(userId: string): string {
    logger.info(`Generating GitHub auth URL for userId: ${userId}`);
    return this.githubService.getAuthorizationUrl(userId);
  }

  /**
   * Handle GitHub OAuth callback
   */
  async handleGitHubOAuth(request: { code: string; state?: string }) {
    logger.info("Handling GitHub OAuth callback");
    return await this.githubService.handleOAuthCallback(request);
  }

  /**
   * Get user's GitHub repositories
   */
  async getUserGitHubRepositories(userId: string) {
    logger.info(`Getting GitHub repositories for userId: ${userId}`);
    return await this.githubService.getUserRepositories(userId);
  }

  /**
   * Get GitHub user info
   */
  async getGitHubUserInfo(userId: string) {
    logger.info(`Getting GitHub user info for userId: ${userId}`);
    return await this.githubService.getGitHubUserInfo(userId);
  }

  /**
   * Disconnect GitHub account
   */
  async disconnectGitHub(userId: string): Promise<boolean> {
    logger.info(`Disconnecting GitHub account for userId: ${userId}`);
    return await this.githubService.disconnectGitHub(userId);
  }
}
