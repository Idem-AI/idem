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
import { BUSINESS_PLAN_SECTION_CATALOG } from '../services/BusinessPlan/structure/section-catalog';
import {
  BUSINESS_PLAN_TEMPLATES,
  CUSTOM_TEMPLATE_ID,
  DEFAULT_TEMPLATE_ID,
} from '../services/BusinessPlan/structure/templates';
import { MAX_SECTIONS, MIN_SECTIONS } from '../services/BusinessPlan/structure/structure.resolver';

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
 * Retourne la qualité PDF du dernier rendu (sections sous-remplies).
 * Les sections dont le worstFill < 0.60 sont listées ; le frontend peut
 * alors proposer un retry ciblé section par section.
 */
export const getBusinessPlanPdfQualityController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  logger.info(`getBusinessPlanPdfQualityController called - UserId: ${userId}, ProjectId: ${projectId}`);

  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    const pdfQuality = await businessPlanService.getPdfQuality(userId, projectId as string);
    if (!pdfQuality) {
      // Aucun PDF encore généré ou aucun rapport disponible — réponse vide, pas une erreur.
      res.status(200).json({ underFilledSections: [] });
      return;
    }

    res.status(200).json(pdfQuality);
  } catch (error: any) {
    logger.error(
      `Error in getBusinessPlanPdfQualityController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({ message: error.message || 'Failed to retrieve PDF quality' });
  }
};


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


/**
 * Catalogue des structures de business plan.
 *
 * Une seule requête sert TOUT ce dont l'écran de choix a besoin : les modèles
 * prédéfinis (SBA, dossier bancaire, fonds d'amorçage, subvention…), le
 * catalogue des sections composables, et les bornes du composeur libre. Rien
 * n'est traduit ici — les libellés sont des clés i18n côté client, comme
 * partout ailleurs dans l'application.
 *
 * Endpoint public au sens « pas dépendant du projet » : le catalogue est le
 * même pour tout le monde, donc il est mis en cache par le client.
 */
export const getBusinessPlanStructureCatalogController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  try {
    res.status(200).json({
      defaultTemplateId: DEFAULT_TEMPLATE_ID,
      customTemplateId: CUSTOM_TEMPLATE_ID,
      limits: { min: MIN_SECTIONS, max: MAX_SECTIONS },
      templates: BUSINESS_PLAN_TEMPLATES.map((template) => ({
        id: template.id,
        audience: template.audience,
        source: template.source,
        estimatedPages: template.estimatedPages,
        isDefault: !!template.isDefault,
        sectionKeys: template.sectionKeys,
      })),
      sections: BUSINESS_PLAN_SECTION_CATALOG.map((section) => ({
        key: section.key,
        name: section.name,
        category: section.category,
        needsResearch: section.needsResearch,
        // La couverture n'est pas retirable : un plan sans page de garde n'est
        // pas un document qu'on dépose.
        required: !!section.freeform,
      })),
    });
  } catch (error: any) {
    logger.error(`Error in getBusinessPlanStructureCatalogController: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: 'Failed to retrieve business plan structure catalog' });
  }
};

/** Structure actuellement retenue pour le business plan d'un projet. */
export const getBusinessPlanStructureController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    const structure = await businessPlanService.getStructure(userId, projectId as string);
    if (!structure) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(structure);
  } catch (error: any) {
    logger.error(
      `Error in getBusinessPlanStructureController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({ message: error.message || 'Failed to retrieve business plan structure' });
  }
};

/**
 * Enregistre la structure choisie. Body: `{ templateId, sectionKeys? }`.
 *
 * `sectionKeys` omis avec un `templateId` connu = la structure du modèle. Les
 * deux fournis = composition libre, validée contre le catalogue : une clé
 * inconnue est écartée silencieusement, une liste trop courte est refusée en
 * 400. Valider ICI plutôt qu'à la génération évite de faire échouer un run déjà
 * facturé.
 */
export const setBusinessPlanStructureController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    const { templateId, sectionKeys } = req.body ?? {};
    if (typeof templateId !== 'string' || !templateId.trim()) {
      res.status(400).json({ message: 'A "templateId" is required' });
      return;
    }
    if (sectionKeys !== undefined && !Array.isArray(sectionKeys)) {
      res.status(400).json({ message: '"sectionKeys" must be an array of section keys' });
      return;
    }

    const structure = await businessPlanService.saveStructure(
      userId,
      projectId as string,
      templateId.trim(),
      sectionKeys
    );
    if (!structure) {
      res.status(400).json({
        message: `Invalid structure: pick a known template or list between ${MIN_SECTIONS} and ${MAX_SECTIONS} known sections.`,
      });
      return;
    }

    res.status(200).json(structure);
  } catch (error: any) {
    logger.error(
      `Error in setBusinessPlanStructureController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );
    res.status(500).json({ message: error.message || 'Failed to save business plan structure' });
  }
};
