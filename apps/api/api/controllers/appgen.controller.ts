import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { v4 as uuidv4 } from 'uuid';
import RedisConnection from '../config/redis.config';
import logger from '../config/logger';

const HANDOFF_TTL_SECONDS = 15 * 60; // 15 minutes
const HANDOFF_KEY_PREFIX = 'appgen:handoff:';

/**
 * POST /appgen/handoff
 * Stores an AppGen generation payload in Redis and returns a handoffId.
 * iDeploy reads it at GET /api/ideploy/handoff/:handoffId
 */
export const createHandoffController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  logger.info('AppGen handoff requested', { userId });

  try {
    const { draftId, appName, description, files, metadata, messages, generatedAt, source, target, expiresAt } =
      req.body;

    if (!files || typeof files !== 'object') {
      res.status(400).json({ success: false, message: 'files is required' });
      return;
    }

    const handoffId = uuidv4();
    const handoffData = {
      handoffId,
      userId: userId || null,
      draftId,
      appName: appName || 'Mon Application',
      description: description || '',
      files,
      metadata: metadata || {},
      messages: messages || [],
      generatedAt: generatedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: source || 'appgen',
      target: target || 'ideploy',
      expiresAt: expiresAt || new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000).toISOString(),
    };

    try {
      const redis = RedisConnection.getInstance();
      await redis.set(
        `${HANDOFF_KEY_PREFIX}${handoffId}`,
        JSON.stringify(handoffData),
        'EX',
        HANDOFF_TTL_SECONDS
      );
      logger.info('Handoff stored in Redis', { handoffId, userId });
    } catch (redisError: any) {
      logger.warn('Redis unavailable, handoff stored only in response', {
        error: redisError.message,
      });
      // Still return the handoffId — iDeploy will fall back to sessionStorage on client side
    }

    res.status(201).json({ success: true, handoffId });
  } catch (error: any) {
    logger.error('Error in createHandoffController:', {
      userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to create handoff',
      error: error.message,
    });
  }
};

/**
 * GET /appgen/handoff/:handoffId
 * Retrieves a handoff payload by ID (consumed by iDeploy).
 */
export const getHandoffController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { handoffId } = req.params;
  logger.info('AppGen handoff fetch', { handoffId });

  try {
    const redis = RedisConnection.getInstance();
    const raw = await redis.get(`${HANDOFF_KEY_PREFIX}${handoffId}`);

    if (!raw) {
      res.status(404).json({ success: false, message: 'Handoff not found or expired' });
      return;
    }

    const handoffData = JSON.parse(raw);
    res.status(200).json({ success: true, data: handoffData });
  } catch (error: any) {
    logger.error('Error in getHandoffController:', {
      handoffId,
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve handoff',
      error: error.message,
    });
  }
};
