import { Request, Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { WhatsappApproval } from '../schemas/whatsapp.schema';
import { whatsappAccess } from '../services/whatsapp/whatsapp-access';
import { parseWebhook } from '../services/whatsapp/whatsapp-conversation.service';
import { whatsappLinkService } from '../services/whatsapp/whatsapp-link.service';
import { whatsappConversation, whatsappDaily, whatsappTransport } from '../services/whatsapp/whatsapp.runtime';
import { verifySubscription, verifyWebhookSignature } from '../services/whatsapp/whatsapp-signature';
import { socialAccountService, isPublishNetwork } from '../services/social/social-account.service';
import { PUBLISH_NETWORKS } from '../services/social/social-types';
import { projectService } from '../services/project.service';

function dashboardUrl(path: string): string {
  return `${process.env.IDEM_FRONTEND_URL || 'http://localhost:4200'}${path}`;
}

export class WhatsappController {
  // ── Webhook (appelé par Meta, non authentifié par session) ───────────────

  /** Abonnement au webhook : Meta vérifie qu'on connaît le jeton. */
  verify = (req: Request, res: Response): void => {
    const challenge = verifySubscription(req.query, process.env.WHATSAPP_VERIFY_TOKEN);
    if (challenge === null) {
      res.sendStatus(403);
      return;
    }
    res.status(200).type('text/plain').send(challenge);
  };

  /**
   * Réception. Ordre voulu : signature d'abord (sur le corps EXACT), puis réponse 200 immédiate,
   * puis traitement hors requête — Meta rejoue tout webhook qui tarde, et générer un visuel prend
   * des minutes.
   */
  receive = (req: Request, res: Response): void => {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!verifyWebhookSignature(raw, req.header('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET)) {
      logger.warn('whatsapp.webhook_rejected', { event: 'whatsapp.webhook_rejected', ip: req.ip });
      res.sendStatus(403);
      return;
    }
    res.sendStatus(200);
    const messages = parseWebhook(req.body, process.env.WHATSAPP_PHONE_NUMBER_ID);
    for (const message of messages) void whatsappConversation.handle(message);
  };

  // ── Utilisateur connecté ─────────────────────────────────────────────────

  status = async (req: CustomRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;
    const [access, link] = await Promise.all([whatsappAccess(userId), whatsappLinkService.get(userId)]);
    const pending = link ? await WhatsappApproval.countDocuments({ userId, status: 'awaiting', expiresAt: { $gt: new Date() } }) : 0;
    res.json({
      available: whatsappTransport.configured,
      entitled: access.allowed,
      reason: access.allowed ? undefined : access.reason,
      linked: link?.status === 'active',
      phoneLast4: link?.status === 'active' ? link.phoneLast4 : undefined,
      dailyProposals: Boolean(link?.dailyProposals),
      sendHour: link?.sendHour ?? 8,
      utcOffsetMinutes: link?.utcOffsetMinutes ?? 60,
      language: link?.language ?? 'fr',
      defaultProjectId: link?.defaultProjectId,
      pending,
      networks: PUBLISH_NETWORKS.map((network) => ({ network, configured: socialAccountService.isConfigured(network) })),
    });
  };

  /** L'utilisateur saisit son numéro : IDEM lui envoie un code par WhatsApp, valable 10 min. */
  startLink = async (req: CustomRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    if (projectId && !(await projectService.getUserProjectById(userId, projectId))) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    if (!whatsappTransport.configured) {
      res.status(503).json({ error: 'whatsapp_unavailable', message: 'WhatsApp n’est pas encore activé sur IDEM.' });
      return;
    }
    const result = await whatsappLinkService.requestCode(userId, phone, projectId);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        invalid_phone: 'Ce numéro ne semble pas valide.',
        not_entitled: 'Publier depuis WhatsApp est réservé aux comptes payants (forfait IDEM Croissance ou Entreprise).',
        phone_in_use: 'Ce numéro est déjà lié à un autre compte IDEM.',
        too_many_attempts: 'Trop de demandes de code. Réessayez dans un moment.',
        send_failed: 'Le code n’a pas pu être envoyé par WhatsApp. Réessayez dans un instant.',
      };
      const status = { invalid_phone: 400, not_entitled: 402, phone_in_use: 409, too_many_attempts: 429, send_failed: 502 }[result.reason];
      res.status(status).json({ error: result.reason, message: messages[result.reason] });
      return;
    }
    res.json({ expiresAt: result.expiresAt });
  };

  /** L'utilisateur recopie le code reçu sur WhatsApp. */
  confirmLink = async (req: CustomRequest, res: Response): Promise<void> => {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const result = await whatsappLinkService.confirmCode(req.user!.uid, code);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        invalid_code: 'Ce code n’est pas valide.',
        expired: 'Ce code a expiré. Demandez-en un nouveau.',
        too_many_attempts: 'Trop d’essais avec ce code. Demandez-en un nouveau.',
      };
      res.status(400).json({ error: result.reason, message: messages[result.reason] });
      return;
    }
    res.json({ ok: true, phoneLast4: result.link.phoneLast4 });
  };

  unlink = async (req: CustomRequest, res: Response): Promise<void> => {
    await whatsappLinkService.unlink(req.user!.uid, 'user');
    res.json({ ok: true });
  };

  updateSettings = async (req: CustomRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;
    const body = req.body ?? {};
    if (typeof body.defaultProjectId === 'string' && !(await projectService.getUserProjectById(userId, body.defaultProjectId))) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    // Les propositions automatiques ne s'activent que pour un compte payant ET avec un projet choisi.
    if (body.dailyProposals === true) {
      if (!(await whatsappAccess(userId)).allowed) {
        res.status(402).json({ error: 'plan_required' });
        return;
      }
      const link = await whatsappLinkService.get(userId);
      if (!body.defaultProjectId && !link?.defaultProjectId) {
        res.status(400).json({ error: 'project_required', message: 'Choisissez un projet.' });
        return;
      }
    }
    const link = await whatsappLinkService.updateSettings(userId, body);
    if (!link) {
      res.status(409).json({ error: 'not_linked' });
      return;
    }
    res.json({ ok: true });
  };

  /** Historique récent des demandes (statut, réseaux, résultat) pour l'écran. */
  history = async (req: CustomRequest, res: Response): Promise<void> => {
    const items = await WhatsappApproval.find({ userId: req.user!.uid }).sort({ createdAt: -1 }).limit(20).select('kind status networks mediaKind caption forDay results createdAt').lean();
    res.json({ items });
  };

  // ── Réseaux sociaux ──────────────────────────────────────────────────────

  accounts = async (req: CustomRequest, res: Response): Promise<void> => {
    const projectId = String(req.query.projectId || '');
    if (!projectId || !(await projectService.getUserProjectById(req.user!.uid, projectId))) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    const accounts = await socialAccountService.list(req.user!.uid, projectId);
    // Jamais de jetons dans la réponse.
    res.json({ accounts: accounts.map((a) => ({ network: a.network, accountName: a.accountName, status: a.status })) });
  };

  connect = async (req: CustomRequest, res: Response): Promise<void> => {
    const network = String(req.params.network);
    const projectId = String(req.query.projectId || '');
    if (!isPublishNetwork(network)) {
      res.status(400).json({ error: 'unknown_network' });
      return;
    }
    if (!(await projectService.getUserProjectById(req.user!.uid, projectId))) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    if (!(await whatsappAccess(req.user!.uid)).allowed) {
      res.status(402).json({ error: 'plan_required' });
      return;
    }
    if (!socialAccountService.isConfigured(network)) {
      res.status(503).json({ error: 'network_unconfigured' });
      return;
    }
    res.json({ url: socialAccountService.authorizeUrl(req.user!.uid, projectId, network) });
  };

  /** Retour d'OAuth : l'état chiffré dit pour qui et pour quel projet. */
  callback = async (req: Request, res: Response): Promise<void> => {
    const state = socialAccountService.readState(String(req.query.state || ''));
    if (!state || !req.query.code) {
      res.redirect(dashboardUrl('/project/communication?social=error'));
      return;
    }
    try {
      await socialAccountService.completeAuthorization(state, String(req.query.code));
      res.redirect(dashboardUrl('/project/communication?social=connected'));
    } catch (error: any) {
      logger.error('social.connect_failed', { event: 'social.connect_failed', network: state.n, error: error?.message });
      res.redirect(dashboardUrl('/project/communication?social=error'));
    }
  };

  disconnect = async (req: CustomRequest, res: Response): Promise<void> => {
    const network = String(req.params.network);
    const projectId = String(req.query.projectId || '');
    if (!isPublishNetwork(network) || !(await projectService.getUserProjectById(req.user!.uid, projectId))) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    await socialAccountService.revoke(req.user!.uid, projectId, network);
    res.json({ ok: true });
  };

  // ── Interne ──────────────────────────────────────────────────────────────

  internalRun = async (_req: Request, res: Response): Promise<void> => {
    res.json(await whatsappDaily.run());
  };
}

export default new WhatsappController();
