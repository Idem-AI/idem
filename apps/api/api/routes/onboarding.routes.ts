import { Router } from 'express';
import {
  generateOnboardingQuestionsController,
  parseOnboardingAnswerController,
} from '../controllers/onboarding.controller';
import { authenticate } from '../services/auth.service';
import { requireQuota } from '../middleware/usage-quota.middleware';

export const onboardingRoutes = Router();

/** Generate the AI-driven question plan for a project being created */
onboardingRoutes.post(
  '/onboarding/questions',
  authenticate,
  requireQuota('assist', { envelope: 'onboarding' }),
  generateOnboardingQuestionsController
);

/** Parse a free-text answer into a structured option value */
onboardingRoutes.post(
  '/onboarding/parse',
  authenticate,
  requireQuota('assist', { envelope: 'onboarding' }),
  parseOnboardingAnswerController
);
