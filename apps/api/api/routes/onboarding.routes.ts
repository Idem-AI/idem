import { Router } from 'express';
import {
  generateOnboardingQuestionsController,
  parseOnboardingAnswerController,
} from '../controllers/onboarding.controller';
import { authenticate } from '../services/auth.service';
import { checkQuota } from '../middleware/quota.middleware';

export const onboardingRoutes = Router();

/** Generate the AI-driven question plan for a project being created */
onboardingRoutes.post(
  '/onboarding/questions',
  authenticate,
  checkQuota,
  generateOnboardingQuestionsController
);

/** Parse a free-text answer into a structured option value */
onboardingRoutes.post(
  '/onboarding/parse',
  authenticate,
  checkQuota,
  parseOnboardingAnswerController
);
