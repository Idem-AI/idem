import { Request, Response, Router } from 'express';
import logger from '../config/logger';
import { verifyApiKey } from '../middleware/verifyApiKey';
import { ideployRepairService, repairRequestSchema } from '../services/ideploy-repair/ideploy-repair.service';

/**
 * Routes internes appelées par iDeploy (clé `INTERNAL_API_KEY`).
 *
 * iDeploy ne porte pas de client de modèle : il passe par ici pour que ses
 * appels suivent le runtime d'agents de la plateforme (étages, contrôle,
 * budget, cache, traces, suivi des coûts) au lieu d'en réinventer un.
 */
export const ideployRepairRoutes = Router();

ideployRepairRoutes.post('/repair', verifyApiKey, async (req: Request, res: Response) => {
  const parsed = repairRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    return;
  }
  try {
    const result = await ideployRepairService.propose(parsed.data);
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('iDeploy repair failed', { error: error?.message, deploymentUuid: parsed.data.deploymentUuid });
    res.status(502).json({ success: false, message: error?.message ?? 'Repair failed' });
  }
});
