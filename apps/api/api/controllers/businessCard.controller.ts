import { Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { BusinessCardService } from '../services/BandIdentity/businessCard.service';
import { PromptService } from '../services/prompt.service';
import { sectionEditingService } from '../services/common/section-editing.service';
import { getRequestLanguage } from '../utils/request-language';
import {
  BusinessCardExport,
  BusinessCardOrientation,
  BusinessCardSide,
} from '../models/businessCard.model';

const promptService = new PromptService();
const businessCardService = new BusinessCardService(promptService);

/** Vérifie l'authentification et la présence du projet ; renvoie null si KO. */
function requireContext(req: CustomRequest, res: Response): { userId: string; projectId: string } | null {
  const userId = req.user?.uid;
  const projectId = req.params.projectId as string;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return null;
  }
  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required' });
    return null;
  }
  return { userId, projectId };
}

/** GET /project/business-cards/:projectId — modèle complet (template + personnes). */
export const getBusinessCardController = async (req: CustomRequest, res: Response): Promise<void> => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  try {
    const card = await businessCardService.getBusinessCard(ctx.userId, ctx.projectId);
    if (!card) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(card);
  } catch (error: any) {
    logger.error(`getBusinessCardController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to load business cards' });
  }
};

/** POST /project/business-cards/:projectId/generate — génère le template IA. */
export const generateBusinessCardTemplateController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  try {
    const orientation = req.body?.orientation as BusinessCardOrientation | undefined;
    const card = await businessCardService.generateTemplate(ctx.userId, ctx.projectId, {
      orientation: orientation === 'portrait' ? 'portrait' : 'landscape',
      styleBrief: typeof req.body?.styleBrief === 'string' ? req.body.styleBrief : undefined,
      language: getRequestLanguage(),
    });
    res.status(200).json(card);
  } catch (error: any) {
    if (error.message === 'BRANDING_REQUIRED') {
      res.status(409).json({ message: 'A brand identity is required before generating cards' });
      return;
    }
    logger.error(`generateBusinessCardTemplateController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to generate business card template' });
  }
};

/** PUT /project/business-cards/:projectId/sections — sauvegarde depuis l'éditeur. */
export const saveBusinessCardSectionsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  try {
    const { sections } = req.body ?? {};
    if (!Array.isArray(sections)) {
      res.status(400).json({ message: 'A "sections" array is required' });
      return;
    }
    const updated = await sectionEditingService.saveSections(
      ctx.userId,
      ctx.projectId,
      'businessCard',
      sections
    );
    if (!updated) {
      res.status(404).json({ message: 'Business card template not found for the project' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`saveBusinessCardSectionsController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to save business card template' });
  }
};

/** POST /project/business-cards/:projectId/sections/:sectionId/ai-edit — édition IA. */
export const aiEditBusinessCardSectionController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  const sectionId = req.params.sectionId as string;
  try {
    const instruction = (req.body?.instruction ?? '').toString().trim();
    if (!sectionId || !instruction) {
      res.status(400).json({ message: 'Section ID and instruction are required' });
      return;
    }
    const result = await sectionEditingService.aiEditSection(
      ctx.userId,
      ctx.projectId,
      'businessCard',
      sectionId,
      instruction,
      getRequestLanguage()
    );
    if (!result) {
      res.status(404).json({ message: 'Section not found or AI edit failed' });
      return;
    }
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`aiEditBusinessCardSectionController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to AI-edit business card template' });
  }
};

/** POST /project/business-cards/:projectId/holders — ajoute une personne. */
export const addBusinessCardHolderController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  try {
    const fullName = (req.body?.fullName ?? '').toString().trim();
    if (!fullName) {
      res.status(400).json({ message: 'A "fullName" is required' });
      return;
    }
    const holder = await businessCardService.addHolder(ctx.userId, ctx.projectId, req.body);
    res.status(201).json(holder);
  } catch (error: any) {
    logger.error(`addBusinessCardHolderController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to add card holder' });
  }
};

/** PUT /project/business-cards/:projectId/holders/:holderId — met à jour une personne. */
export const updateBusinessCardHolderController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  const { holderId } = req.params;
  try {
    const holder = await businessCardService.updateHolder(
      ctx.userId,
      ctx.projectId,
      holderId as string,
      req.body ?? {}
    );
    if (!holder) {
      res.status(404).json({ message: 'Card holder not found' });
      return;
    }
    res.status(200).json(holder);
  } catch (error: any) {
    logger.error(`updateBusinessCardHolderController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to update card holder' });
  }
};

/** DELETE /project/business-cards/:projectId/holders/:holderId — supprime une personne. */
export const deleteBusinessCardHolderController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  const { holderId } = req.params;
  try {
    const removed = await businessCardService.deleteHolder(
      ctx.userId,
      ctx.projectId,
      holderId as string
    );
    if (!removed) {
      res.status(404).json({ message: 'Card holder not found' });
      return;
    }
    res.status(200).json({ message: 'Card holder deleted' });
  } catch (error: any) {
    logger.error(`deleteBusinessCardHolderController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to delete card holder' });
  }
};

/**
 * GET /project/business-cards/:projectId/holders/:holderId/render?side=&format=
 * Rend la carte d'une personne (PNG 300 dpi ou PDF aux dimensions exactes).
 */
export const renderBusinessCardController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  const { holderId } = req.params;
  try {
    const side: BusinessCardSide = req.query.side === 'back' ? 'back' : 'front';
    const format: BusinessCardExport = req.query.format === 'pdf' ? 'pdf' : 'png';

    const { buffer, fileName } = await businessCardService.renderHolderCard(
      ctx.userId,
      ctx.projectId,
      holderId as string,
      side,
      format
    );

    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.status(200).send(buffer);
  } catch (error: any) {
    if (error.message === 'HOLDER_NOT_FOUND' || error.message === 'TEMPLATE_NOT_FOUND') {
      res.status(404).json({ message: error.message });
      return;
    }
    logger.error(`renderBusinessCardController: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to render business card' });
  }
};
