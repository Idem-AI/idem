import { Request, Response, Router } from 'express';
import logger from '../config/logger';
import { verifyApiKey } from '../middleware/verifyApiKey';
import { ideployRepairService, repairRequestSchema } from '../services/ideploy-repair/ideploy-repair.service';
import { transactionalEmailService } from '../services/email/email.service';

/**
 * Routes internes appelées par iDeploy (clé `INTERNAL_API_KEY`).
 *
 * iDeploy ne porte pas de configuration SMTP ni de client de modèle : il passe
 * par ici pour envoyer ses e-mails (même serveur SMTP et traçabilité qu'IDEM)
 * et pour que ses réparations suivent le runtime d'agents de la plateforme.
 */
export const ideployRepairRoutes = Router();

ideployRepairRoutes.post('/email', verifyApiKey, async (req: Request, res: Response) => {
  const { to, subject, html, text, template, sender } = req.body ?? {};
  if (!to || !subject || !text) {
    res.status(400).json({ success: false, message: 'to, subject and text are required' });
    return;
  }
  try {
    const result = await transactionalEmailService.send({
      to: String(to),
      subject: String(subject),
      html: html ? String(html) : `<p>${String(text)}</p>`,
      text: String(text),
      template: template ? String(template) : 'ideploy.domain_migration',
      sender: sender === 'support' || sender === 'contact' ? sender : 'no-reply',
    });
    res.json({ success: result.sent, result });
  } catch (error: any) {
    logger.error('iDeploy email delivery failed', { error: error?.message, to });
    res.status(500).json({ success: false, message: error?.message ?? 'Email delivery failed' });
  }
});

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
