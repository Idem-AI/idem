import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import { promptController } from '../controllers/prompt.controller';
import { requireQuota } from '../middleware/usage-quota.middleware';

const promptQuota = requireQuota('assist', { envelope: 'prompt' });

export const promptRoutes = Router();

// This will be mounted at /prompt
promptRoutes.post('/prompt', authenticate, promptQuota, promptController.handlePromptRequest);
promptRoutes.post(
  '/improve',
  authenticate,
  promptQuota,
  (req, res) => void promptController.improvePrompt(req as any, res)
);
promptRoutes.post(
  '/feeling-lucky',
  authenticate,
  promptQuota,
  (req, res) => void promptController.generateFeelingLucky(req as any, res)
);

