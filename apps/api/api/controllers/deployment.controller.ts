import { Response } from "express";
import { CustomRequest } from "../interfaces/express.interface";
import { DeploymentService } from "../services/Deployment/deployment.service";
import logger from "../config/logger";
import {
  CreateDeploymentPayload,
  UpdateDeploymentPayload,
  DeploymentValidators,
  ChatMessage,
  EnvironmentVariable,
} from "../models/deployment.model";
import { PromptService } from "../services/prompt.service";
import { userService } from "../services/user.service";

const deploymentService = new DeploymentService(new PromptService());

// Execute an existing deployment (run Docker worker)
export const ExecuteDeploymentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { deploymentId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `Executing deployment for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    await deploymentService.executeDeployment(userId, deploymentId);

    res.status(200).json({
      success: true,
      message: "Deployment execution started",
      data: { deploymentId },
    });
  } catch (error: any) {
    logger.error(`Error executing deployment: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to execute deployment",
      error: error.message,
    });
  }
};

// Create a new deployment
export const CreateDeploymentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    logger.info("Creating deployment....");
    const userId = req.user?.uid;

    const payload: CreateDeploymentPayload = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `Creating deployment for userId: ${userId}, projectId: ${payload.projectId}`
    );

    // Validate the payload
    const validationErrors = DeploymentValidators.validateBasicInfo(payload);
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
      return;
    }

    const deployment = await deploymentService.createDeployment(
      userId,
      payload.projectId!,
      payload
    );

    res.status(201).json(deployment);
  } catch (error: any) {
    logger.error(`Error creating deployment: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get deployments by project
export const GetDeploymentsByProjectController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { projectId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `Getting deployments for userId: ${userId}, projectId: ${projectId}`
    );

    const deployments = await deploymentService.getDeploymentsByProject(
      userId,
      projectId
    );

    res.status(200).json(deployments);
  } catch (error: any) {
    logger.error(`Error getting deployments: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get deployment by ID
export const GetDeploymentByIdController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { deploymentId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `Getting deployment for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    const deployment = await deploymentService.getDeploymentById(
      userId,
      deploymentId
    );

    if (!deployment) {
      res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
      return;
    }

    res.status(200).json(deployment);
  } catch (error: any) {
    logger.error(`Error getting deployment: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update deployment
export const UpdateDeploymentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { deploymentId } = req.params;
    const updates: UpdateDeploymentPayload = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `Updating deployment for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    const deployment = await deploymentService.updateDeployment(
      userId,
      deploymentId,
      updates
    );

    if (!deployment) {
      res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Deployment updated successfully",
      data: deployment,
    });
  } catch (error: any) {
    logger.error(`Error updating deployment: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete deployment
export const DeleteDeploymentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { deploymentId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `Deleting deployment for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    const success = await deploymentService.deleteDeployment(
      userId,
      deploymentId
    );

    if (!success) {
      res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Deployment deleted successfully",
    });
  } catch (error: any) {
    logger.error(`Error deleting deployment: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Add chat message and get AI response
export const AddChatMessageController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;

    const { text } = req.body.message;
    const { projectId } = req.body;
    console.log("projectId", projectId);
    console.log("text", text);
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

    console.log("text", text);

    if (!text || typeof text !== "string") {
      res.status(400).json({
        success: false,
        message: "Message is required and must be a string",
      });
      return;
    }

    logger.info(
      `Adding chat message for userId: ${userId}, projectId: ${projectId}`
    );

    // Create a chat message with timestamp and initialize structured response fields
    const chatMessage: ChatMessage = {
      sender: "user",
      text: text,
      timestamp: new Date(),
      // User messages don't need these fields, but initialize them for consistency
      isRequestingDetails: false,
      isProposingArchitecture: false,
    };

    // The enhanced addChatMessage method will automatically generate an AI response
    // when it receives a user message
    const chatMessageResponse = await deploymentService.addChatMessage(
      userId,
      projectId,
      chatMessage
    );

    if (!chatMessageResponse) {
      res.status(404).json({
        success: false,
        message: "Chat message not found",
      });
      return;
    }

    res.status(200).json(chatMessageResponse);
  } catch (error: any) {
    logger.error(`Error processing chat message: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Start deployment pipeline
export const StartPipelineController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { deploymentId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `Starting pipeline for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    const deployment = await deploymentService.startDeploymentPipeline(
      userId,
      deploymentId
    );

    if (!deployment) {
      res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Deployment pipeline started successfully",
      data: deployment,
    });
  } catch (error: any) {
    logger.error(`Error starting pipeline: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Failed to start deployment pipeline",
      error: error.message,
    });
  }
};

// Get pipeline status
export const GetPipelineStatusController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { deploymentId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `Getting pipeline status for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    const deployment = await deploymentService.getDeploymentById(
      userId,
      deploymentId
    );

    if (!deployment) {
      res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Pipeline status retrieved successfully",
      data: {
        status: deployment.status,
        pipelines: deployment.pipelines,
        costEstimation: deployment.costEstimation,
      },
    });
  } catch (error: any) {
    logger.error(`Error getting pipeline status: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Legacy method for backward compatibility
export const generateDeploymentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId, deploymentId } = req.body;

  logger.info(
    `GenerateDeploymentController called with projectId: ${projectId}, deploymentId: ${deploymentId}`
  );

  try {
    if (!userId) {
      logger.warn("Authentication missing: userId is undefined");
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }
    if (!projectId && !deploymentId) {
      logger.warn(
        "Missing required parameters: either projectId or deploymentId must be provided"
      );
      res.status(400).json({
        success: false,
        message: "Either Project ID or Deployment ID is required",
      });
      return;
    }

    let deployment;

    deployment = await deploymentService.generateDeployment(
      userId,
      projectId,
      deploymentId
    );

    // Customize the message based on whether we generated for an existing deployment or created a new one
    let message;
    if (deploymentId) {
      message = `Generated Terraform files for existing deployment ${deploymentId}`;
    } else {
      message = `New deployment created successfully with tfvars generated`;
    }
    userService.incrementUsage(userId, 5);

    res.status(201).json({
      success: true,
      message,
      data: deployment,
    });
  } catch (error: any) {
    logger.error(
      `Error generating deployment for projectId: ${projectId}. Error: ${error.message}`,
      {
        error: error.stack,
      }
    );

    res.status(500).json({
      success: false,
      message: "Failed to generate deployment",
      error: error.message,
    });
  }
};

// Edit Terraform tfvars file
export const editTerraformTfvarsFileController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { deploymentId } = req.params;
  const { tfvarsFileContent, projectId } = req.body;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
    return;
  }

  try {
    const updatedDeployment = await deploymentService.editTerraformTfvarsFile(
      userId,
      projectId,
      deploymentId,
      tfvarsFileContent
    );

    if (!updatedDeployment) {
      res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Terraform tfvars file updated successfully",
      data: updatedDeployment,
    });
  } catch (error: any) {
    logger.error(
      `Error editing Terraform tfvars file for projectId: ${projectId}, deploymentId: ${deploymentId}. Error: ${error.message}`,
      { error: error.stack }
    );

    res.status(500).json({
      success: false,
      message: "Failed to edit Terraform tfvars file",
      error: error.message,
    });
  }
};

// Execute deployment with streaming logs via SSE
export const ExecuteDeploymentStreamingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { deploymentId } = req.params;

  logger.info(
    `ExecuteDeploymentStreamingController called - UserId: ${userId}, DeploymentId: ${deploymentId}`
  );

  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for ExecuteDeploymentStreamingController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!deploymentId) {
      logger.warn(
        "Deployment ID is required for ExecuteDeploymentStreamingController"
      );
      res.status(400).json({ message: "Deployment ID is required" });
      return;
    }

    // Configuration pour SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Pour Nginx

    // Fonction de callback pour envoyer chaque log en temps réel
    const streamCallback = async (logData: {
      type: "stdout" | "stderr" | "info" | "error" | "status";
      message: string;
      timestamp: string;
      step?: string;
    }) => {
      try {
        // Créer un message structuré pour le frontend
        const message = {
          type: logData.type,
          message: logData.message,
          timestamp: logData.timestamp,
          step: logData.step || "deployment",
          deploymentId: deploymentId,
        };

        // Formatage du message SSE
        res.write(`data: ${JSON.stringify(message)}\n\n`);
        // On force l'envoi immédiat si la fonction flush est disponible
        (res as any).flush?.();

        logger.info(
          `Streamed log ${logData.type} - UserId: ${userId}, DeploymentId: ${deploymentId}, Step: ${logData.step}`
        );
      } catch (error: any) {
        logger.error(
          `Error streaming log - UserId: ${userId}, DeploymentId: ${deploymentId}: ${error.message}`,
          { stack: error.stack }
        );
      }
    };

    // Appel au service avec le callback de streaming
    await deploymentService.executeDeploymentWithStreaming(
      userId,
      deploymentId,
      streamCallback // Passer le callback de streaming
    );

    logger.info(
      `Deployment execution completed - UserId: ${userId}, DeploymentId: ${deploymentId}`
    );
    userService.incrementUsage(userId, 5);

    // Envoyer un événement de fin de succès
    res.write(
      `data: ${JSON.stringify({
        type: "success",
        message: "Deployment execution completed successfully",
        timestamp: new Date().toISOString(),
        deploymentId: deploymentId,
        status: "finished",
      })}\n\n`
    );

    // Envoyer l'événement de fin de stream
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error: any) {
    logger.error(
      `Error in ExecuteDeploymentStreamingController - UserId: ${userId}, DeploymentId: ${deploymentId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );

    // Envoyer une erreur structurée et terminer le stream
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
        deploymentId: deploymentId,
        status: "failed",
        errorCode: error.code || "DEPLOYMENT_ERROR",
      })}\n\n`
    );

    // Envoyer l'événement de fin de stream avec erreur
    res.write(`data: [ERROR]\n\n`);
    res.end();
  }
};

/**
 * Store sensitive variables for a deployment
 */
export const storeSensitiveVariablesController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { projectId, deploymentId } = req.params;
    const { sensitiveVariables } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    logger.info(
      `storeSensitiveVariablesController called - UserId: ${userId}, ProjectId: ${projectId}, DeploymentId: ${deploymentId}`
    );

    // Validate input
    if (!sensitiveVariables || !Array.isArray(sensitiveVariables)) {
      res.status(400).json({
        success: false,
        message: "Invalid sensitive variables data",
      });
      return;
    }

    // Validate each sensitive variable
    for (const variable of sensitiveVariables) {
      if (!variable.key || !variable.value) {
        res.status(400).json({
          success: false,
          message: "Each sensitive variable must have a key and value",
        });
        return;
      }
    }

    const updatedDeployment = await deploymentService.storeSensitiveVariables(
      userId,
      projectId,
      deploymentId,
      sensitiveVariables
    );

    if (!updatedDeployment) {
      res.status(404).json({
        success: false,
        message: "Deployment not found",
      });
      return;
    }

    logger.info(
      `Successfully stored sensitive variables for deployment ${deploymentId}`
    );

    res.status(200).json({
      success: true,
      message: "Sensitive variables stored successfully",
      data: {
        deploymentId: updatedDeployment.id,
        sensitiveVariablesCount: sensitiveVariables.length,
      },
    });
  } catch (error: any) {
    const userId = req.user?.uid;
    const { projectId, deploymentId } = req.params;

    logger.error(
      `Error in storeSensitiveVariablesController - UserId: ${userId}, ProjectId: ${projectId}, DeploymentId: ${deploymentId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );

    res.status(500).json({
      success: false,
      message: "Failed to store sensitive variables",
      error: error.message,
    });
  }
};
