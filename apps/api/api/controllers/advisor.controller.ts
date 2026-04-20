import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { AdvisorService } from '../services/Advisor/advisor.service';
import { PromptService } from '../services/prompt.service';
import { userService } from '../services/user.service';
import logger from '../config/logger';

const promptService = new PromptService();
const advisorService = new AdvisorService(promptService);

export const getAdvisorConversationController = async (
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
    const conversation = await advisorService.getConversation(userId, projectId as string);
    res.status(200).json(conversation);
  } catch (error: any) {
    logger.error(`getAdvisorConversationController error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const clearAdvisorConversationController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  try {
    if (!userId) {
      logger.warn('clearAdvisorConversationController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    logger.info(`clearAdvisorConversationController userId=${userId} projectId=${projectId}`);
    await advisorService.clearConversation(userId, projectId as string);
    res.status(204).send();
  } catch (error: any) {
    logger.error(`clearAdvisorConversationController error: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: error.message });
  }
};

export const sendAdvisorMessageController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { projectId } = req.params;
  const { content } = req.body || {};

  try {
    if (!userId) {
      logger.warn('sendAdvisorMessageController: unauthenticated request');
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!projectId) {
      logger.warn(`sendAdvisorMessageController: missing projectId userId=${userId}`);
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      logger.warn(`sendAdvisorMessageController: empty content userId=${userId}`);
      res.status(400).json({ message: 'Message content is required' });
      return;
    }

    logger.info(
      `sendAdvisorMessageController userId=${userId} projectId=${projectId} contentLen=${content.length}`
    );
    const result = await advisorService.sendMessage(userId, projectId as string, content);
    userService.incrementUsage(userId, 1);
    logger.info(`sendAdvisorMessageController success projectId=${projectId}`);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`sendAdvisorMessageController error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message || 'Failed to process advisor message' });
  }
};
