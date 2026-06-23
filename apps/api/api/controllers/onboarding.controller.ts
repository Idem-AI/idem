import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { PromptService } from '../services/prompt.service';
import { OnboardingAIService } from '../services/Onboarding/onboarding-ai.service';
import { userService } from '../services/user.service';
import logger from '../config/logger';

const promptService = new PromptService();
const onboardingAIService = new OnboardingAIService(promptService);

/** Génère le plan de questions adapté au projet décrit. */
export const generateOnboardingQuestionsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { description, name, type, language, knownAnswers } = req.body || {};

  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      res.status(400).json({ message: 'description is required' });
      return;
    }

    const questions = await onboardingAIService.generateQuestions(userId, {
      description,
      name,
      type,
      language,
      knownAnswers,
    });
    userService.incrementUsage(userId, 1);
    res.status(200).json({ questions });
  } catch (error: any) {
    logger.error(`generateOnboardingQuestionsController error: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: error.message || 'Failed to generate onboarding questions' });
  }
};

/** Analyse une réponse en texte libre → code d'option pour une question à choix. */
export const parseOnboardingAnswerController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  const { field, question, answerText, options, language } = req.body || {};

  try {
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    if (!answerText || typeof answerText !== 'string' || !answerText.trim()) {
      res.status(400).json({ message: 'answerText is required' });
      return;
    }

    const result = await onboardingAIService.parseAnswer(userId, {
      field,
      question,
      answerText,
      options,
      language,
    });
    userService.incrementUsage(userId, 1);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`parseOnboardingAnswerController error: ${error.message}`, {
      stack: error.stack,
    });
    res.status(500).json({ message: error.message || 'Failed to parse onboarding answer' });
  }
};
