import { Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import {
  CommunicationService,
  CommunicationStreamEvent,
} from '../services/Communication/communication.service';
import { PromptService } from '../services/prompt.service';
import {
  CommunicationPlan,
  FlyerFormat,
  VisualIntent,
  ContentChannel,
  SocialNetwork,
  PlanStatus,
  PublicationStatus,
  VisualOrigin,
} from '../models/communication.model';
import { InsufficientCreditsError, StudioService } from '../services/Communication/studio.service';
import { verifyVisualImageToken } from '../services/Communication/visualUrl';
import { SUPPORTED_NETWORKS } from '../services/Connectors/social-providers.config';
import { getRequestLanguage } from '../utils/request-language';

const promptService = new PromptService();
const communicationService = new CommunicationService(promptService);
const studioService = new StudioService(communicationService);

function writeEvent(res: Response, payload: object): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  (res as any).flush?.();
}

function openSseStream(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function requireAuth(req: CustomRequest, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return null;
  }
  return userId;
}

function requireProjectId(req: CustomRequest, res: Response): string | null {
  const projectId = req.params.projectId as string;
  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required' });
    return null;
  }
  return projectId;
}

/**
 * Normalise une valeur de req.query en string simple.
 * req.query peut renvoyer string | string[] | ParsedQs | ParsedQs[].
 */
function queryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0] as string;
  return undefined;
}

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId
// ---------------------------------------------------------------------------
export const getCommunicationController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  try {
    // Version ALLÉGÉE : le HTML des visuels (5 à 15 ko chacun) ne sert qu'à
    // l'éditeur et au rendu. Le transporter ici faisait peser 400 ko l'ouverture
    // du module pour un écran qui n'affiche que des PNG.
    const communication = await communicationService.getCommunicationLight(userId, projectId);
    if (!communication) {
      res.status(200).json({});
      return;
    }
    res.status(200).json(communication);
  } catch (error: any) {
    logger.error(`getCommunicationController error for project ${projectId}: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: error.message || 'Failed to retrieve communication' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/extract-context
// ---------------------------------------------------------------------------
export const extractContextController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  try {
    const force = req.query.force === 'true';
    const context = await communicationService.extractContext(userId, projectId, { force });
    res.status(200).json(context);
  } catch (error: any) {
    logger.error(`extractContextController error for project ${projectId}: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: error.message || 'Failed to extract context' });
  }
};

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/generate-strategy   (SSE)
// ---------------------------------------------------------------------------
export const generateStrategyStreamController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  openSseStream(res);
  const force = req.query.force === 'true';

  try {
    const strategy = await communicationService.generateStrategy(userId, projectId, {
      force,
      streamCallback: async (event: CommunicationStreamEvent) => {
        writeEvent(res, event);
      },
    });
    writeEvent(res, { type: 'complete', payload: { strategy } });
    res.end();
  } catch (error: any) {
    logger.error(`generateStrategyStreamController error: ${error.message}`, { stack: error.stack });
    writeEvent(res, { type: 'error', message: error.message });
    res.end();
  }
};

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/generate-calendar   (SSE)
// ---------------------------------------------------------------------------
export const generateCalendarStreamController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  openSseStream(res);
  const force = req.query.force === 'true';
  // Fix: utiliser queryString() pour normaliser req.query.rhythm
  const rhythm = (queryString(req.query.rhythm) as 'weekly' | 'biweekly' | 'monthly' | undefined) || 'weekly';
  const horizonWeeksRaw = queryString(req.query.horizonWeeks);
  const horizonWeeksParam = horizonWeeksRaw ? Number(horizonWeeksRaw) : 4;
  const horizonWeeks = Number.isFinite(horizonWeeksParam)
    ? Math.min(Math.max(horizonWeeksParam, 1), 12)
    : 4;

  try {
    const calendar = await communicationService.generateCalendar(userId, projectId, {
      force,
      rhythm,
      horizonWeeks,
      streamCallback: async (event: CommunicationStreamEvent) => {
        writeEvent(res, event);
      },
    });
    writeEvent(res, { type: 'complete', payload: { calendar } });
    res.end();
  } catch (error: any) {
    logger.error(`generateCalendarStreamController error: ${error.message}`, { stack: error.stack });
    writeEvent(res, { type: 'error', message: error.message });
    res.end();
  }
};

// ---------------------------------------------------------------------------
// PUT /project/communication/:projectId/strategy
// ---------------------------------------------------------------------------
export const updateStrategyController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  try {
    const updated = await communicationService.updateStrategy(userId, projectId, req.body);
    if (!updated) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`updateStrategyController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to update strategy' });
  }
};

// ---------------------------------------------------------------------------
// PUT /project/communication/:projectId/calendar/:contentId
// ---------------------------------------------------------------------------
export const updateCalendarItemController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const contentId = req.params.contentId as string;
  if (!contentId) {
    res.status(400).json({ message: 'Content ID is required' });
    return;
  }

  try {
    const updated = await communicationService.updateCalendarItem(
      userId,
      projectId,
      contentId,
      req.body
    );
    if (!updated) {
      res.status(404).json({ message: 'Project or calendar not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`updateCalendarItemController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to update calendar item' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/flyer/:contentId   (on-demand)
// ---------------------------------------------------------------------------
export const generateFlyerController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const contentId = req.params.contentId as string;
  if (!contentId) {
    res.status(400).json({ message: 'Content ID is required' });
    return;
  }

  // Fix: normaliser req.query.format avant de le caster
  const format = (req.body?.format || queryString(req.query.format) || 'square') as FlyerFormat;
  const force = req.body?.force === true || req.query.force === 'true';

  try {
    const flyer = await communicationService.generateFlyer(userId, projectId, contentId, {
      format,
      force,
    });
    res.status(200).json(flyer);
  } catch (error: any) {
    logger.error(`generateFlyerController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to generate flyer' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/flyer/:contentId/regenerate
// ---------------------------------------------------------------------------
export const regenerateFlyerController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const contentId = req.params.contentId as string;
  if (!contentId) {
    res.status(400).json({ message: 'Content ID is required' });
    return;
  }

  // Fix: normaliser req.query.format avant de le caster
  const format = (req.body?.format || queryString(req.query.format) || 'square') as FlyerFormat;

  try {
    const flyer = await communicationService.regenerateFlyer(userId, projectId, contentId, format);
    res.status(200).json(flyer);
  } catch (error: any) {
    logger.error(`regenerateFlyerController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to regenerate flyer' });
  }
};

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/moments/suggestions
// ---------------------------------------------------------------------------
export const getMomentSuggestionsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  try {
    const force = req.query.force === 'true';
    const suggestions = await communicationService.getMomentSuggestions(userId, projectId, {
      force,
    });
    res.status(200).json(suggestions);
  } catch (error: any) {
    logger.error(`getMomentSuggestionsController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to get moment suggestions' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/moments
// ---------------------------------------------------------------------------
export const createMomentController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  const occasion = (req.body?.occasion || '').toString().trim();
  if (!occasion) {
    res.status(400).json({ message: 'An occasion is required' });
    return;
  }

  try {
    const moment = await communicationService.createMoment(userId, projectId, {
      occasion,
      occasionDate: req.body?.occasionDate,
      message: req.body?.message,
      intent: req.body?.intent as VisualIntent | undefined,
      channel: req.body?.channel as ContentChannel | undefined,
      source: req.body?.source === 'suggestion' ? 'suggestion' : 'custom',
    });
    res.status(200).json(moment);
  } catch (error: any) {
    logger.error(`createMomentController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to create moment' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/publish
// ---------------------------------------------------------------------------
export const preparePublicationController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  const contentId = (req.body?.contentId || '').toString();
  const network = (req.body?.network || '').toString() as SocialNetwork;
  if (!contentId) {
    res.status(400).json({ message: 'contentId is required' });
    return;
  }
  if (!SUPPORTED_NETWORKS.includes(network)) {
    res.status(400).json({ message: `Unsupported network. Use one of: ${SUPPORTED_NETWORKS.join(', ')}` });
    return;
  }

  try {
    const result = await communicationService.preparePublication(userId, projectId, {
      contentId,
      network,
      flyerId: req.body?.flyerId,
      scheduledFor: req.body?.scheduledFor,
    });
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`preparePublicationController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to prepare publication' });
  }
};

// ---------------------------------------------------------------------------
// PUT /project/communication/:projectId/publish/:publicationId
// ---------------------------------------------------------------------------
export const updatePublicationController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const publicationId = (req.params.publicationId || '').toString();
  if (!publicationId) {
    res.status(400).json({ message: 'publicationId is required' });
    return;
  }

  try {
    const updated = await communicationService.updatePublication(userId, projectId, publicationId, {
      status: req.body?.status as PublicationStatus | undefined,
      externalUrl: req.body?.externalUrl,
      scheduledFor: req.body?.scheduledFor,
    });
    if (!updated) {
      res.status(404).json({ message: 'Publication not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`updatePublicationController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to update publication' });
  }
};

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/flyer/:flyerId/image
// ---------------------------------------------------------------------------
/**
 * PUT /project/communication/:projectId/flyer/:flyerId/html
 * Sauvegarde du visuel retouché dans l'éditeur WYSIWYG.
 */
export const saveFlyerHtmlController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const flyerId = req.params.flyerId as string;

  try {
    const html = (req.body?.html ?? '').toString();
    if (!flyerId || !html.trim()) {
      res.status(400).json({ message: 'Flyer ID and html are required' });
      return;
    }
    const flyer = await communicationService.updateFlyerHtml(userId, projectId, flyerId, html);
    if (!flyer) {
      res.status(404).json({ message: 'Flyer not found' });
      return;
    }
    res.status(200).json(flyer);
  } catch (error: any) {
    logger.error(`saveFlyerHtmlController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to save flyer' });
  }
};

/**
 * POST /project/communication/:projectId/flyer/:flyerId/ai-edit
 * Retouche du visuel par l'IA, à partir d'une consigne en langue naturelle.
 */
export const aiEditFlyerController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const flyerId = req.params.flyerId as string;

  try {
    const instruction = (req.body?.instruction ?? '').toString().trim();
    if (!flyerId || !instruction) {
      res.status(400).json({ message: 'Flyer ID and instruction are required' });
      return;
    }
    const flyer = await communicationService.aiEditFlyer(
      userId,
      projectId,
      flyerId,
      instruction,
      getRequestLanguage()
    );
    if (!flyer) {
      res.status(404).json({ message: 'Flyer not found or AI edit failed' });
      return;
    }
    res.status(200).json(flyer);
  } catch (error: any) {
    logger.error(`aiEditFlyerController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to AI-edit flyer' });
  }
};

export const getFlyerImageController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const flyerId = req.params.flyerId as string;
  if (!flyerId) {
    res.status(400).json({ message: 'Flyer ID is required' });
    return;
  }

  // Cet endpoint ne peut pas être authentifié : une balise <img src> ne porte pas
  // d'en-tête `Authorization`. Le jeton capacitaire remplace l'authentification —
  // sans lui, les visuels d'un projet étaient énumérables (l'id d'un visuel est
  // un slug de modèle suivi d'un horodatage).
  if (!verifyVisualImageToken(projectId, flyerId, queryString(req.query.t))) {
    logger.warn('[Communication] Rejected an unsigned visual image request', {
      projectId,
      flyerId,
    });
    res.status(403).json({ message: 'Invalid or missing image token' });
    return;
  }

  try {
    const buffer = await communicationService.getFlyerImage(projectId, flyerId);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (error: any) {
    logger.error(`getFlyerImageController error: ${error.message}`, { stack: error.stack });
    res.status(404).json({ message: error.message || 'Image not found' });
  }
};

// ===========================================================================
// PÉRIODES
// ===========================================================================

/** Lit une date ISO de la requête, ou `undefined` si elle n'est pas exploitable. */
function isoDate(value: unknown): string | undefined {
  const candidate = typeof value === 'string' ? value.slice(0, 10) : undefined;
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return undefined;
  return Number.isFinite(Date.parse(candidate)) ? candidate : undefined;
}

/** Canaux transmis par le front, nettoyés. */
function channels(value: unknown): ContentChannel[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.filter((item): item is string => typeof item === 'string' && !!item.trim());
  return cleaned.length ? (cleaned as ContentChannel[]) : undefined;
}

function requirePlanId(req: CustomRequest, res: Response): string | null {
  const planId = req.params.planId as string;
  if (!planId) {
    res.status(400).json({ message: 'Plan ID is required' });
    return null;
  }
  return planId;
}

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/plans
// ---------------------------------------------------------------------------
export const listPlansController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  try {
    const plans = await communicationService.listPlans(userId, projectId);
    res.status(200).json(plans);
  } catch (error: any) {
    logger.error(`listPlansController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to list plans' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/plans   (aucune IA, 0 crédit)
// ---------------------------------------------------------------------------
export const createPlanController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  const start = isoDate(req.body?.start);
  const end = isoDate(req.body?.end);
  if (!start || !end) {
    res.status(400).json({ message: 'start and end are required (YYYY-MM-DD)' });
    return;
  }

  try {
    const plan = await communicationService.createPlan(userId, projectId, {
      name: (req.body?.name || '').toString(),
      objective: (req.body?.objective || '').toString(),
      start,
      end,
      kind: req.body?.kind === 'campaign' ? 'campaign' : 'regular',
      postsPerWeek: Number(req.body?.postsPerWeek) || undefined,
      channels: channels(req.body?.channels),
    });
    res.status(201).json(plan);
  } catch (error: any) {
    logger.error(`createPlanController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to create plan' });
  }
};

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/plans/:planId/generate   (SSE)
// ---------------------------------------------------------------------------
export const generatePlanStreamController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const planId = requirePlanId(req, res);
  if (!planId) return;

  openSseStream(res);

  try {
    const plan = await communicationService.generatePlan(userId, projectId, planId, {
      streamCallback: async (event: CommunicationStreamEvent) => {
        writeEvent(res, event);
      },
    });
    writeEvent(res, { type: 'complete', payload: { plan } });
    res.end();
  } catch (error: any) {
    logger.error(`generatePlanStreamController error: ${error.message}`, { stack: error.stack });
    writeEvent(res, { type: 'error', message: error.message });
    res.end();
  }
};

// ---------------------------------------------------------------------------
// PUT /project/communication/:projectId/plans/:planId
// ---------------------------------------------------------------------------
export const updatePlanController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const planId = requirePlanId(req, res);
  if (!planId) return;

  try {
    const updated = await communicationService.updatePlan(userId, projectId, planId, {
      name: req.body?.name,
      objective: req.body?.objective,
      start: isoDate(req.body?.start),
      end: isoDate(req.body?.end),
      postsPerWeek: req.body?.postsPerWeek !== undefined ? Number(req.body.postsPerWeek) : undefined,
      channels: channels(req.body?.channels),
      status: req.body?.status as PlanStatus | undefined,
      brief: req.body?.brief,
    });
    if (!updated) {
      res.status(404).json({ message: 'Plan not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`updatePlanController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to update plan' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /project/communication/:projectId/plans/:planId   (archive)
// ---------------------------------------------------------------------------
export const archivePlanController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const planId = requirePlanId(req, res);
  if (!planId) return;

  try {
    const archived = await communicationService.archivePlan(userId, projectId, planId);
    if (!archived) {
      res.status(404).json({ message: 'Plan not found' });
      return;
    }
    res.status(200).json({ archived: true, planId });
  } catch (error: any) {
    logger.error(`archivePlanController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to archive plan' });
  }
};

// ---------------------------------------------------------------------------
// PUT / POST / DELETE  …/plans/:planId/items[/:itemId]
// ---------------------------------------------------------------------------
export const updatePlanItemController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const planId = requirePlanId(req, res);
  if (!planId) return;
  const itemId = req.params.itemId as string;
  if (!itemId) {
    res.status(400).json({ message: 'Item ID is required' });
    return;
  }

  try {
    const updated = await communicationService.updatePlanItem(
      userId,
      projectId,
      planId,
      itemId,
      req.body || {}
    );
    if (!updated) {
      res.status(404).json({ message: 'Plan or item not found' });
      return;
    }
    res.status(200).json(updated);
  } catch (error: any) {
    logger.error(`updatePlanItemController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to update content' });
  }
};

export const addPlanItemController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const planId = requirePlanId(req, res);
  if (!planId) return;

  const title = (req.body?.title || '').toString().trim();
  if (!title) {
    res.status(400).json({ message: 'title is required' });
    return;
  }

  try {
    const item = await communicationService.addPlanItem(userId, projectId, planId, {
      ...req.body,
      title,
    });
    if (!item) {
      res.status(404).json({ message: 'Plan not found' });
      return;
    }
    res.status(201).json(item);
  } catch (error: any) {
    logger.error(`addPlanItemController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to add content' });
  }
};

export const removePlanItemController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const planId = requirePlanId(req, res);
  if (!planId) return;
  const itemId = req.params.itemId as string;

  try {
    const removed = await communicationService.removePlanItem(userId, projectId, planId, itemId);
    if (!removed) {
      res.status(404).json({ message: 'Content not found' });
      return;
    }
    res.status(200).json({ removed: true, itemId });
  } catch (error: any) {
    logger.error(`removePlanItemController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to remove content' });
  }
};

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/occasions?from&to
// ---------------------------------------------------------------------------
export const getOccasionsController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  const from = isoDate(queryString(req.query.from));
  const to = isoDate(queryString(req.query.to));
  if (!from || !to) {
    res.status(400).json({ message: 'from and to are required (YYYY-MM-DD)' });
    return;
  }

  try {
    const occasions = await communicationService.getOccasions(userId, projectId, from, to, {
      force: req.query.force === 'true',
    });
    res.status(200).json(occasions);
  } catch (error: any) {
    logger.error(`getOccasionsController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to list occasions' });
  }
};

// ===========================================================================
// BIBLIOTHÈQUE DE VISUELS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/visuals
// ---------------------------------------------------------------------------
export const listVisualsController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  try {
    const visuals = await communicationService.listVisuals(userId, projectId, {
      planId: queryString(req.query.planId),
      format: queryString(req.query.format) as FlyerFormat | undefined,
      origin: queryString(req.query.origin) as VisualOrigin | undefined,
    });
    res.status(200).json(visuals);
  } catch (error: any) {
    logger.error(`listVisualsController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to list visuals' });
  }
};

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/visuals/:visualId   (HTML compris)
// ---------------------------------------------------------------------------
export const getVisualController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const visualId = req.params.visualId as string;

  try {
    const visual = await communicationService.getVisual(userId, projectId, visualId);
    if (!visual) {
      res.status(404).json({ message: 'Visual not found' });
      return;
    }
    res.status(200).json(visual);
  } catch (error: any) {
    logger.error(`getVisualController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to read visual' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/visuals   (visuel libre, depuis un brief)
// ---------------------------------------------------------------------------
export const createVisualController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  const brief = (req.body?.brief || '').toString().trim();
  if (!brief) {
    res.status(400).json({ message: 'brief is required' });
    return;
  }

  const variants = Math.min(3, Math.max(1, Number(req.body?.variants) || 1));
  const input = {
    brief,
    format: (req.body?.format || 'square') as FlyerFormat,
    intent: req.body?.intent as VisualIntent | undefined,
    withPhoto: req.body?.withPhoto !== false,
  };

  try {
    const visuals =
      variants > 1
        ? await communicationService.createVisualVariants(userId, projectId, {
            ...input,
            count: variants,
          })
        : [await communicationService.createVisualFromBrief(userId, projectId, input)];
    res.status(201).json(visuals);
  } catch (error: any) {
    logger.error(`createVisualController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to create visual' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/visuals/:visualId/declinate
// ---------------------------------------------------------------------------
export const declinateVisualController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const visualId = req.params.visualId as string;

  const formats = Array.isArray(req.body?.formats) ? (req.body.formats as FlyerFormat[]) : [];
  if (!formats.length) {
    res.status(400).json({ message: 'formats is required' });
    return;
  }

  try {
    const created = await communicationService.declinateVisual(
      userId,
      projectId,
      visualId,
      formats
    );
    res.status(201).json(created);
  } catch (error: any) {
    logger.error(`declinateVisualController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to declinate visual' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/visuals/:visualId/schedule
// ---------------------------------------------------------------------------
export const scheduleVisualController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;
  const visualId = req.params.visualId as string;

  const planId = (req.body?.planId || '').toString();
  const date = isoDate(req.body?.date);
  if (!planId || !date) {
    res.status(400).json({ message: 'planId and date (YYYY-MM-DD) are required' });
    return;
  }

  try {
    const item = await communicationService.scheduleVisual(userId, projectId, {
      visualId,
      planId,
      date,
      channel: req.body?.channel as ContentChannel | undefined,
      caption: req.body?.caption,
    });
    if (!item) {
      res.status(404).json({ message: 'Plan or visual not found' });
      return;
    }
    res.status(200).json(item);
  } catch (error: any) {
    logger.error(`scheduleVisualController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to schedule visual' });
  }
};

// ===========================================================================
// ATELIER
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /project/communication/:projectId/studio
// ---------------------------------------------------------------------------
export const getStudioController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  try {
    const conversation = await studioService.getConversation(userId, projectId);
    res.status(200).json(conversation);
  } catch (error: any) {
    logger.error(`getStudioController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to read the studio conversation' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /project/communication/:projectId/studio
// ---------------------------------------------------------------------------
export const clearStudioController = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  try {
    await studioService.clearConversation(userId, projectId);
    res.status(200).json({ cleared: true });
  } catch (error: any) {
    logger.error(`clearStudioController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to clear the conversation' });
  }
};

// ---------------------------------------------------------------------------
// POST /project/communication/:projectId/studio/message   (SSE)
//
// Un tour de chat peut produire un visuel : une à trois minutes. Le flux SSE
// sert la latence PERÇUE — l'utilisateur voit l'étape en cours, puis le visuel
// apparaître avant le message qui l'accompagne.
//
// La facturation est portée par l'OUTIL appelé, pas par la route : converser est
// gratuit, produire se paie (cf. `StudioService`).
// ---------------------------------------------------------------------------
export const studioMessageController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const projectId = requireProjectId(req, res);
  if (!projectId) return;

  const content = (req.body?.content || '').toString().trim();
  if (!content) {
    res.status(400).json({ message: 'content is required' });
    return;
  }

  openSseStream(res);

  try {
    const reply = await studioService.sendMessage(userId, projectId, content, async (event) => {
      writeEvent(res, event);
    });
    writeEvent(res, {
      type: 'complete',
      payload: {
        userMessage: reply.userMessage,
        assistantMessage: reply.assistantMessage,
        visuals: reply.visuals,
      },
    });
    res.end();
  } catch (error: any) {
    if (error instanceof InsufficientCreditsError) {
      // Le refus voyage DANS le flux : la réponse a déjà ses en-têtes SSE, donc
      // un 402 ne pourrait plus être émis. Le front le traduit en invitation à
      // recharger, comme le 402 du middleware.
      writeEvent(res, {
        type: 'error',
        code: 'payment_required',
        message: 'insufficient_credits',
        cost: error.cost,
        balance: error.balance,
      });
      res.end();
      return;
    }
    logger.error(`studioMessageController error: ${error.message}`, { stack: error.stack });
    writeEvent(res, { type: 'error', message: error.message });
    res.end();
  }
};
