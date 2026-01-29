import { Router, Request, Response } from 'express';
import { modelConfig, getDefaultModelKey } from '../config/modelConfig.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  return res.json(modelConfig);
});

router.get('/config', (req: Request, res: Response) => {
  return res.json(modelConfig);
});

router.get('/default', (req: Request, res: Response) => {
  return res.json({
    modelKey: getDefaultModelKey(),
  });
});

export default router;
