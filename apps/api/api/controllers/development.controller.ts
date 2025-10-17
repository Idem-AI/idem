import { Response } from "express";
import logger from "../config/logger";
import { DevelopmentService } from "../services/Development/development.service";
import { CustomRequest } from "../interfaces/express.interface";

import { PromptService } from "../services/prompt.service";
import { DevelopmentConfigsModel } from "../models/development.model";

const promptService = new PromptService();
const developmentService = new DevelopmentService(promptService);

/**
 * Generate development context for a project
 */
export const saveDevelopmentConfigsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { developmentConfigs, projectId } = req.body;

  console.log("developmentConfigs", developmentConfigs);
  console.log("projectId", projectId);

  logger.info(
    `saveDevelopmentConfigsController called - UserId: ${userId}, ProjectId: ${projectId}`
  );

  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for saveDevelopmentConfigsController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn(
        "Project ID is required for saveDevelopmentConfigsController"
      );
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    const result = await developmentService.saveDevelopmentConfigs(
      userId,
      projectId,
      developmentConfigs as DevelopmentConfigsModel
    );

    if (result) {
      logger.info(
        `Successfully saved development configs for projectId: ${projectId}`
      );
      res.status(200).json(result);
    } else {
      logger.error(
        `Failed to save development configs for projectId: ${projectId}`
      );
      res.status(400).json({ message: "Failed to save development configs" });
    }
    return;
  } catch (error) {
    logger.error("Error in saveDevelopmentConfigsController:", {
      userId,
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ message: "Failed to save development configs" });
    return;
  }
};

/**
 * Get development configurations for a project
 */
export const getDevelopmentConfigsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;

  logger.info(
    `getDevelopmentConfigsController called - UserId: ${userId}, ProjectId: ${projectId}`
  );

  try {
    if (!userId) {
      logger.warn("User not authenticated for getDevelopmentConfigsController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn("Project ID is required for getDevelopmentConfigsController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    const result = await developmentService.getDevelopmentConfigs(
      userId,
      projectId
    );

    if (result) {
      logger.info(
        `Successfully retrieved development configs for projectId: ${projectId}`
      );
      res.status(200).json(result);
    } else {
      logger.error(
        `Failed to retrieve development configs for projectId: ${projectId}`
      );
      res
        .status(200)
        .json(null);
    }
  } catch (error) {
    logger.error("Error in getDevelopmentConfigsController:", {
      userId,
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ message: "Failed to retrieve development configs" });
  }
};
