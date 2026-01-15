import { Response, NextFunction } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { projectService } from '../services/project.service';
import { ProjectModel } from '../models/project.model'; // Assuming ProjectModel is an interface/type
import logger from '../config/logger';

class ProjectController {
  async createProject(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    logger.info(`Attempting to create project. UserID from token: ${userId}`);
    try {
      if (!userId) {
        // This case should ideally be caught by the authenticate middleware
        logger.warn('Create project attempt failed: User ID not found in token.');
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      const { id, name, description, ...otherProjectData } = req.body;
      const projectData: Omit<ProjectModel, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
        name,
        description,
        ...otherProjectData,
      };

      if (!projectData.name || !projectData.description) {
        logger.warn(
          `Create project attempt failed for userId ${userId}: Missing required fields (name or description).`
        );
        res.status(400).json({
          message: 'Missing required project fields: name, description',
        });
        return;
      }
      const projectId = await projectService.createUserProject(userId, projectData);
      logger.info(`Project created successfully for userId ${userId} with projectId: ${projectId}`);
      res.status(201).json({ message: 'Project created successfully', projectId });
    } catch (error: any) {
      logger.error(`Error in createProject controller for userId ${userId}: ${error.message}`, {
        stack: error.stack,
        details: error,
      });
      next(error);
    }
  }

  async getAllProjects(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    logger.info(`Attempting to get all projects for userId from token: ${userId}`);
    try {
      if (!userId) {
        logger.warn('Get all projects attempt failed: User ID not found in token.');
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      const projects = await projectService.getAllUserProjects(userId);
      logger.info(`Successfully fetched ${projects.length} projects for userId ${userId}.`);
      res.status(200).json(projects);
    } catch (error: any) {
      logger.error(`Error in getAllProjects controller for userId ${userId}: ${error.message}`, {
        stack: error.stack,
        details: error,
      });
      next(error);
    }
  }

  async getProjectById(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    logger.info(
      `Attempting to get project by ID. ProjectId: ${projectId}, UserId from token: ${userId}`
    );
    try {
      if (!userId) {
        logger.warn(
          `Get project by ID failed for projectId ${projectId}: User ID not found in token.`
        );
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      if (!projectId) {
        logger.warn('Get project by ID failed: Project ID missing in params.');
        res.status(400).json({ message: 'Project ID is required' });
        return;
      }
      const project = await projectService.getUserProjectById(userId, projectId);
      if (!project) {
        logger.warn(`Get project by ID: Project ${projectId} not found for user ${userId}.`);
        res.status(404).json({ message: 'Project not found' });
        return;
      }
      logger.info(`Successfully fetched project ${projectId} for user ${userId}.`);
      res.status(200).json(project);
    } catch (error: any) {
      logger.error(
        `Error in getProjectById controller for projectId ${projectId}, userId ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      next(error);
    }
  }

  async updateProject(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    logger.info(
      `Attempting to update project. ProjectId: ${projectId}, UserId from token: ${userId}`
    );
    try {
      if (!userId) {
        logger.warn(
          `Update project attempt failed for projectId ${projectId}: User ID not found in token.`
        );
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      const { name, description, ...otherUpdatedData } = req.body;
      const updatedData: Partial<Omit<ProjectModel, 'id' | 'createdAt' | 'updatedAt' | 'userId'>> =
        { name, description, ...otherUpdatedData };
      if (!projectId) {
        res.status(400).json({ message: 'Project ID is required' });
        return;
      }
      if (Object.keys(updatedData).length === 0) {
        logger.warn(
          `Update project attempt failed for projectId ${projectId}, userId ${userId}: No update data provided.`
        );
        res.status(400).json({ message: 'No update data provided' });
        return;
      }
      await projectService.editUserProject(userId, projectId, updatedData);
      logger.info(`Project ${projectId} updated successfully for userId ${userId}.`);
      res.status(200).json({ message: 'Project updated successfully' });
    } catch (error: any) {
      logger.error(
        `Error in updateProject controller for projectId ${projectId}, userId ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      next(error);
    }
  }

  async deleteProject(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    logger.info(
      `Attempting to delete project. ProjectId: ${projectId}, UserId from token: ${userId}`
    );
    try {
      if (!userId) {
        logger.warn(
          `Delete project attempt failed for projectId ${projectId}: User ID not found in token.`
        );
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      if (!projectId) {
        res.status(400).json({ message: 'Project ID is required' });
        return;
      }
      await projectService.deleteUserProject(userId, projectId);
      logger.info(`Project ${projectId} deleted successfully for userId ${userId}.`);
      res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error: any) {
      logger.error(
        `Error in deleteProject controller for projectId ${projectId}, userId ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      next(error);
    }
  }

  async getProjectGeneration(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    logger.info(
      `Attempting to get project generation. ProjectId: ${projectId}, UserId from token: ${userId}`
    );
    try {
      if (!userId) {
        logger.warn(
          `Get project generation failed for projectId ${projectId}: User ID not found in token.`
        );
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      if (!projectId) {
        logger.warn('Get project generation failed: Project ID missing in params.');
        res.status(400).json({ message: 'Project ID is required' });
        return;
      }

      const generation = await projectService.getProjectGeneration(userId, projectId);
      if (!generation) {
        logger.info(`No generation found for project ${projectId} and user ${userId}.`);
        res.status(404).json({ message: 'Generation not found' });
        return;
      }

      logger.info(`Successfully fetched generation for project ${projectId} and user ${userId}.`);
      res.status(200).json(generation);
    } catch (error: any) {
      logger.error(
        `Error in getProjectGeneration controller for projectId ${projectId}, userId ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      next(error);
    }
  }

  async saveProjectGeneration(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    const generationData = req.body;
    logger.info(
      `Attempting to save project generation. ProjectId: ${projectId}, UserId from token: ${userId}`
    );
    try {
      if (!userId) {
        logger.warn(
          `Save project generation failed for projectId ${projectId}: User ID not found in token.`
        );
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      if (!projectId) {
        logger.warn('Save project generation failed: Project ID missing in params.');
        res.status(400).json({ message: 'Project ID is required' });
        return;
      }
      if (!generationData || Object.keys(generationData).length === 0) {
        logger.warn(
          `Save project generation failed for projectId ${projectId}: No generation data provided.`
        );
        res.status(400).json({ message: 'Generation data is required' });
        return;
      }

      await projectService.saveProjectGeneration(userId, projectId, generationData);
      logger.info(`Generation saved successfully for project ${projectId} and user ${userId}.`);
      res.status(200).json({ message: 'Generation saved successfully' });
    } catch (error: any) {
      logger.error(
        `Error in saveProjectGeneration controller for projectId ${projectId}, userId ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      next(error);
    }
  }

  async saveProjectZip(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    logger.info(
      `Attempting to save project ZIP. ProjectId: ${projectId}, UserId from token: ${userId}`
    );
    try {
      if (!userId) {
        logger.warn(
          `Save project ZIP failed for projectId ${projectId}: User ID not found in token.`
        );
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      if (!projectId) {
        logger.warn('Save project ZIP failed: Project ID missing in params.');
        res.status(400).json({ message: 'Project ID is required' });
        return;
      }
      if (!req.file) {
        logger.warn(
          `Save project ZIP failed for projectId ${projectId}: No ZIP file provided.`
        );
        res.status(400).json({ message: 'ZIP file is required' });
        return;
      }

      const zipUrl = await projectService.saveProjectZip(userId, projectId, req.file);
      logger.info(`ZIP saved successfully for project ${projectId} and user ${userId}. URL: ${zipUrl}`);
      res.status(200).json({ message: 'ZIP saved successfully', url: zipUrl });
    } catch (error: any) {
      logger.error(
        `Error in saveProjectZip controller for projectId ${projectId}, userId ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      next(error);
    }
  }

  async sendProjectToGitHub(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.uid;
    const { projectId } = req.params;
    const githubData = req.body;
    logger.info(
      `Attempting to send project to GitHub. ProjectId: ${projectId}, UserId from token: ${userId}`
    );
    try {
      if (!userId) {
        logger.warn(
          `Send project to GitHub failed for projectId ${projectId}: User ID not found in token.`
        );
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }
      if (!projectId) {
        logger.warn('Send project to GitHub failed: Project ID missing in params.');
        res.status(400).json({ message: 'Project ID is required' });
        return;
      }
      if (!githubData || !githubData.projectName || !githubData.files) {
        logger.warn(
          `Send project to GitHub failed for projectId ${projectId}: Missing required GitHub data.`
        );
        res.status(400).json({ message: 'Project name and files are required' });
        return;
      }

      const repoUrl = await projectService.sendProjectToGitHub(userId, projectId, githubData);
      logger.info(`Project ${projectId} sent to GitHub successfully for user ${userId}. Repo: ${repoUrl}`);
      res.status(200).json({ message: 'Project sent to GitHub successfully', repoUrl });
    } catch (error: any) {
      logger.error(
        `Error in sendProjectToGitHub controller for projectId ${projectId}, userId ${userId}: ${error.message}`,
        { stack: error.stack, details: error }
      );
      next(error);
    }
  }
}

export const projectController = new ProjectController();
