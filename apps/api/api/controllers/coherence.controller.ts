import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import logger from '../config/logger';
import { coherenceService } from '../services/coherence/coherence.service';
import { COHERENCE_RULES, getRule } from '../services/coherence/coherence-rules';

function requireAuth(req: CustomRequest, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return null;
  }
  return userId;
}

/** GET /project/coherence/:projectId?status= — alertes de cohérence (ouvertes par défaut). */
export const listCoherenceAlertsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const alerts = await coherenceService.listAlerts(projectId as string, userId, { status });
    res.status(200).json({ projectId, alerts, rules: COHERENCE_RULES.map((r) => r.id) });
  } catch (error: any) {
    logger.error(`listCoherenceAlertsController error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

/** POST /project/coherence/:projectId/check { ruleId? } — force un audit immédiat. */
export const runCoherenceCheckController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId } = req.params;
  try {
    const ruleId = req.body?.ruleId ? String(req.body.ruleId) : undefined;
    const ruleIds = ruleId ? [ruleId] : COHERENCE_RULES.map((r) => r.id);

    if (ruleId && !getRule(ruleId)) {
      res.status(400).json({
        message: `Règle inconnue "${ruleId}". Règles disponibles: ${COHERENCE_RULES.map((r) => r.id).join(', ')}`,
      });
      return;
    }

    const results = [];
    for (const id of ruleIds) {
      const alert = await coherenceService.checkRule(userId, projectId as string, id);
      results.push({ ruleId: id, coherent: alert === null, alert });
    }
    res.status(200).json({ projectId, results });
  } catch (error: any) {
    logger.error(`runCoherenceCheckController error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

/** POST /project/coherence/:projectId/:alertId/apply { proposalId } */
export const applyCoherenceProposalController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId, alertId } = req.params;
  try {
    const proposalId = req.body?.proposalId ? String(req.body.proposalId) : '';
    if (!proposalId) {
      res.status(400).json({ message: 'Corps attendu: { "proposalId": "<id>" }' });
      return;
    }
    const result = await coherenceService.applyProposal(
      userId,
      projectId as string,
      alertId as string,
      proposalId
    );
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`applyCoherenceProposalController error: ${error.message}`);
    const status = error.message?.includes('introuvable')
      ? 404
      : error.message?.includes('ouverte') || error.message?.includes('cours d')
        ? 409 // conflit d'état: déjà appliquée/rejetée/en cours (course concurrente)
        : 400;
    res.status(status).json({ message: error.message });
  }
};

/** POST /project/coherence/:projectId/:alertId/dismiss */
export const dismissCoherenceAlertController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { projectId, alertId } = req.params;
  try {
    await coherenceService.dismissAlert(userId, projectId as string, alertId as string);
    res.status(200).json({ message: 'Alerte rejetée.' });
  } catch (error: any) {
    logger.error(`dismissCoherenceAlertController error: ${error.message}`);
    const status = error.message?.includes('introuvable')
      ? 404
      : error.message?.includes('ouverte')
        ? 409 // conflit d'état: déjà appliquée/rejetée/en cours
        : 500;
    res.status(status).json({ message: error.message });
  }
};
