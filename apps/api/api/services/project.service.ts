import { ProjectModel } from '../models/project.model';
import { IRepository } from '../repository/IRepository';
import { RepositoryFactory } from '../repository/RepositoryFactory';
import logger from '../config/logger';
import JSZip from 'jszip';
import fsExtra from 'fs-extra';
import path from 'path';
import { storageService } from './storage.service';
import { v4 as uuidv4 } from 'uuid';

class ProjectService {
  private projectRepository: IRepository<ProjectModel>;

  constructor() {
    // Use repository with explicit paths
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
  }

  async createUserProject(
    userId: string,
    projectData: Omit<ProjectModel, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
  ): Promise<ProjectModel> {
    if (!userId) {
      logger.error('User ID is required to create a project.');
      throw new Error('User ID is required.');
    }

    try {
      // Generate the final project ID using UUID
      const projectId = uuidv4();

      logger.info(`Creating project for user ${userId}`, {
        userId,
        projectId,
        hasLogoVariations: !!projectData.analysisResultModel?.branding?.logo?.variations,
      });

      let projectToCreate: Omit<ProjectModel, 'id' | 'createdAt' | 'updatedAt'> = {
        ...projectData,
        userId: userId,
      };

      // Check if there are logo variations to upload
      const logoVariations = projectData.analysisResultModel?.branding?.logo?.variations;
      const primaryLogo = projectData.analysisResultModel?.branding?.logo?.svg;
      if (
        logoVariations &&
        (logoVariations.iconOnly?.lightBackground ||
          logoVariations.iconOnly?.darkBackground ||
          logoVariations.iconOnly?.monochrome ||
          logoVariations.withText?.lightBackground ||
          logoVariations.withText?.darkBackground ||
          logoVariations.withText?.monochrome ||
          primaryLogo)
      ) {
        logger.info(`Uploading logo variations to Firebase Storage`, {
          userId,
          projectId,
          variations: Object.keys(logoVariations),
        });

        try {
          // Upload logo variations to Firebase Storage
          const iconSvg = projectData.analysisResultModel?.branding?.logo?.iconSvg;
          const uploadResults = await storageService.uploadLogoVariations(
            primaryLogo,
            iconSvg,
            logoVariations,
            userId,
            projectId
          );

          // Replace SVG content with download URLs
          const updatedVariations = {
            withText: {
              lightBackground: uploadResults.withText?.lightBackground?.downloadURL,
              darkBackground: uploadResults.withText?.darkBackground?.downloadURL,
              monochrome: uploadResults.withText?.monochrome?.downloadURL,
            },
            iconOnly: {
              lightBackground: uploadResults.iconOnly?.lightBackground?.downloadURL,
              darkBackground: uploadResults.iconOnly?.darkBackground?.downloadURL,
              monochrome: uploadResults.iconOnly?.monochrome?.downloadURL,
            },
          };

          // Update the project data with the URLs
          projectToCreate = {
            ...projectToCreate,
            analysisResultModel: {
              ...projectToCreate.analysisResultModel,
              branding: {
                ...projectToCreate.analysisResultModel?.branding,
                logo: {
                  ...projectToCreate.analysisResultModel?.branding?.logo,
                  svg: uploadResults.primaryLogo!.downloadURL,
                  iconSvg: uploadResults.iconSvg?.downloadURL,
                  variations: updatedVariations,
                },
              },
            },
          };

          logger.info(`Logo variations uploaded successfully`, {
            userId,
            projectId,
            uploadedUrls: {
              withText: updatedVariations.withText,
              iconOnly: updatedVariations.iconOnly,
            },
          });
        } catch (uploadError: any) {
          logger.error(`Failed to upload logo variations`, {
            userId,
            projectId,
            error: uploadError.message,
            stack: uploadError.stack,
          });
          // Continue with project creation even if logo upload fails
          logger.warn(`Continuing project creation without uploaded logo variations`);
        }
      } else {
        logger.info(`No logo variations to upload for project`, {
          userId,
          projectId,
        });
      }

      // Create the project in the database with the generated UUID as document ID
      const newProject = await this.projectRepository.create(
        projectToCreate,
        `users/${userId}/projects`,
        projectId
      );

      if (!newProject || !newProject.id) {
        throw new Error('Project creation failed or project ID is missing.');
      }

      logger.info(`Project created successfully`, {
        userId,
        projectId: newProject.id,
        hasUploadedLogos: !!(logoVariations && Object.keys(logoVariations).length > 0),
      });

      return newProject;
    } catch (error: any) {
      logger.error(`Error creating project in service: ${error.message}`, {
        userId,
        stack: error.stack,
        details: error,
      });
      throw error;
    }
  }

  async getAllUserProjects(userId: string): Promise<ProjectModel[]> {
    if (!userId) {
      logger.warn('User ID is required to get projects. Returning empty array.');
      return [];
    }

    try {
      const projects = await this.projectRepository.findAll(`users/${userId}/projects`);
      logger.info(`Projects fetched for user ${userId}: ${projects.length}`);
      return projects;
    } catch (error: any) {
      logger.error(`Error fetching projects for user ${userId} in service: ${error.message}`, {
        stack: error.stack,
        details: error,
      });
      throw error;
    }
  }

  async getUserProjectById(userId: string, projectId: string): Promise<ProjectModel | null> {
    if (!userId || !projectId) {
      logger.error('User ID and Project ID are required to fetch project.');
      return null;
    }

    try {
      const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
      if (!project) {
        logger.info(`Project ${projectId} not found for user ${userId} via repository`);
        return null;
      }
      logger.info(`Project data fetched for ${projectId}:`, project);
      return project;
    } catch (error: any) {
      logger.error(
        `Error fetching project ${projectId} for user ${userId} in service: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  async deleteUserProject(userId: string, projectId: string): Promise<void> {
    if (!userId || !projectId) {
      logger.error('User ID and Project ID are required for deletion.');
      throw new Error('User ID and Project ID are required.');
    }

    try {
      const success = await this.projectRepository.delete(projectId, `users/${userId}/projects`);
      if (success) {
        logger.info(`Project ${projectId} deleted successfully for user ${userId} via repository`);
      } else {
        logger.warn(
          `Project ${projectId} not found for deletion or delete failed for user ${userId} via repository`
        );
      }
    } catch (error: any) {
      logger.error(
        `Error deleting project ${projectId} for user ${userId} in service: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  async editUserProject(
    userId: string,
    projectId: string,
    updatedData: Partial<Omit<ProjectModel, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
  ): Promise<void> {
    if (!userId || !projectId) {
      logger.error('User ID and Project ID are required for update.');
      throw new Error('User ID and Project ID are required.');
    }

    try {
      const updatedProject = await this.projectRepository.update(
        projectId,
        updatedData,
        `users/${userId}/projects`
      );
      if (updatedProject) {
        logger.info(`Project ${projectId} updated successfully for user ${userId} via repository`);
      } else {
        logger.warn(
          `Project ${projectId} not found for update or update failed for user ${userId} via repository`
        );
        throw new Error(`Project ${projectId} not found for update or update failed.`);
      }
    } catch (error: any) {
      logger.error(
        `Error updating project ${projectId} for user ${userId} in service: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  getProjectDescriptionForPrompt(project: ProjectModel): string {
    const constraints =
      project.constraints && project.constraints.length > 0
        ? project.constraints.join(', ')
        : 'Non spécifiées';
    const teamSize =
      project.teamSize !== undefined ? `${project.teamSize} développeurs` : 'Non spécifiée';
    const scope = project.scope || 'Non spécifié';
    const budgetIntervals = project.budgetIntervals || 'Non spécifiée';
    const targets = project.targets || 'Non spécifié';
    const type = project.type || 'Non spécifié';
    const description = project.description || 'Non spécifiée';

    const projectDescription = `
        Projet à analyser :
        - Nom du projet: ${project.name}
        - Description du projet : ${description}
        - Type d'application : ${type}
        - Contraintes techniques principales : ${constraints}
        - Composition de l'équipe : ${teamSize}
        - Périmètre fonctionnel couvert : ${scope}
        - Fourchette budgétaire prévue : ${budgetIntervals}
        - Publics cibles concernés : ${targets}
    `;
    logger.debug(`Generated project description for prompt for project: ${project.id || 'N/A'}`);
    return projectDescription.trim();
  }

  // Private helper to build analysisResultModel
  private async _buildAnalysisResultModelRecursive(dirPath: string): Promise<any> {
    logger.debug(`Recursively building analysis model from directory: ${dirPath}`);
    const entries = await fsExtra.readdir(dirPath, { withFileTypes: true });
    const model: any = {};

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const entryNameWithoutExt = path.parse(entry.name).name;

      if (entry.isDirectory()) {
        logger.debug(`Entering subdirectory: ${fullPath}`);
        model[entryNameWithoutExt] = await this._buildAnalysisResultModelRecursive(fullPath);
      } else {
        try {
          const content = await fsExtra.readFile(fullPath, 'utf-8');
          model[entryNameWithoutExt] = { content: content };
          logger.debug(`Read file content for: ${fullPath}`);
        } catch (error: any) {
          logger.error(`Failed to read file ${fullPath}: ${error.message}`, {
            stack: error.stack,
          });
          model[entryNameWithoutExt] = {
            content: `Error reading file: ${error.message}`,
          };
        }
      }
    }
    return model;
  }

  // Method to generate agentic zip
  async generateAgenticZip(userId: string, projectId: string): Promise<Buffer | null> {
    logger.info(
      `Attempting to generate agentic zip for projectId: ${projectId}, userId: ${userId}`
    );
    const project = await this.getUserProjectById(userId, projectId);

    if (!project) {
      logger.warn(
        `Project ${projectId} not found for userId ${userId}. Cannot generate agentic zip.`
      );
      return null;
    }

    if (!project.analysisResultModel || Object.keys(project.analysisResultModel).length === 0) {
      logger.info(
        `analysisResultModel not found or empty for project ${projectId}. Building it now.`
      );
      try {
        // This path should ideally be configurable or relative to the project root
        const analysisSourceDir = path.resolve(__dirname, '../../idem-agentic/01_AI-RUN');
        logger.info(`Using analysis source directory: ${analysisSourceDir}`);
        if (!(await fsExtra.pathExists(analysisSourceDir))) {
          logger.warn(
            `Analysis source directory does not exist: ${analysisSourceDir}. Cannot build analysisResultModel.`
          );
        } else {
          project.analysisResultModel =
            await this._buildAnalysisResultModelRecursive(analysisSourceDir);
          // Optionally, persist the newly built analysisResultModel to the database
          // await this.editUserProject(userId, projectId, { analysisResultModel: project.analysisResultModel });
          logger.info(`Successfully built analysisResultModel for project ${projectId}.`);
        }
      } catch (error: any) {
        logger.error(
          `Error building analysisResultModel for project ${projectId}: ${error.message}`,
          { stack: error.stack }
        );
        // Depending on requirements, may proceed without it or return null
      }
    } else {
      logger.info(`Using existing analysisResultModel for project ${projectId}.`);
    }

    const zip = new JSZip();
    // This path should also ideally be configurable or relative
    const templateDir = path.resolve(__dirname, '../../idem-agentic');
    logger.info(`Using template directory: ${templateDir}`);

    if (!(await fsExtra.pathExists(templateDir))) {
      logger.error(`Template directory does not exist: ${templateDir}. Cannot generate ZIP.`);
      return null;
    }

    const addFilesToZip = async (currentPath: string, zipFolder: JSZip | null) => {
      const entries = await fsExtra.readdir(currentPath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(templateDir, fullPath);

        if (entry.isDirectory()) {
          const folder = zipFolder ? zipFolder.folder(entry.name) : zip.folder(entry.name);
          if (folder) {
            // Ensure folder is not null
            await addFilesToZip(fullPath, folder);
          }
        } else {
          let content = await fsExtra.readFile(fullPath, 'utf-8');
          // Basic placeholder replacements
          content = content.replace(/\{\{project\.name\}\}/g, project.name || '');
          content = content.replace(/\{\{project\.description\}\}/g, project.description || '');
          content = content.replace(/\{\{project\.type\}\}/g, project.type || '');
          // Add other simple fields from ProjectModel as needed

          // Stringify the entire analysisResultModel for a general placeholder
          content = content.replace(
            /\{\{project\.analysisResultModel\}\}/g,
            project.analysisResultModel
              ? JSON.stringify(project.analysisResultModel, null, 2)
              : '{}'
          );

          // Advanced placeholder replacement for nested properties in analysisResultModel
          if (project.analysisResultModel) {
            const regex = /\{\{project\.analysisResultModel\.([^{}]+?)\}\}/g;
            content = content.replace(regex, (match, keyPath) => {
              const keys = keyPath.split('.');
              let value: any = project.analysisResultModel;
              for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                  value = value[key];
                } else {
                  logger.warn(
                    `Placeholder key not found in analysisResultModel: project.analysisResultModel.${keyPath}`
                  );
                  return match; // Placeholder not found, keep it as is
                }
              }
              return typeof value === 'string' ? value : JSON.stringify(value);
            });
          }

          if (zipFolder) {
            zipFolder.file(entry.name, content);
          } else {
            zip.file(entry.name, content);
          }
          logger.debug(`Added file to zip: ${relativePath}`);
        }
      }
    };

    try {
      await addFilesToZip(templateDir, null);
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      logger.info(`Successfully generated agentic zip buffer for projectId: ${projectId}`);
      return zipBuffer;
    } catch (error: any) {
      logger.error(`Error generating agentic zip for projectId ${projectId}: ${error.message}`, {
        stack: error.stack,
      });
      return null;
    }
  }

  // Project Generation Methods
  async getProjectGeneration(userId: string, projectId: string): Promise<any | null> {
    if (!userId || !projectId) {
      logger.error('User ID and Project ID are required to get project generation.');
      return null;
    }

    try {
      const generation = await this.projectRepository.findById(
        `${projectId}_generation`,
        `users/${userId}/generations`
      );

      if (!generation) {
        logger.info(`No generation found for project ${projectId} and user ${userId}`);
        return null;
      }

      logger.info(`Generation fetched for project ${projectId} and user ${userId}`);
      return generation;
    } catch (error: any) {
      logger.error(
        `Error fetching generation for project ${projectId} and user ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  async saveProjectGeneration(
    userId: string,
    projectId: string,
    generationData: any
  ): Promise<void> {
    if (!userId || !projectId || !generationData) {
      logger.error('User ID, Project ID, and generation data are required.');
      throw new Error('User ID, Project ID, and generation data are required.');
    }

    try {
      const generationRecord = {
        projectId,
        userId,
        ...generationData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.projectRepository.create(
        generationRecord,
        `users/${userId}/generations`,
        `${projectId}_generation`
      );

      logger.info(`Generation saved successfully for project ${projectId} and user ${userId}`);
    } catch (error: any) {
      logger.error(
        `Error saving generation for project ${projectId} and user ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  async saveProjectZip(userId: string, projectId: string, zipFile: any): Promise<string> {
    if (!userId || !projectId || !zipFile) {
      logger.error('User ID, Project ID, and ZIP file are required.');
      throw new Error('User ID, Project ID, and ZIP file are required.');
    }

    try {
      // Use the new uploadProjectCodeZip method from storage service
      const uploadResult = await storageService.uploadProjectCodeZip(
        zipFile.buffer,
        projectId,
        userId
      );

      logger.info(
        `ZIP file saved successfully for project ${projectId} and user ${userId}. URL: ${uploadResult.downloadURL}`
      );
      return uploadResult.downloadURL;
    } catch (error: any) {
      logger.error(
        `Error saving ZIP file for project ${projectId} and user ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  async sendProjectToGitHub(userId: string, projectId: string, githubData: any): Promise<string> {
    if (!userId || !projectId || !githubData) {
      logger.error('User ID, Project ID, and GitHub data are required.');
      throw new Error('User ID, Project ID, and GitHub data are required.');
    }

    try {
      // This is a placeholder implementation
      // In a real implementation, you would integrate with GitHub API
      const repoName = `${githubData.projectName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

      // Simulate GitHub repository creation
      logger.info(`Simulating GitHub repository creation for project ${projectId}`);

      // In a real implementation, you would:
      // 1. Create a new GitHub repository
      // 2. Upload all files from githubData.files
      // 3. Set repository visibility based on githubData.isPublic
      // 4. Return the actual repository URL

      const mockRepoUrl = `https://github.com/${userId}/${repoName}`;

      // Save GitHub integration record
      const githubRecord = {
        projectId,
        userId,
        repoName,
        repoUrl: mockRepoUrl,
        isPublic: githubData.isPublic || false,
        createdAt: new Date().toISOString(),
      };

      // Use a generic repository for non-project data
      const genericRepository = RepositoryFactory.getRepository<any>();
      await genericRepository.create(
        githubRecord,
        `users/${userId}/github_integrations`,
        `${projectId}_github`
      );

      logger.info(
        `Project ${projectId} sent to GitHub successfully for user ${userId}. Repo: ${mockRepoUrl}`
      );
      return mockRepoUrl;
    } catch (error: any) {
      logger.error(
        `Error sending project ${projectId} to GitHub for user ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      throw error;
    }
  }

  async getProjectCodeFromFirebase(
    userId: string,
    projectId: string
  ): Promise<Record<string, string> | null> {
    if (!userId || !projectId) {
      logger.error('User ID and Project ID are required to get project code from Firebase.');
      return null;
    }

    try {
      logger.info(
        `Attempting to retrieve project code from Firebase Storage for project ${projectId} and user ${userId}`
      );

      // Use storage service to download and extract the project code ZIP
      const codeFiles = await storageService.downloadProjectCodeZip(projectId, userId);

      if (!codeFiles || Object.keys(codeFiles).length === 0) {
        logger.info(`No code files found for project ${projectId} and user ${userId}`);
        return null;
      }

      logger.info(
        `Successfully retrieved ${Object.keys(codeFiles).length} code files for project ${projectId} and user ${userId}`
      );
      return codeFiles;
    } catch (error: any) {
      logger.error(
        `Error retrieving project code from Firebase for project ${projectId} and user ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      return null;
    }
  }
}

export const projectService = new ProjectService();
