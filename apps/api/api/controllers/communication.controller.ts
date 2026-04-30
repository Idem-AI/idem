import { Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import {
  CommunicationService,
  CommunicationStreamEvent,
} from '../services/Communication/communication.service';
import { PromptService } from '../services/prompt.service';
import { FlyerFormat } from '../models/communication.model';

const promptService = new PromptService();
const communicationService = new CommunicationService(promptService);

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
  const projectId = req.params.projectId;
  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required' });
    return null;
  }
  return projectId;
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
    const communication = await communicationService.getCommunication(userId, projectId);
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
  const rhythm = (req.query.rhythm as 'weekly' | 'biweekly' | 'monthly' | undefined) || 'weekly';
  const horizonWeeksParam = req.query.horizonWeeks ? Number(req.query.horizonWeeks) : 4;
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
  const contentId = req.params.contentId;
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
  const contentId = req.params.contentId;
  if (!contentId) {
    res.status(400).json({ message: 'Content ID is required' });
    return;
  }

  const format = (req.body?.format || req.query.format || 'square') as FlyerFormat;
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
  const contentId = req.params.contentId;
  if (!contentId) {
    res.status(400).json({ message: 'Content ID is required' });
    return;
  }

  const format = (req.body?.format || req.query.format || 'square') as FlyerFormat;

  try {
    const flyer = await communicationService.regenerateFlyer(userId, projectId, contentId, format);
    res.status(200).json(flyer);
  } catch (error: any) {
    logger.error(`regenerateFlyerController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to regenerate flyer' });
  }
};
