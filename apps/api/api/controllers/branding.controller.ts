import { Response } from "express";
import { BrandingService } from "../services/BandIdentity/branding.service";
import { PromptService } from "../services/prompt.service";
import { CustomRequest } from "../interfaces/express.interface";
import logger from "../config/logger";
import { userService } from "../services/user.service";
import { ISectionResult } from "../services/common/generic.service";

const promptService = new PromptService();
const brandingService = new BrandingService(promptService);

export const generateColorsAndTypographyController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const project = req.body.project;
  const userId = req.user?.uid;
  logger.info(
    `generateColorsAndTypographyController called - UserId: ${userId}`,
    { body: req.body }
  );
  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for generateColorsAndTypographyController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    if (!project) {
      logger.warn(
        "Project data is required for generateColorsAndTypographyController"
      );
      res.status(400).json({ message: "Project data is required" });
      return;
    }

    const result = await brandingService.generateColorsAndTypography(
      userId,
      project
    );

    if (!result) {
      logger.warn(
        `Failed to generate colors and typography - UserId: ${userId}, ProjectId: ${project.id}`
      );
      res
        .status(500)
        .json({ message: "Failed to generate colors and typography" });
      return;
    }

    logger.info(
      `Successfully generated colors and typography - UserId: ${userId}, ProjectId: ${project.id}`
    );
    res.status(200).json(result);
  } catch (error) {
    logger.error(
      `Error in generateColorsAndTypographyController - UserId: ${userId}, ProjectId: ${project?.id}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      }
    );
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Étape 1: Génère 4 concepts de logos principaux (sans variations)
 */
export const generateLogoConceptsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const { selectedColors, selectedTypography, logoType, useAIGeneration, customDescription } = req.body;
  const userId = req.user?.uid;
  logger.info(
    `generateLogoConceptsController called - UserId: ${userId}, ProjectId: ${projectId}`,
    { body: req.body, logoType, useAIGeneration, customDescription }
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for generateLogoConceptsController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    if (!projectId) {
      logger.warn("Project ID is required for generateLogoConceptsController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    const logos = await brandingService.generateLogoConcepts(
      userId,
      projectId,
      selectedColors,
      selectedTypography,
      {
        type: logoType || 'name',
        useAIGeneration: useAIGeneration !== false,
        customDescription
      }
    );

    if (!logos) {
      logger.warn(
        `Failed to generate logo concepts - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(500).json({ message: "Failed to generate logo concepts" });
      return;
    }

    logger.info(
      `Successfully generated logo concepts - UserId: ${userId}, ProjectId: ${projectId}, LogoType: ${logoType}`
    );
    userService.incrementUsage(userId, 5);
    res.status(200).json(logos);
  } catch (error) {
    logger.error(
      `Error in generateLogoConceptsController - UserId: ${userId}, ProjectId: ${projectId}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      }
    );
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Étape 2: Génère les variations d'un logo sélectionné
 */
export const generateLogoVariationsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const { selectedLogo } = req.body;
  const userId = req.user?.uid;
  logger.info(
    `generateLogoVariationsController called - UserId: ${userId}, ProjectId: ${projectId}`,
    { body: req.body }
  );
  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for generateLogoVariationsController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const variations = await brandingService.generateLogoVariations(
      userId,
      projectId,
      selectedLogo
    );

    if (!variations) {
      logger.warn(
        `Failed to generate logo variations - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(500).json({ message: "Failed to generate logo variations" });
      return;
    }

    logger.info(
      `Successfully generated logo variations - UserId: ${userId}, ProjectId: ${projectId}`
    );
    userService.incrementUsage(userId, 5);
    res.status(200).json({ variations });
  } catch (error) {
    logger.error(
      `Error in generateLogoVariationsController - UserId: ${userId}, ProjectId: ${projectId}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      }
    );
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * @deprecated Utiliser generateLogoConceptsController() à la place
 */
export const generateLogosController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  logger.warn(
    "generateLogosController is deprecated, use generateLogoConceptsController instead"
  );
  return generateLogoConceptsController(req, res);
};

export const getBrandingsByProjectController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `getBrandingsByProjectController called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for getBrandingsByProjectController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    if (!projectId) {
      logger.warn("Project ID is required for getBrandingsByProjectController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }
    const branding = await brandingService.getBrandingsByProjectId(
      userId,
      projectId
    );

    if (!branding) {
      logger.info(
        `No branding found - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(404).json({ message: "No branding found for this project" });
      return;
    }

    logger.info(
      `Retrieved branding successfully - UserId: ${userId}, ProjectId: ${projectId}`
    );
    res.status(200).json(branding);
  } catch (error: any) {
    logger.error(
      `Error in getBrandingsByProjectController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({
      message: "Error retrieving branding",
      error: error.message,
    });
  }
};

export const getBrandingByIdController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { brandingId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `getBrandingByIdController called - UserId: ${userId}, BrandingId: ${brandingId}`
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for getBrandingByIdController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    const branding = await brandingService.getBrandingById(userId, brandingId);
    if (branding) {
      logger.info(
        `Branding fetched successfully - UserId: ${userId}, BrandingId: ${brandingId}`
      );
      res.status(200).json(branding);
    } else {
      logger.warn(
        `Branding not found - UserId: ${userId}, BrandingId: ${brandingId}`
      );
      res.status(404).json({ message: "Branding not found" });
    }
  } catch (error: any) {
    logger.error(
      `Error in getBrandingByIdController - UserId: ${userId}, BrandingId: ${brandingId}: ${error.message}`,
      { stack: error.stack, params: req.params }
    );
    res
      .status(500)
      .json({ message: "Error fetching branding", error: error.message });
  }
};

export const updateBrandingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `updateBrandingController called - UserId: ${userId}, ProjectId: ${projectId}`,
    { body: req.body }
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for updateBrandingController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    if (!projectId) {
      logger.warn("Project ID is required for updateBrandingController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }
    const updatedProject = await brandingService.updateBranding(
      userId,
      projectId,
      req.body
    );
    if (!updatedProject) {
      logger.warn(
        `Project not found for branding update - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(404).json({ message: "Project not found" });
      return;
    }
    logger.info(
      `Branding updated successfully - UserId: ${userId}, ProjectId: ${projectId}`
    );
    res.status(200).json(updatedProject.analysisResultModel.branding);
  } catch (error: any) {
    logger.error(
      `Error in updateBrandingController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );
    res.status(500).json({
      message: "Error updating branding",
      error: error.message,
    });
  }
};

export const deleteBrandingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `deleteBrandingController called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      logger.warn("User not authenticated for deleteBrandingController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    if (!projectId) {
      logger.warn("Project ID is required for deleteBrandingController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }
    const success = await brandingService.deleteBranding(userId, projectId);

    if (!success) {
      logger.warn(
        `Project not found for branding deletion - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(404).json({ message: "Project not found" });
      return;
    }

    logger.info(
      `Branding deleted successfully - UserId: ${userId}, ProjectId: ${projectId}`
    );
    res.status(204).send();
  } catch (error: any) {
    logger.error(
      `Error in deleteBrandingController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({
      message: "Error deleting branding",
      error: error.message,
    });
  }
};

export const generateBrandingStreamingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `generateBrandingStreamingController called - UserId: ${userId}, ProjectId: ${projectId}`
  );

  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for generateBrandingStreamingController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn(
        "Project ID is required for generateBrandingStreamingController"
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
    const updatedProject = await brandingService.generateBrandingWithStreaming(
      userId,
      projectId,
      streamCallback // Passer le callback de streaming
    );

    if (!updatedProject) {
      logger.warn(
        `Failed to generate branding - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.write(
        `data: ${JSON.stringify({ error: "Failed to generate branding" })}\n\n`
      );
      res.end();
      return;
    }

    // Obtenir le branding du projet mis à jour
    const newBranding = updatedProject.analysisResultModel?.branding;

    logger.info(
      `Branding generation completed - UserId: ${userId}, ProjectId: ${projectId}`
    );
    userService.incrementUsage(userId, 5);

    // Envoyer un événement de fin
    res.write(
      `data: ${JSON.stringify({ type: "complete", branding: newBranding })}\n\n`
    );
    res.end();
  } catch (error: any) {
    logger.error(
      `Error in generateBrandingStreamingController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );

    // Envoyer une erreur et terminer le stream
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

/**
 * Contrôleur pour générer un PDF à partir des sections de branding d'un projet
 */
export const generateBrandingPdfController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `generateBrandingPdfController called - UserId: ${userId}, ProjectId: ${projectId}`
  );

  try {
    if (!userId) {
      logger.warn("User not authenticated for generateBrandingPdfController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn("Project ID is required for generateBrandingPdfController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    // Générer le PDF à partir des sections de branding
    const pdfPath = await brandingService.generateBrandingPdf(
      userId,
      projectId
    );
    if (pdfPath === "" || !pdfPath) {
      res.status(404).json({ message: "No Branding  found for thiss project" });
      return;
    }

    // Lire le fichier PDF généré
    const fs = require("fs-extra");
    const pdfBuffer = await fs.readFile(pdfPath);

    // Configurer les headers pour le téléchargement du PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="branding-${projectId}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    // Envoyer le PDF
    res.send(pdfBuffer);

    // NE PAS supprimer le fichier - il est géré par le cache du PdfService
    // Le fichier sera automatiquement nettoyé par le système de cache après expiration

    logger.info(
      `PDF generated and sent successfully - UserId: ${userId}, ProjectId: ${projectId}`
    );
  } catch (error: any) {
    logger.error(
      `Error in generateBrandingPdfController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );

    res.status(500).json({
      message: "Error generating branding PDF",
      error: error.message,
    });
  }
};

/**
 * Contrôleur pour générer et télécharger un ZIP contenant toutes les déclinaisons du logo
 */
export const generateLogosZipController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId, extension } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `generateLogosZipController called - UserId: ${userId}, ProjectId: ${projectId}, Extension: ${extension}`
  );

  try {
    if (!userId) {
      logger.warn("User not authenticated for generateLogosZipController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn("Project ID is required for generateLogosZipController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    if (!extension) {
      logger.warn("Extension is required for generateLogosZipController");
      res.status(400).json({ message: "Extension is required" });
      return;
    }

    // Valider l'extension
    const validExtensions = ['svg', 'png', 'psd'];
    if (!validExtensions.includes(extension.toLowerCase())) {
      logger.warn(`Invalid extension: ${extension} for generateLogosZipController`);
      res.status(400).json({ 
        message: "Invalid extension. Supported extensions: svg, png, psd" 
      });
      return;
    }

    // Générer le ZIP avec toutes les déclinaisons du logo
    const zipBuffer = await brandingService.generateLogosZip(
      userId,
      projectId,
      extension.toLowerCase() as 'svg' | 'png' | 'psd'
    );

    // Configurer les headers pour le téléchargement du ZIP
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="logos-${projectId}-${extension}.zip"`
    );
    res.setHeader("Content-Length", zipBuffer.length);

    // Envoyer le ZIP
    res.send(zipBuffer);

    logger.info(
      `ZIP generated and sent successfully - UserId: ${userId}, ProjectId: ${projectId}, Extension: ${extension}`
    );
  } catch (error: any) {
    logger.error(
      `Error in generateLogosZipController - UserId: ${userId}, ProjectId: ${projectId}, Extension: ${extension}: ${error.message}`,
      { stack: error.stack }
    );

    // Gestion des erreurs spécifiques
    if (error.message.includes('Project not found')) {
      res.status(404).json({
        message: "Project not found",
        error: error.message,
      });
    } else if (error.message.includes('No logo found') || error.message.includes('No logo variations found')) {
      res.status(404).json({
        message: "No logo variations found for this project",
        error: error.message,
      });
    } else {
      res.status(500).json({
        message: "Error generating logos ZIP",
        error: error.message,
      });
    }
  }
};

/**
 * Contrôleur pour éditer un logo existant avec AI
 */
export const editLogoController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const { logosvg, modificationPrompt } = req.body;
  const userId = req.user?.uid;
  
  logger.info(
    `editLogoController called - UserId: ${userId}, ProjectId: ${projectId}`,
    { modificationPrompt: modificationPrompt?.substring(0, 100) }
  );

  try {
    if (!userId) {
      logger.warn("User not authenticated for editLogoController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn("Project ID is required for editLogoController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    if (!logosvg) {
      logger.warn("Logo SVG is required for editLogoController");
      res.status(400).json({ message: "Logo SVG is required" });
      return;
    }

    if (!modificationPrompt) {
      logger.warn("Modification prompt is required for editLogoController");
      res.status(400).json({ message: "Modification prompt is required" });
      return;
    }

    // Éditer le logo avec AI
    const result = await brandingService.editLogo(
      userId,
      projectId,
      logosvg,
      modificationPrompt
    );

    logger.info(
      `Successfully edited logo - UserId: ${userId}, ProjectId: ${projectId}`
    );
    
    userService.incrementUsage(userId, 2);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(
      `Error in editLogoController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );

    res.status(500).json({
      message: "Error editing logo",
      error: error.message,
    });
  }
};
