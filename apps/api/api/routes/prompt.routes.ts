import { Router } from 'express';
import { authenticate } from '../services/auth.service';
import { promptController } from '../controllers/prompt.controller';

export const promptRoutes = Router();

// This will be mounted at /prompt
promptRoutes.post('/prompt', authenticate, promptController.handlePromptRequest);
promptRoutes.post(
  '/improve',
  authenticate,
  (req, res) => void promptController.improvePrompt(req as any, res)
);
promptRoutes.post(
  '/feeling-lucky',
  authenticate,
  (req, res) => void promptController.generateFeelingLucky(req as any, res)
);

