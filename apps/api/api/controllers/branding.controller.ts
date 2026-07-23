import { Response } from 'express';
import { BrandingService } from '../services/BandIdentity/branding.service';
import { PromptService } from '../services/prompt.service';
import { CustomRequest } from '../interfaces/express.interface';
import logger from '../config/logger';
import { userService } from '../services/user.service';
import { ISectionResult } from '../services/common/generic.service';
import { projectService } from '../services/project.service';
import { getRequestLanguage } from '../utils/request-language';
import { sectionEditingService } from '../services/common/section-editing.service';

const promptService = new PromptService();
const brandingService = new BrandingService(promptService);

/**
 * Sauvegarde les sections de charte graphique éditées (éditeur WYSIWYG).
 * Body: { sections }. Préserve colors/typography/logo du branding.
 */
export const saveBrandingSectionsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    if (!projectId) { res.status(400).json({ message: 'Project ID is required' }); return; }
    const { sections } = req.body ?? {};
    if (!Array.isArray(sections)) { res.status(400).json({ message: 'A "sections" array is required' }); return; }

    const updated = await sectionEditingService.saveSections(userId, projectId as string, 'branding', sections);
    if (!updated) { res.status(404).json({ message: 'Branding not found for the project' }); return; }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`Error in saveBrandingSectionsController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to save branding sections' });
  }
};

/**
 * Édition IA d'une section de charte graphique. Body: { instruction }.
 */
export const aiEditBrandingSectionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId, sectionId } = req.params;
  try {
    if (!userId) { res.status(401).json({ message: 'User not authenticated' }); return; }
    if (!projectId || !sectionId) { res.status(400).json({ message: 'Project ID and section ID are required' }); return; }
    const instruction = (req.body?.instruction ?? '').toString().trim();
    if (!instruction) { res.status(400).json({ message: 'An "instruction" is required' }); return; }

    const result = await sectionEditingService.aiEditSection(
      userId, projectId as string, 'branding', sectionId as string, instruction, getRequestLanguage()
    );
    if (!result) { res.status(404).json({ message: 'Section not found or AI edit failed' }); return; }
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`Error in aiEditBrandingSectionController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to AI-edit branding section' });
  }
};

export const generateColorsAndTypographyController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const project = req.body.project;
  const userId = req.user?.uid;
  logger.info(`generateColorsAndTypographyController called - UserId: ${userId}`, {
    body: req.body,
  });
  try {
    if (!userId) {
      logger.warn('User not authenticated for generateColorsAndTypographyController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!project) {
      logger.warn('Project data is required for generateColorsAndTypographyController');
      res.status(400).json({ message: 'Project data is required' });
      return;
    }

    const result = await brandingService.generateColorsAndTypography(userId, project);

    if (!result) {
      logger.warn(
        `Failed to generate colors and typography - UserId: ${userId}, ProjectId: ${project.id}`
      );
      res.status(500).json({ message: 'Failed to generate colors and typography' });
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
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      }
    );
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /project/brandings/generate/colors-typography-from-logo
 * Generates color palettes and typography based on an imported logo's colors.
 * Primary colors come from the logo; AI proposes complementary colors and matching typography.
 */
export const generateColorsAndTypographyFromLogoController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { project, logoSvg, logoColors } = req.body;
  const userId = req.user?.uid;
  logger.info(`generateColorsAndTypographyFromLogoController called - UserId: ${userId}`, {
    logoColorsCount: logoColors?.length,
  });
  try {
    if (!userId) {
      logger.warn('User not authenticated for generateColorsAndTypographyFromLogoController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!project) {
      logger.warn('Project data is required for generateColorsAndTypographyFromLogoController');
      res.status(400).json({ message: 'Project data is required' });
      return;
    }
    if (!logoSvg || !logoColors || !Array.isArray(logoColors)) {
      logger.warn('Logo SVG and colors are required');
      res.status(400).json({ message: 'Logo SVG and extracted colors are required' });
      return;
    }

    const result = await brandingService.generateColorsAndTypographyFromLogo(
      userId,
      project,
      logoSvg,
      logoColors
    );

    if (!result) {
      logger.warn(`Failed to generate colors and typography from logo - UserId: ${userId}`);
      res.status(500).json({ message: 'Failed to generate colors and typography from logo' });
      return;
    }

    logger.info(
      `Successfully generated colors and typography from logo - UserId: ${userId}, ProjectId: ${result.project.id}`
    );
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error in generateColorsAndTypographyFromLogoController - UserId: ${userId}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
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
  const userId = req.user?.uid;
  logger.info(
    `generateLogoConceptsController called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      logger.warn('User not authenticated for generateLogoConceptsController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      logger.warn('Project ID is required for generateLogoConceptsController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    const forceRegenerate = req.query.force === 'true' || req.body.force === true;

    // Fetch project to see if this is a retry/resume
    const project = await projectService.getUserProjectById(userId, projectId as string);
    const hasLogos = (project?.analysisResultModel?.branding?.generatedLogos?.length ?? 0) > 0;
    const isRetry = !!(project && !forceRegenerate && hasLogos);

    const logos = await brandingService.generateLogoConcepts(
      userId,
      projectId as string,
      forceRegenerate,
      isRetry
    );

    if (!logos) {
      logger.warn(`Failed to generate logo concepts - UserId: ${userId}, ProjectId: ${projectId}`);
      res.status(500).json({ message: 'Failed to generate logo concepts' });
      return;
    }

    logger.info(
      `Successfully generated logo concepts - UserId: ${userId}, ProjectId: ${projectId}`
    );
    
    if (!isRetry) {
      userService.incrementUsage(userId, 5);
      logger.info(`Charged 5 credits for user ${userId} on Logo Concepts completion.`);
    } else {
      logger.info(`Exempted user ${userId} from credit charge because this is a retry/resume.`);
    }
    res.status(200).json(logos);
  } catch (error) {
    logger.error(
      `Error in generateLogoConceptsController - UserId: ${userId}, ProjectId: ${projectId}`,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      }
    );
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Étape 1 (SSE) : Génère les 3 concepts de logo en streaming temps réel,
 * avec boucle qualité (agent critique → révision). Chaque événement
 * (concept généré, remarques de la critique, révision, finalisation)
 * est poussé au client au fil de l'eau.
 */
export const generateLogoConceptsStreamController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `generateLogoConceptsStreamController called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    const forceRegenerate = req.query.force === 'true';

    // Retry/reprise : pas de re-facturation si des logos existent déjà
    const project = await projectService.getUserProjectById(userId, projectId as string);
    const hasLogos = (project?.analysisResultModel?.branding?.generatedLogos?.length ?? 0) > 0;
    const isRetry = !!(project && !forceRegenerate && hasLogos);

    // Configuration SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Client parti (navigation, sélection anticipée…) → annuler pour économiser les tokens
    req.on('close', () => {
      brandingService.cancelLogoGeneration(userId, projectId as string);
    });

    const streamCallback = async (event: import('../services/BandIdentity/branding.service').ILogoStreamEvent) => {
      try {
        const message = {
          type: 'progress',
          stepName: event.type,
          data: JSON.stringify({
            conceptIndex: event.conceptIndex,
            logo: event.logo,
            critique: event.critique,
            message: event.message,
          }),
          summary: event.critique?.summary || '',
          timestamp: new Date().toISOString(),
          parsedData: { status: 'progress' },
        };
        res.write(`data: ${JSON.stringify(message)}\n\n`);
        (res as any).flush?.();
      } catch (error: any) {
        logger.error(`Error streaming logo event: ${error.message}`);
      }
    };

    // Préférences éventuellement passées en query (formulaire non encore persisté côté projet)
    const prefType = req.query.prefType as string | undefined;
    const preferencesOverride =
      prefType && ['icon', 'name', 'initial'].includes(prefType)
        ? {
            type: prefType as 'icon' | 'name' | 'initial',
            useAIGeneration: true,
            customDescription: (req.query.prefDesc as string | undefined) || undefined,
          }
        : undefined;

    const logos = await brandingService.generateLogoConceptsWithStreaming(
      userId,
      projectId as string,
      streamCallback,
      forceRegenerate,
      preferencesOverride
    );

    if (!isRetry && logos.length > 0) {
      userService.incrementUsage(userId, 5);
      logger.info(`Charged 5 credits for user ${userId} on streamed logo concepts completion.`);
    }

    // Événement de fin (reconnu par le front comme signal de complétion)
    res.write(
      `data: ${JSON.stringify({
        type: 'completed',
        stepName: 'completion',
        data: 'all_steps_completed',
        summary: '',
        timestamp: new Date().toISOString(),
        parsedData: { status: 'completed' },
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    logger.error(
      `Error in generateLogoConceptsStreamController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    try {
      res.write(
        `data: ${JSON.stringify({
          type: 'progress',
          stepName: 'concept_error',
          data: JSON.stringify({ message: error.message }),
          summary: '',
          timestamp: new Date().toISOString(),
          parsedData: { status: 'progress' },
        })}\n\n`
      );
    } catch {
      // headers peut-être non envoyés
    }
    res.end();
  }
};

/**
 * Annule la génération de logos en cours pour un projet
 * (appelé quand l'utilisateur sélectionne un logo pendant la génération).
 */
export const cancelLogoConceptsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    const cancelled = brandingService.cancelLogoGeneration(userId, projectId as string);
    logger.info(
      `cancelLogoConceptsController - UserId: ${userId}, ProjectId: ${projectId}, wasRunning: ${cancelled}`
    );
    res.status(200).json({ success: true, cancelled });
  } catch (error: any) {
    logger.error(`Error in cancelLogoConceptsController: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Étape 2 (SSE) : Génère les déclinaisons du logo sélectionné en streaming,
 * avec boucle qualité (critique fidélité/lisibilité → recoloration bornée).
 * Le logo sélectionné est lu depuis le projet (persisté à la sélection).
 */
export const generateLogoVariationsStreamController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(
    `generateLogoVariationsStreamController called - UserId: ${userId}, ProjectId: ${projectId}`
  );
  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    const forceRegenerate = req.query.force === 'true';

    const project = await projectService.getUserProjectById(userId, projectId as string);
    const hasVariations =
      project?.analysisResultModel?.branding?.logo?.variations?.withText !== undefined;
    const isRetry = !!(project && !forceRegenerate && hasVariations);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Fermeture de la page → annuler pour économiser les tokens
    req.on('close', () => {
      brandingService.cancelLogoVariationsGeneration(userId, projectId as string);
    });

    const streamCallback = async (
      event: import('../services/BandIdentity/branding.service').ILogoVariationStreamEvent
    ) => {
      try {
        const message = {
          type: 'progress',
          stepName: event.type,
          data: JSON.stringify({
            variant: event.variant,
            svg: event.svg,
            critique: event.critique,
            message: event.message,
          }),
          summary: event.critique?.summary || '',
          timestamp: new Date().toISOString(),
          parsedData: { status: 'progress' },
        };
        res.write(`data: ${JSON.stringify(message)}\n\n`);
        (res as any).flush?.();
      } catch (error: any) {
        logger.error(`Error streaming variation event: ${error.message}`);
      }
    };

    const variations = await brandingService.generateLogoVariationsWithStreaming(
      userId,
      projectId as string,
      streamCallback,
      forceRegenerate
    );

    if (!isRetry && Object.keys(variations.withText).length > 0) {
      userService.incrementUsage(userId, 5);
      logger.info(`Charged 5 credits for user ${userId} on streamed logo variations completion.`);
    }

    res.write(
      `data: ${JSON.stringify({
        type: 'completed',
        stepName: 'completion',
        data: 'all_steps_completed',
        summary: '',
        timestamp: new Date().toISOString(),
        parsedData: { status: 'completed' },
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    logger.error(
      `Error in generateLogoVariationsStreamController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    try {
      res.write(
        `data: ${JSON.stringify({
          type: 'progress',
          stepName: 'variation_error',
          data: JSON.stringify({ message: error.message }),
          summary: '',
          timestamp: new Date().toISOString(),
          parsedData: { status: 'progress' },
        })}\n\n`
      );
    } catch {
      // headers peut-être non envoyés
    }
    res.end();
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
      logger.warn('User not authenticated for generateLogoVariationsController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const forceRegenerate = req.query.force === 'true' || req.body.force === true;

    // Fetch project to see if variations already exist
    const project = await projectService.getUserProjectById(userId, projectId as string);
    const existingLogo = project?.analysisResultModel?.branding?.logo;
    const hasVariations = existingLogo?.variations?.withText !== undefined;
    const isRetry = !!(project && !forceRegenerate && hasVariations);

    const variations = await brandingService.generateLogoVariations(
      userId,
      projectId as string,
      selectedLogo,
      forceRegenerate,
      isRetry
    );

    if (!variations) {
      logger.warn(
        `Failed to generate logo variations - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(500).json({ message: 'Failed to generate logo variations' });
      return;
    }

    logger.info(
      `Successfully generated logo variations - UserId: ${userId}, ProjectId: ${projectId}`
    );
    
    if (!isRetry) {
      userService.incrementUsage(userId, 5);
      logger.info(`Charged 5 credits for user ${userId} on Logo Variations completion.`);
    } else {
      logger.info(`Exempted user ${userId} from credit charge because this is a retry/resume.`);
    }
    res.status(200).json({ variations });
  } catch (error) {
    logger.error(
      `Error in generateLogoVariationsController - UserId: ${userId}, ProjectId: ${projectId}`,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      }
    );
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * @deprecated Utiliser generateLogoConceptsController() à la place
 */
export const generateLogosController = async (req: CustomRequest, res: Response): Promise<void> => {
  logger.warn('generateLogosController is deprecated, use generateLogoConceptsController instead');
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
      logger.warn('User not authenticated for getBrandingsByProjectController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      logger.warn('Project ID is required for getBrandingsByProjectController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const branding = await brandingService.getBrandingsByProjectId(userId, projectId as string);

    if (!branding) {
      logger.info(`No branding found - UserId: ${userId}, ProjectId: ${projectId}`);
      res.status(404).json({ message: 'No branding found for this project' });
      return;
    }

    logger.info(`Retrieved branding successfully - UserId: ${userId}, ProjectId: ${projectId}`);
    res.status(200).json(branding);
  } catch (error: any) {
    logger.error(
      `Error in getBrandingsByProjectController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({
      message: 'Error retrieving branding',
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
  logger.info(`getBrandingByIdController called - UserId: ${userId}, BrandingId: ${brandingId}`);
  try {
    if (!userId) {
      logger.warn('User not authenticated for getBrandingByIdController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    const branding = await brandingService.getBrandingById(userId, brandingId as string);
    if (branding) {
      logger.info(`Branding fetched successfully - UserId: ${userId}, BrandingId: ${brandingId}`);
      res.status(200).json(branding);
    } else {
      logger.warn(`Branding not found - UserId: ${userId}, BrandingId: ${brandingId}`);
      res.status(404).json({ message: 'Branding not found' });
    }
  } catch (error: any) {
    logger.error(
      `Error in getBrandingByIdController - UserId: ${userId}, BrandingId: ${brandingId}: ${error.message}`,
      { stack: error.stack, params: req.params }
    );
    res.status(500).json({ message: 'Error fetching branding', error: error.message });
  }
};

export const updateBrandingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;
  logger.info(`updateBrandingController called - UserId: ${userId}, ProjectId: ${projectId}`, {
    body: req.body,
  });
  try {
    if (!userId) {
      logger.warn('User not authenticated for updateBrandingController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      logger.warn('Project ID is required for updateBrandingController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const updatedProject = await brandingService.updateBranding(
      userId,
      projectId as string,
      req.body
    );
    if (!updatedProject) {
      logger.warn(
        `Project not found for branding update - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    logger.info(`Branding updated successfully - UserId: ${userId}, ProjectId: ${projectId}`);
    res.status(200).json(updatedProject.analysisResultModel.branding);
  } catch (error: any) {
    logger.error(
      `Error in updateBrandingController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );
    res.status(500).json({
      message: 'Error updating branding',
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
  logger.info(`deleteBrandingController called - UserId: ${userId}, ProjectId: ${projectId}`);
  try {
    if (!userId) {
      logger.warn('User not authenticated for deleteBrandingController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      logger.warn('Project ID is required for deleteBrandingController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    const success = await brandingService.deleteBranding(userId, projectId as string);

    if (!success) {
      logger.warn(
        `Project not found for branding deletion - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    logger.info(`Branding deleted successfully - UserId: ${userId}, ProjectId: ${projectId}`);
    res.status(204).send();
  } catch (error: any) {
    logger.error(
      `Error in deleteBrandingController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );
    res.status(500).json({
      message: 'Error deleting branding',
      error: error.message,
    });
  }
};

export const generateBrandingStreamingController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const { format } = req.query;
  const userId = req.user?.uid;
  const pdfFormat = (format as string) || 'SLIDE_16_9';
  logger.info(
    `generateBrandingStreamingController called - UserId: ${userId}, ProjectId: ${projectId}, Format: ${pdfFormat}`
  );

  try {
    if (!userId) {
      logger.warn('User not authenticated for generateBrandingStreamingController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    if (!projectId) {
      logger.warn('Project ID is required for generateBrandingStreamingController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    // Configuration pour SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Pour Nginx

    // Fonction de callback pour envoyer chaque résultat d'étape
    const streamCallback = async (stepResult: ISectionResult) => {
      try {
        // Déterminer le type d'événement
        const eventType = stepResult.parsedData?.status || 'progress';

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

    // Appel au service avec le callback de streaming et le format PDF
    const forceRegenerate = req.query.force === 'true' || req.body.force === true;

    // Sections ciblées à régénérer (ex: ?sections=Color%20Palette,Typography)
    const sectionsParam = typeof req.query.sections === 'string' ? req.query.sections : '';
    const targetSections = sectionsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Fetch project to see if this is a retry/resume
    const project = await projectService.getUserProjectById(userId, projectId as string);
    const isRetry = !!(project && !forceRegenerate && (project.analysisResultModel?.branding?.sections?.length ?? 0) > 0);

    const updatedProject = await brandingService.generateBrandingWithStreaming(
      userId,
      projectId as string,
      streamCallback, // Passer le callback de streaming
      pdfFormat, // Passer le format PDF
      forceRegenerate,
      targetSections
    );

    if (!updatedProject) {
      logger.warn(`Failed to generate branding - UserId: ${userId}, ProjectId: ${projectId}`);
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate branding' })}\n\n`);
      res.end();
      return;
    }

    // Obtenir le branding du projet mis à jour
    const newBranding = updatedProject.analysisResultModel?.branding;

    logger.info(`Branding generation completed - UserId: ${userId}, ProjectId: ${projectId}`);
    
    if (!isRetry) {
      userService.incrementUsage(userId, 5);
      logger.info(`Charged 5 credits for user ${userId} on Branding guidelines completion.`);
    } else {
      logger.info(`Exempted user ${userId} from credit charge because this is a retry/resume.`);
    }

    // Envoyer un événement de fin
    res.write(`data: ${JSON.stringify({ type: 'complete', branding: newBranding })}\n\n`);
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
  logger.info(`generateBrandingPdfController called - UserId: ${userId}, ProjectId: ${projectId}`);

  try {
    if (!userId) {
      logger.warn('User not authenticated for generateBrandingPdfController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    if (!projectId) {
      logger.warn('Project ID is required for generateBrandingPdfController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    // Générer le PDF à partir des sections de branding
    const pdfPath = await brandingService.generateBrandingPdf(userId, projectId as string);
    if (pdfPath === '' || !pdfPath) {
      res.status(404).json({ message: 'No Branding  found for thiss project' });
      return;
    }

    // Lire le fichier PDF généré
    const fs = require('fs-extra');
    const pdfBuffer = await fs.readFile(pdfPath);

    // Configurer les headers pour le téléchargement du PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="branding-${projectId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Envoyer le PDF
    res.send(pdfBuffer);

    // NE PAS supprimer le fichier - il est géré par le cache du PdfService
    // Le fichier sera automatiquement nettoyé par le système de cache après expiration

    logger.info(`PDF generated and sent successfully - UserId: ${userId}, ProjectId: ${projectId}`);
  } catch (error: any) {
    logger.error(
      `Error in generateBrandingPdfController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack }
    );

    res.status(500).json({
      message: 'Error generating branding PDF',
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
      logger.warn('User not authenticated for generateLogosZipController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    if (!projectId) {
      logger.warn('Project ID is required for generateLogosZipController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    if (!extension) {
      logger.warn('Extension is required for generateLogosZipController');
      res.status(400).json({ message: 'Extension is required' });
      return;
    }

    // Valider l'extension
    const validExtensions = ['svg', 'png', 'psd'];
    if (!validExtensions.includes((extension as string).toLowerCase())) {
      logger.warn(`Invalid extension: ${extension} for generateLogosZipController`);
      res.status(400).json({
        message: 'Invalid extension. Supported extensions: svg, png, psd',
      });
      return;
    }

    // Générer le ZIP avec toutes les déclinaisons du logo
    const zipBuffer = await brandingService.generateLogosZip(
      userId,
      projectId as string,
      (extension as string).toLowerCase() as 'svg' | 'png' | 'psd'
    );

    // Configurer les headers pour le téléchargement du ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="logos-${projectId}-${extension}.zip"`
    );
    res.setHeader('Content-Length', zipBuffer.length);

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
        message: 'Project not found',
        error: error.message,
      });
    } else if (
      error.message.includes('No logo found') ||
      error.message.includes('No logo variations found')
    ) {
      res.status(404).json({
        message: 'No logo variations found for this project',
        error: error.message,
      });
    } else {
      res.status(500).json({
        message: 'Error generating logos ZIP',
        error: error.message,
      });
    }
  }
};

/**
 * Contrôleur pour éditer un logo existant avec AI
 */
export const editLogoController = async (req: CustomRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { logosvg, modificationPrompt } = req.body;
  const userId = req.user?.uid;

  logger.info(`editLogoController called - UserId: ${userId}, ProjectId: ${projectId}`, {
    modificationPrompt: modificationPrompt?.substring(0, 100),
  });

  try {
    if (!userId) {
      logger.warn('User not authenticated for editLogoController');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    if (!projectId) {
      logger.warn('Project ID is required for editLogoController');
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    if (!logosvg) {
      logger.warn('Logo SVG is required for editLogoController');
      res.status(400).json({ message: 'Logo SVG is required' });
      return;
    }

    if (!modificationPrompt) {
      logger.warn('Modification prompt is required for editLogoController');
      res.status(400).json({ message: 'Modification prompt is required' });
      return;
    }

    // Éditer le logo avec AI
    const result = await brandingService.editLogo(
      userId,
      projectId as string,
      logosvg,
      modificationPrompt
    );

    logger.info(`Successfully edited logo - UserId: ${userId}, ProjectId: ${projectId}`);

    userService.incrementUsage(userId, 2);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(
      `Error in editLogoController - UserId: ${userId}, ProjectId: ${projectId}: ${error.message}`,
      { stack: error.stack, body: req.body }
    );

    res.status(500).json({
      message: 'Error editing logo',
      error: error.message,
    });
  }
};
