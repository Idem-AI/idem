import { Request, Response, Router } from 'express';
import logger from '../config/logger';
import { verifyApiKey } from '../middleware/verifyApiKey';
import { ideployRepairService, repairRequestSchema } from '../services/ideploy-repair/ideploy-repair.service';
import { transactionalEmailService } from '../services/email/email.service';
import { escapeHtml, panel, paragraph, renderEmail } from '../services/email/email-layout';

/**
 * A message iDeploy describes as text, laid out here like every IDEM email
 * (logo attached, light card, one button). Every value is escaped: application
 * names come from users.
 */
interface IdeployLayout {
  title: string;
  subtitle?: string;
  preheader: string;
  paragraphs: string[];
  panels?: { title: string; rows: { label: string; value: string }[] }[];
  cta?: { label: string; url: string };
  footerNote?: string;
}

function renderIdeployLayout(layout: IdeployLayout): string {
  const text = (value: unknown) => escapeHtml(String(value ?? '').slice(0, 2000));
  const body = [
    ...(layout.paragraphs ?? []).slice(0, 20).map((p) => paragraph(text(p))),
    ...(layout.panels ?? []).slice(0, 200).map((p) =>
      panel(String(p.title ?? '').slice(0, 200), (p.rows ?? []).slice(0, 20).map((r) => ({ label: text(r.label), value: text(r.value) })))
    ),
  ].join('');
  const url = layout.cta?.url && /^https:\/\//.test(String(layout.cta.url)) ? String(layout.cta.url) : null;
  return renderEmail({
    title: String(layout.title ?? '').slice(0, 200),
    subtitle: layout.subtitle ? String(layout.subtitle).slice(0, 300) : undefined,
    preheader: String(layout.preheader ?? '').slice(0, 300),
    body,
    cta: url && layout.cta ? { label: String(layout.cta.label).slice(0, 80), url } : undefined,
    footerNote: layout.footerNote ? String(layout.footerNote).slice(0, 500) : undefined,
  });
}

/**
 * Routes internes appelées par iDeploy (clé `INTERNAL_API_KEY`).
 *
 * iDeploy ne porte pas de configuration SMTP ni de client de modèle : il passe
 * par ici pour envoyer ses e-mails (même serveur SMTP et traçabilité qu'IDEM)
 * et pour que ses réparations suivent le runtime d'agents de la plateforme.
 */
export const ideployRepairRoutes = Router();

ideployRepairRoutes.post('/email', verifyApiKey, async (req: Request, res: Response) => {
  const { to, subject, html, text, template, sender, layout } = req.body ?? {};
  if (!to || !subject || !text) {
    res.status(400).json({ success: false, message: 'to, subject and text are required' });
    return;
  }
  try {
    const result = await transactionalEmailService.send({
      to: String(to),
      subject: String(subject),
      html: layout && typeof layout === 'object' ? renderIdeployLayout(layout as IdeployLayout) : html ? String(html) : `<p>${escapeHtml(text)}</p>`,
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
