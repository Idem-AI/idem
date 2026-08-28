import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { BusinessPlanService } from '../services/BusinessPlan/businessPlan.service';
import { PromptService } from '../services/prompt.service';
import logger from '../config/logger';
import { userService } from '../services/user.service';
import { ISectionResult } from '../services/common/generic.service';
import { projectService } from '../services/project.service';
import { ResearchStreamEvent } from '../services/research/research.types';
import { getRequestLanguage } from '../utils/request-language';
import { sectionEditingService } from '../services/common/section-editing.service';

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
      logger.warn('User not authenticated for getBusinessPlansByProjectController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      logger.warn('Project ID is required for getBusinessPlansByProjectController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const businessPlan = await businessPlanService.getBusinessPlansByProjectId(userId, projectId as string);
    if (businessPlan) {
      logger.info(
        `Business plan fetched successfully for project - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(200).json(businessPlan);
    } else {
      logger.warn(
        `Business plan not found for project - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(404).json({ message: 'Business plan not found for the project' });
    }
  } catch (error: any) {
    logger.error(
      `Error in getBusinessPlansByProjectController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, params: req.params }
    );
    res.status(500).json({
      message: error.message || 'Failed to retrieve business plan items',
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
      logger.warn('User not authenticated for generateBusinessPlanPdfController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    if (!projectId) {
      logger.warn('Project ID is required for generateBusinessPlanPdfController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    // Générer le PDF à partir des sections du business plan
    const pdfPath = await businessPlanService.generateBusinessPlanPdf(userId, projectId as string);

    if (pdfPath === '') {
      res.status(404).json({ message: 'No business plan found' });
      return;
    }

    // Lire le fichier PDF généré
    const fs = require('fs-extra');
    const pdfBuffer = await fs.readFile(pdfPath);

    // Configurer les headers pour le téléchargement du PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="business-plan-${projectId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

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
      message: 'Error generating business plan PDF',
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
      logger.warn('User not authenticated for getBusinessPlanByIdController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    const businessPlan = await businessPlanService.getBusinessPlansByProjectId(userId, projectId as string);
    if (businessPlan) {
      logger.info(
        `Business plan fetched successfully - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(200).json(businessPlan);
    } else {
      logger.warn(`Business plan not found - UserId: ${userId}, ProjectId: ${projectId}`);
      res.status(404).json({ message: 'Business plan not found' });
    }
  } catch (error: any) {
    logger.error(
      `Error in getBusinessPlanByIdController (acting as getByProjectId) - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, params: req.params }
    );
    res.status(500).json({
      message: error.message || 'Failed to retrieve business plan item',
    });
  }
};

export const updateBusinessPlanController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { itemId } = req.params;
  logger.info(`updateBusinessPlanController called - UserId: ${userId}, ItemId: ${itemId}`, {
    body: req.body,
  });
  try {
    if (!userId) {
      logger.warn('User not authenticated for updateBusinessPlanController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    const item = await businessPlanService.updateBusinessPlan(userId, itemId as string, req.body);
    if (item) {
      logger.info(`Business plan updated successfully - UserId: ${userId}, ItemId: ${itemId}`);
      res.status(200).json(item);
    } else {
      logger.warn(`Business plan item not found for update - UserId: ${userId}, ItemId: ${itemId}`);
      res.status(404).json({ message: 'Business plan item not found' });
    }
  } catch (error: any) {
    logger.error(
      `Error in updateBusinessPlanController - UserId: ${userId}, ItemId: ${itemId}: ${error.message}`,
      { stack: error.stack, body: req.body, params: req.params }
    );
    res.status(500).json({
      message: error.message || 'Failed to update business plan item',
    });
  }
};

/**
 * Contrôleur pour sauvegarder les sections éditées dans l'éditeur WYSIWYG.
 * Body: { sections: SectionModel[] }. Persiste sur le projet et invalide le PDF.
 */
export const saveBusinessPlanSectionsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  logger.info(`saveBusinessPlanSectionsController called - UserId: ${userId}, ProjectId: ${projectId}`);
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const { sections } = req.body ?? {};
    if (!Array.isArray(sections)) {
      res.status(400).json({ message: 'A "sections" array is required' });
      return;
    }

    const updated = await sectionEditingService.saveSections(
      userId,
      projectId as string,
      'businessPlan',
      sections
    );
    if (!updated) {
      res.status(404).json({ message: 'Business plan not found for the project' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(
      `Error in saveBusinessPlanSectionsController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({ message: error.message || 'Failed to save business plan sections' });
  }
};

/**
 * Contrôleur d'édition IA d'une section. Body: { instruction: string }.
 * Retourne { section, businessPlan } avec le HTML régénéré par l'IA.
 */
export const aiEditBusinessPlanSectionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId, sectionId } = req.params;
  logger.info(
    `aiEditBusinessPlanSectionController called - UserId: ${userId}, ProjectId: ${projectId}, SectionId: ${sectionId}`
  );
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId || !sectionId) {
      res.status(400).json({ message: 'Project ID and section ID are required' });
      return;
    }
    const instruction = (req.body?.instruction ?? '').toString().trim();
    if (!instruction) {
      res.status(400).json({ message: 'An "instruction" is required' });
      return;
    }

    const result = await sectionEditingService.aiEditSection(
      userId,
      projectId as string,
      'businessPlan',
      sectionId as string,
      instruction,
      getRequestLanguage()
    );
    if (!result) {
      res.status(404).json({ message: 'Section not found or AI edit failed' });
      return;
    }
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(
      `Error in aiEditBusinessPlanSectionController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({ message: error.message || 'Failed to AI-edit business plan section' });
  }
};

export const deleteBusinessPlanController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { itemId } = req.params;
  logger.info(`deleteBusinessPlanController called - UserId: ${userId}, ItemId: ${itemId}`);
  try {
    if (!userId) {
      logger.warn('User not authenticated for deleteBusinessPlanController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    await businessPlanService.deleteBusinessPlan(userId, itemId as string);
    logger.info(`Business plan deleted successfully - UserId: ${userId}, ItemId: ${itemId}`);
    res.status(204).send();
  } catch (error: any) {
    logger.error(
      `Error in deleteBusinessPlanController - UserId: ${userId}, ItemId: ${itemId}: ${error.message}`,
      { stack: error.stack, params: req.params }
    );
    res.status(500).json({
      message: error.message || 'Failed to delete business plan item',
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
      logger.warn('User not authenticated for generateBusinessPlanStreamingController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    if (!projectId) {
      logger.warn('Project ID is required for generateBusinessPlanStreamingController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    // Configuration pour SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Pour Nginx

    // Écriture d'un message SSE (avec flush immédiat).
    const writeSSE = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      (res as any).flush?.();
    };

    // Callback de l'ancien flux (mode classic) — conservé en repli.
    const streamCallback = async (stepResult: ISectionResult) => {
      try {
        const eventType = stepResult.parsedData?.status || 'progress';
        writeSSE({
          type: eventType,
          stepName: stepResult.name,
          data: stepResult.data,
          summary: stepResult.summary,
          timestamp: new Date().toISOString(),
          ...(stepResult.parsedData && { parsedData: stepResult.parsedData }),
        });
      } catch (error: any) {
        logger.error(
          `Error streaming step result - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
          { stack: error.stack }
        );
      }
    };

    const forceRegenerate = req.query.force === 'true' || req.body.force === true;
    const useClassic = req.query.mode === 'classic';

    // Sections ciblées à régénérer (ex: ?sections=Financial%20Plan,Appendix)
    const sectionsParam = typeof req.query.sections === 'string' ? req.query.sections : '';
    const targetSections = sectionsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Fetch project to see if this is a retry/resume
    const project = await projectService.getUserProjectById(userId, projectId as string);
    const isRetry = !!(
      project &&
      !forceRegenerate &&
      (project.analysisResultModel?.businessPlan?.sections?.length ?? 0) > 0
    );

    let updatedProject;
    if (useClassic) {
      updatedProject = await businessPlanService.generateBusinessPlanWithStreaming(
        userId,
        projectId as string,
        streamCallback,
        forceRegenerate,
        targetSections
      );
    } else {
      // Nouveau flux: équipe d'agents de recherche sourcée + salle de contrôle.
      // Chaque ResearchStreamEvent est diffusé tel quel au frontend.
      const emit = async (event: ResearchStreamEvent) => writeSSE(event);
      updatedProject = await businessPlanService.generateBusinessPlanWithResearchTeam(
        userId,
        projectId as string,
        emit,
        forceRegenerate,
        targetSections
      );
    }

    if (!updatedProject) {
      logger.warn(`Failed to generate business plan - UserId: ${userId}, ProjectId: ${projectId}`);
      writeSSE({ error: 'Failed to generate business plan' });
      res.end();
      return;
    }

    const newBusinessPlan = updatedProject.analysisResultModel?.businessPlan;

    logger.info(`Business plan generation completed - UserId: ${userId}, ProjectId: ${projectId}`);

    if (!isRetry) {
      userService.incrementUsage(userId, 5);
      logger.info(`Charged 5 credits for user ${userId} on Business Plan completion.`);
    } else {
      logger.info(`Exempted user ${userId} from credit charge because this is a retry/resume.`);
    }

    // Événement métier de fin (le business plan complet).
    writeSSE({ type: 'complete', businessPlan: newBusinessPlan });
    // Événement de fin technique (convention existante → fermeture propre du SSE).
    writeSSE({ type: 'completed', stepName: 'completion', data: 'all_steps_completed' });
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

    logger.info(`Set additional info request from userId: ${userId}, projectId: ${projectId}`);

    if (!userId) {
      logger.warn('Unauthorized set additional info request - no userId');
      res.status(401).json({ message: 'Non autorisé' });
      return;
    }

    if (!projectId) {
      logger.warn('Missing projectId for set additional info');
      res.status(400).json({ message: 'Project ID requis' });
      return;
    }

    // Parse additional infos from request body
    let additionalInfos;
    try {
      // Check if additionalInfos is a string (from multipart) or already an object
      if (typeof req.body.additionalInfos === 'string') {
        additionalInfos = JSON.parse(req.body.additionalInfos);
      } else {
        additionalInfos = req.body;
      }
    } catch (parseError: any) {
      logger.error(`Error parsing additional infos: ${parseError.message}`);
      res.status(400).json({ message: 'Format des informations additionnelles invalide' });
      return;
    }

    // Validate required fields
    if (!additionalInfos.email) {
      logger.warn('Missing required email in additional infos');
      res.status(400).json({ message: 'Email requis dans les informations additionnelles' });
      return;
    }

    if (!additionalInfos.teamMembers || !Array.isArray(additionalInfos.teamMembers)) {
      logger.warn('Missing or invalid teamMembers in additional infos');
      res.status(400).json({
        message: 'Team members requis dans les informations additionnelles',
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
      projectId as string,
      additionalInfos,
      teamMemberImages
    );

    if (!result.project) {
      logger.warn(`Failed to set additional infos for project: ${projectId}`);
      res.status(404).json({ message: 'Projet non trouvé ou échec de la mise à jour' });
      return;
    }

    logger.info(`Additional infos set successfully for project: ${projectId}`);
    res.json({
      message: 'Informations additionnelles mises à jour avec succès',
      project: result.project,
      uploadedImages: result.uploadedImages,
    });
  } catch (error: any) {
    logger.error(`Error in setAdditionalInfoController: ${error.message}`, {
      stack: error.stack,
      body: req.body,
    });
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
};
