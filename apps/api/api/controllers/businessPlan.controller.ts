import { Response } from "express";
import { CustomRequest } from "../interfaces/express.interface";
import { BusinessPlanService } from "../services/BusinessPlan/businessPlan.service";
import { PromptService } from "../services/prompt.service";
import logger from "../config/logger";
import { userService } from "../services/user.service";
import { ISectionResult } from "../services/common/generic.service";

// Create instances of the services
const promptService = new PromptService();
const businessPlanService = new BusinessPlanService(promptService);

/**
 * Contrôleur pour récupérer les business plans d'un projet
 */
export const getBusinessPlansByProjectController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  logger.info(
    `getBusinessPlansByProjectController called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for getBusinessPlansByProjectController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    if (!projectId) {
      logger.warn(
        "Project ID is required for getBusinessPlansByProjectController"
      );
      res.status(400).json({ message: "Project ID is required" });
      return;
    }
    const businessPlan = await businessPlanService.getBusinessPlansByProjectId(
      userId,
      projectId
    );
    if (businessPlan) {
      logger.info(
        `Business plan fetched successfully for project - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(200).json(businessPlan);
    } else {
      logger.warn(
        `Business plan not found for project - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res
        .status(404)
        .json({ message: "Business plan not found for the project" });
    }
  } catch (error: any) {
    logger.error(
      `Error in getBusinessPlansByProjectController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, params: req.params }
    );
    res.status(500).json({
      message: error.message || "Failed to retrieve business plan items",
    });
  }
};

/**
 * Contrôleur pour générer un PDF à partir des sections du business plan d'un projet
 */
export const generateBusinessPlanPdfController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `generateBusinessPlanPdfController called - UserId: ${userId}, ProjectId: ${projectId}`
  );

  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for generateBusinessPlanPdfController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn(
        "Project ID is required for generateBusinessPlanPdfController"
      );
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    // Générer le PDF à partir des sections du business plan
    const pdfPath = await businessPlanService.generateBusinessPlanPdf(
      userId,
      projectId
    );

    if (pdfPath === "") {
      res.status(404).json({ message: "No business plan found" });
      return;
    }

    // Lire le fichier PDF généré
    const fs = require("fs-extra");
    const pdfBuffer = await fs.readFile(pdfPath);

    // Configurer les headers pour le téléchargement du PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="business-plan-${projectId}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    // Envoyer le PDF
    res.send(pdfBuffer);

    // NE PAS supprimer le fichier - il est géré par le cache du PdfService
    // Le fichier sera automatiquement nettoyé par le système de cache après expiration

    logger.info(
      `Business plan PDF generated and sent successfully - UserId: ${userId}, ProjectId: ${projectId}`
    );
  } catch (error: any) {
    logger.error(
      `Error in generateBusinessPlanPdfController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );

    res.status(500).json({
      message: "Error generating business plan PDF",
      error: error.message,
    });
  }
};

export const getBusinessPlanByIdController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  logger.info(
    `getBusinessPlanByIdController (acting as getByProjectId) called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for getBusinessPlanByIdController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    const businessPlan = await businessPlanService.getBusinessPlansByProjectId(
      userId,
      projectId
    );
    if (businessPlan) {
      logger.info(
        `Business plan fetched successfully - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(200).json(businessPlan);
    } else {
      logger.warn(
        `Business plan not found - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(404).json({ message: "Business plan not found" });
    }
  } catch (error: any) {
    logger.error(
      `Error in getBusinessPlanByIdController (acting as getByProjectId) - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, params: req.params }
    );
    res.status(500).json({
      message: error.message || "Failed to retrieve business plan item",
    });
  }
};

export const updateBusinessPlanController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { itemId } = req.params;
  logger.info(
    `updateBusinessPlanController called - UserId: ${userId}, ItemId: ${itemId}`,
    { body: req.body }
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for updateBusinessPlanController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    const item = await businessPlanService.updateBusinessPlan(
      userId,
      itemId,
      req.body
    );
    if (item) {
      logger.info(
        `Business plan updated successfully - UserId: ${userId}, ItemId: ${itemId}`
      );
      res.status(200).json(item);
    } else {
      logger.warn(
        `Business plan item not found for update - UserId: ${userId}, ItemId: ${itemId}`
      );
      res.status(404).json({ message: "Business plan item not found" });
    }
  } catch (error: any) {
    logger.error(
      `Error in updateBusinessPlanController - UserId: ${userId}, ItemId: ${itemId}: ${error.message}`,
      { stack: error.stack, body: req.body, params: req.params }
    );
    res.status(500).json({
      message: error.message || "Failed to update business plan item",
    });
  }
};

export const deleteBusinessPlanController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { itemId } = req.params;
  logger.info(
    `deleteBusinessPlanController called - UserId: ${userId}, ItemId: ${itemId}`
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for deleteBusinessPlanController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    await businessPlanService.deleteBusinessPlan(userId, itemId);
    logger.info(
      `Business plan deleted successfully - UserId: ${userId}, ItemId: ${itemId}`
    );
    res.status(204).send();
  } catch (error: any) {
    logger.error(
      `Error in deleteBusinessPlanController - UserId: ${userId}, ItemId: ${itemId}: ${error.message}`,
      { stack: error.stack, params: req.params }
    );
    res.status(500).json({
      message: error.message || "Failed to delete business plan item",
    });
  }
};

export const generateBusinessPlanStreamingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `generateBusinessPlanStreamingController called - UserId: ${userId}, ProjectId: ${projectId}`
  );

  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for generateBusinessPlanStreamingController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn(
        "Project ID is required for generateBusinessPlanStreamingController"
      );
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    // Configuration pour SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Pour Nginx

    // Fonction de callback pour envoyer chaque résultat d'étape
    const streamCallback = async (stepResult: ISectionResult) => {
      try {
        // Déterminer le type d'événement
        const eventType = stepResult.parsedData?.status || "progress";

        // Créer un message structuré pour le frontend
        const message = {
          type: eventType, // 'started', 'completed', 'progress'
          stepName: stepResult.name,
          data: stepResult.data,
          summary: stepResult.summary,
          timestamp: new Date().toISOString(),
          ...(stepResult.parsedData && { parsedData: stepResult.parsedData }),
        };

        // Formatage du message SSE
        res.write(`data: ${JSON.stringify(message)}\n\n`);
        // On force l'envoi immédiat si la fonction flush est disponible
        (res as any).flush?.();

        logger.info(
          `Streamed step ${eventType} - UserId: ${userId}, ProjectId: ${projectId}, Step: ${stepResult.name}`
        );
      } catch (error: any) {
        logger.error(
          `Error streaming step result - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
          { stack: error.stack }
        );
      }
    };

    // Appel au service avec le callback de streaming
    const updatedProject =
      await businessPlanService.generateBusinessPlanWithStreaming(
        userId,
        projectId,
        streamCallback // Passer le callback de streaming
      );

    if (!updatedProject) {
      logger.warn(
        `Failed to generate business plan - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.write(
        `data: ${JSON.stringify({
          error: "Failed to generate business plan",
        })}\n\n`
      );
      res.end();
      return;
    }

    // Obtenir le business plan du projet mis à jour
    const newBusinessPlan = updatedProject.analysisResultModel?.businessPlan;

    logger.info(
      `Business plan generation completed - UserId: ${userId}, ProjectId: ${projectId}`
    );
    userService.incrementUsage(userId, 5);

    // Envoyer un événement de fin
    res.write(
      `data: ${JSON.stringify({
        type: "complete",
        businessPlan: newBusinessPlan,
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    logger.error(
      `Error in generateBusinessPlanStreamingController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );

    // Envoyer une erreur et terminer le stream
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

/**
 * Controller pour mettre à jour les informations additionnelles d'un projet
 * Supporte l'upload d'images des team members via multipart/form-data
 */
export const setAdditionalInfoController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { projectId } = req.params;

    logger.info(
      `Set additional info request from userId: ${userId}, projectId: ${projectId}`
    );

    if (!userId) {
      logger.warn("Unauthorized set additional info request - no userId");
      res.status(401).json({ message: "Non autorisé" });
      return;
    }

    if (!projectId) {
      logger.warn("Missing projectId for set additional info");
      res.status(400).json({ message: "Project ID requis" });
      return;
    }

    // Parse additional infos from request body
    let additionalInfos;
    try {
      // Check if additionalInfos is a string (from multipart) or already an object
      if (typeof req.body.additionalInfos === "string") {
        additionalInfos = JSON.parse(req.body.additionalInfos);
      } else {
        additionalInfos = req.body;
      }
    } catch (parseError: any) {
      logger.error(`Error parsing additional infos: ${parseError.message}`);
      res
        .status(400)
        .json({ message: "Format des informations additionnelles invalide" });
      return;
    }

    // Validate required fields
    if (!additionalInfos.email) {
      logger.warn("Missing required email in additional infos");
      res
        .status(400)
        .json({ message: "Email requis dans les informations additionnelles" });
      return;
    }

    if (
      !additionalInfos.teamMembers ||
      !Array.isArray(additionalInfos.teamMembers)
    ) {
      logger.warn("Missing or invalid teamMembers in additional infos");
      res.status(400).json({
        message: "Team members requis dans les informations additionnelles",
      });
      return;
    }

    // Get team member images from uploaded files
    const teamMemberImages = req.files as Express.Multer.File[] | undefined;

    logger.info(
      `Processing additional infos with ${
        additionalInfos.teamMembers.length
      } team members and ${teamMemberImages?.length || 0} images`
    );

    const result = await businessPlanService.setAdditionalInfos(
      userId,
      projectId,
      additionalInfos,
      teamMemberImages
    );

    if (!result.project) {
      logger.warn(`Failed to set additional infos for project: ${projectId}`);
      res
        .status(404)
        .json({ message: "Projet non trouvé ou échec de la mise à jour" });
      return;
    }

    logger.info(`Additional infos set successfully for project: ${projectId}`);
    res.json({
      message: "Informations additionnelles mises à jour avec succès",
      project: result.project,
      uploadedImages: result.uploadedImages,
    });
  } catch (error: any) {
    logger.error(`Error in setAdditionalInfoController: ${error.message}`, {
      stack: error.stack,
      body: req.body,
    });
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
};
