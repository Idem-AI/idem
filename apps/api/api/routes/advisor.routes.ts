import { Router } from 'express';
import {
  getAdvisorConversationController,
  clearAdvisorConversationController,
  sendAdvisorMessageController,
} from '../controllers/advisor.controller';
import { authenticate } from '../services/auth.service';
import { checkQuota } from '../middleware/quota.middleware';
import { checkPolicyAcceptance } from '../middleware/policyCheck.middleware';

export const advisorRoutes = Router();
const resourceName = 'advisor';

/** Get the advisor conversation for a project */
advisorRoutes.get(`/${resourceName}/:projectId`, authenticate, getAdvisorConversationController);

/** Clear the conversation */
advisorRoutes.delete(
  `/${resourceName}/:projectId`,
  authenticate,
  clearAdvisorConversationController
);

/** Send a user message and get assistant reply */
advisorRoutes.post(
  `/${resourceName}/:projectId/messages`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  sendAdvisorMessageController
);
