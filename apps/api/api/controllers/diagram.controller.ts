import { Response } from "express";
import logger from "../config/logger";
import { DiagramService } from "../services/Diagrams/diagram.service";
import { CustomRequest } from "../interfaces/express.interface";
import { PromptService } from "../services/prompt.service";
import { userService } from "../services/user.service";
import { SectionModel } from "../models/section.model";
import { ISectionResult } from "../services/common/generic.service";

const diagramService = new DiagramService(new PromptService());

export const generateDiagramController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = "sA6ZeSlrP9Ri8tCNAncPNKi83Nz2";
  const { projectId } = req.params;
  logger.info(
    `generateDiagramController called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for generateDiagramController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    if (!projectId) {
      logger.warn("Project ID is required for generateDiagramController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }
    const updatedProject = await diagramService.generateDiagram(
      userId!,
      projectId
    );
    if (!updatedProject) {
      logger.warn(
        `Failed to generate diagram - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(500).json({ message: "Failed to generate diagram" });
      return;
    }

    // Get the most recently added diagram from the project's design array
    const newDiagram = updatedProject.analysisResultModel?.design;

    logger.info(
      `Diagram generated successfully - UserId: ${userId}, ProjectId: ${projectId}, DiagramId: ${
        newDiagram?.id || "unknown"
      }`
    );
    userService.incrementUsage(userId, 5);

    res
      .status(201)
      .json(newDiagram || { message: "Diagram generated but not returned" });
  } catch (error: any) {
    logger.error(
      `Error in generateDiagramController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );
    res
      .status(500)
      .json({ message: "Error generating diagram", error: error.message });
  }
};

export const getDiagramsByProjectController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  logger.info(
    `getDiagramsByProjectController called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: "Project ID is required" });
      return;
    }
    const diagrams = await diagramService.getDiagramsByProjectId(
      userId!,
      projectId
    );
    if (!diagrams) {
      logger.warn(
        `No diagrams found for project - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(404).json({ message: "No diagrams found for project" });
      return;
    }
    logger.info(
      `Diagrams fetched successfully for project - UserId: ${userId}, ProjectId: ${projectId}`
    );
    res.status(200).json(diagrams);
  } catch (error: any) {
    logger.error(
      `Error in getDiagramsByProjectController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res
      .status(500)
      .json({ message: "Error fetching diagrams", error: error.message });
  }
};

export const getDiagramByIdController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { diagramId } = req.params;
  logger.info(
    `getDiagramByIdController called - UserId: ${userId}, DiagramId: ${diagramId}`
  );
  try {
    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    const diagram = await diagramService.getDiagramById(userId!, diagramId);
    if (diagram) {
      logger.info(
        `Diagram fetched successfully - UserId: ${userId}, DiagramId: ${
          diagram.id || diagramId
        }`
      );
      res.status(200).json(diagram);
    } else {
      logger.warn(
        `Diagram not found - UserId: ${userId}, DiagramId: ${diagramId}`
      );
      res.status(404).json({ message: "Diagram not found" });
    }
  } catch (error: any) {
    logger.error(
      `Error in getDiagramByIdController - UserId: ${userId}, DiagramId: ${diagramId}: ${error.message}`,
      { stack: error.stack }
    );
    res
      .status(500)
      .json({ message: "Error fetching diagram", error: error.message });
  }
};

export const updateDiagramController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { diagramId } = req.params;
  logger.info(
    `updateDiagramController called - UserId: ${userId}, DiagramId: ${diagramId}`
  );
  try {
    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    const updatedProject = await diagramService.updateDiagram(
      userId!,
      diagramId,
      req.body
    );
    if (updatedProject) {
      logger.info(
        `Diagram updated successfully - UserId: ${userId}, DiagramId: ${diagramId}`
      );
      // Find the updated diagram in the project to return it
      const updatedDiagram = updatedProject.analysisResultModel?.design;
      res
        .status(200)
        .json(
          updatedDiagram || { message: "Diagram updated but not returned" }
        );
    } else {
      logger.warn(
        `Diagram not found for update - UserId: ${userId}, DiagramId: ${diagramId}`
      );
      res.status(404).json({ message: "Diagram not found for update" });
    }
  } catch (error: any) {
    logger.error(
      `Error in updateDiagramController - UserId: ${userId}, DiagramId: ${diagramId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );
    res
      .status(500)
      .json({ message: "Error updating diagram", error: error.message });
  }
};

export const generateDiagramStreamingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  logger.info(
    `generateDiagramStreamingController called - UserId: ${userId}, ProjectId: ${projectId}`
  );

  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for generateDiagramStreamingController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn(
        "Project ID is required for generateDiagramStreamingController"
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
        // Note: res.flush existe sur certaines implémentations mais pas sur le type Response standard
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
    const updatedProject = await diagramService.generateDiagram(
      userId,
      projectId,
      streamCallback // Passer le callback de streaming
    );

    if (!updatedProject) {
      logger.warn(
        `Failed to generate diagram - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.write(
        `data: ${JSON.stringify({ error: "Failed to generate diagram" })}\n\n`
      );
      res.end();
      return;
    }

    // Obtenir le diagramme ajouté le plus récemment
    const newDiagram = updatedProject.analysisResultModel?.design;

    logger.info(
      `Diagram generation completed - UserId: ${userId}, ProjectId: ${projectId}, DiagramId: ${
        newDiagram?.id || "unknown"
      }`
    );
    userService.incrementUsage(userId, 5);

    // Envoyer un événement de fin
    res.write(
      `data: ${JSON.stringify({ type: "complete", diagram: newDiagram })}\n\n`
    );
    res.end();
  } catch (error: any) {
    logger.error(
      `Error in generateDiagramStreamingController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );

    // Envoyer une erreur et terminer le stream
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

export const deleteDiagramController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { diagramId } = req.params;
  logger.info(
    `deleteDiagramController called - UserId: ${userId}, DiagramId: ${diagramId}`
  );
  try {
    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    const success = await diagramService.deleteDiagram(userId!, diagramId);
    if (success) {
      logger.info(
        `Diagram deleted successfully - UserId: ${userId}, DiagramId: ${diagramId}`
      );
      res.status(204).send();
    } else {
      logger.warn(
        `Diagram not found for deletion - UserId: ${userId}, DiagramId: ${diagramId}`
      );
      res.status(404).json({ message: "Diagram not found for deletion" });
    }
  } catch (error: any) {
    logger.error(
      `Error in deleteDiagramController - UserId: ${userId}, DiagramId: ${diagramId}: ${error.message}`,
      { stack: error.stack }
    );
    res
      .status(500)
      .json({ message: "Error deleting diagram", error: error.message });
  }
};
