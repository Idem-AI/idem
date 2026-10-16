import logger from '../../config/logger';
import { OPEN_APPROVAL_STATUSES, WHATSAPP_LIMITS, buttonId } from '../../models/whatsapp.model';
import { ApprovalResult, WhatsappApproval, WhatsappApprovalDocument, WhatsappLink, WhatsappLinkDocument } from '../../schemas/whatsapp.schema';
import { CommunicationService } from '../Communication/communication.service';
import { PromptService } from '../prompt.service';
import { NotConnectedError, SocialPublisherService, UnsupportedMediaError, socialPublisherService } from '../social/social-publisher.service';
import { PUBLISH_NETWORKS, PublishNetwork, PublishPayload } from '../social/social-types';
import { whatsappAccess } from './whatsapp-access';
import { WhatsappTransport } from './whatsapp.client';
import { approvalHash, Produced, whatsappContentService, WhatsappContentService } from './whatsapp-content.service';
import { MessageKey, networkLabel, say } from './whatsapp-messages';
import { phoneDec } from './whatsapp-phone';

export type ApproveOutcome = 'published' | 'not_found' | 'not_open' | 'stale' | 'expired' | 'conflict' | 'integrity' | 'not_entitled';

const isDuplicateKey = (error: any): boolean => error?.code === 11000;

/**
 * Le cycle de vie d'une publication validée par WhatsApp.
 *
 *   generating → awaiting → (revising → awaiting)* → approved → publishing → published | partial | failed
 *                       ↘ cancelled | expired
 *
 * Les invariants qui font la sécurité (testés par `check:whatsapp`) :
 *  1. on ne publie que depuis `approved`, atteint UNIQUEMENT par `approve()` ;
 *  2. `approve()` ne réussit que si la demande est `awaiting`, du bon utilisateur, à la VERSION
 *     montrée et avec l'empreinte du contenu inchangée — une retouche invalide donc les anciens
 *     boutons, et une modification de la base entre l'envoi et le « oui » est détectée ;
 *  3. chaque changement d'état est une mise à jour conditionnelle atomique : deux « oui » en
 *     parallèle (double clic, webhook rejoué) ne publient qu'une fois ;
 *  4. le temps ne vaut jamais accord : sans réponse, la demande EXPIRE, elle ne se publie pas ;
 *  5. rien de ce que dit le modèle de langage ne déclenche un changement d'état.
 */
export class WhatsappApprovalService {
  private readonly communication = new CommunicationService(new PromptService());

  constructor(
    private readonly transport: WhatsappTransport,
    private readonly content: WhatsappContentService = whatsappContentService,
    private readonly publisher: SocialPublisherService = socialPublisherService
  ) {}

  // ── Envoi ───────────────────────────────────────────────────────────────

  /** Numéro en clair, uniquement au moment d'envoyer. */
  private phoneOf(link: WhatsappLinkDocument): string | null {
    return link.phoneEnc ? phoneDec(link.phoneEnc, link.userId) : null;
  }

  private windowOpen(link: WhatsappLinkDocument): boolean {
    return Boolean(link.lastInboundAt && Date.now() - link.lastInboundAt.getTime() < WHATSAPP_LIMITS.serviceWindowMs);
  }

  async say(link: WhatsappLinkDocument, key: MessageKey, params: Record<string, string | number> = {}): Promise<void> {
    const to = this.phoneOf(link);
    if (!to) return;
    try {
      await this.transport.sendText(to, say(link.language, key, params));
    } catch {
      // Déjà journalisé par le transport ; un message perdu ne doit pas casser le flux.
    }
  }

  /**
   * Envoie la proposition. Dans la fenêtre de 24 h : média + boutons. Hors fenêtre : un modèle
   * approuvé par Meta avec un bouton « Voir » ; le média suit quand l'utilisateur le touche.
   */
  async deliver(approval: WhatsappApprovalDocument, link: WhatsappLinkDocument): Promise<boolean> {
    const to = this.phoneOf(link);
    if (!to) return false;
    try {
      if (this.windowOpen(link)) {
        await this.sendBundle(approval, link, to);
      } else {
        const template = process.env.WHATSAPP_TEMPLATE_PROPOSAL || 'idem_publication_proposal';
        const sent = await this.transport.sendTemplate(to, template, link.language, [approval.networks.map(networkLabel).join(', ') || '—'], [buttonId('show', String(approval._id), approval.version)]);
        if (sent.messageId) await WhatsappApproval.updateOne({ _id: approval._id }, { $push: { waMessageIds: sent.messageId } });
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Média + légende, puis les trois boutons. */
  async sendBundle(approval: WhatsappApprovalDocument, link: WhatsappLinkDocument, to = this.phoneOf(link)): Promise<void> {
    if (!to) return;
    const lang = link.language;
    const caption = [approval.caption, approval.hashtags.map((t) => `#${t}`).join(' ')].filter(Boolean).join('\n\n');
    const ids: string[] = [];

    if (approval.mediaKind === 'video') {
      const video = await this.content.loadVideo(approval);
      const sent = video.buffer ? await this.transport.sendVideo(to, { buffer: video.buffer }, caption) : await this.transport.sendText(to, `${caption}\n\n${video.link ?? ''}`);
      if (sent.messageId) ids.push(sent.messageId);
    } else {
      const sent = await this.transport.sendImage(to, { buffer: await this.content.loadImage(approval), mimeType: 'image/png' }, caption);
      if (sent.messageId) ids.push(sent.messageId);
    }

    const manual = approval.manualChannels.length ? say(lang, 'proposalManual', { manual: approval.manualChannels.map(networkLabel).join(', ') }) : '';
    const when = approval.kind === 'planned' && approval.forDay ? ` (${approval.forDay})` : '';
    const body = `${say(lang, 'proposal', { when, networks: approval.networks.map(networkLabel).join(', ') || '—' })}${manual}`;
    const id = String(approval._id);
    const buttons = await this.transport.sendButtons(to, body, [
      { id: buttonId('approve', id, approval.version), title: say(lang, 'btnApprove') },
      { id: buttonId('revise', id, approval.version), title: say(lang, 'btnRevise') },
      { id: buttonId('cancel', id, approval.version), title: say(lang, 'btnCancel') },
    ]);
    if (buttons.messageId) ids.push(buttons.messageId);
    if (ids.length) await WhatsappApproval.updateOne({ _id: approval._id }, { $push: { waMessageIds: { $each: ids } } });
  }

  // ── Création ────────────────────────────────────────────────────────────

  /** Rend la demande « awaiting » avec l'empreinte de ce qui va être montré. */
  private async open(approvalId: unknown, produced: Produced): Promise<WhatsappApprovalDocument> {
    const doc = await WhatsappApproval.findById(approvalId);
    if (!doc) throw new Error('approval_missing');
    doc.mediaKind = produced.mediaKind;
    doc.flyerId = produced.flyerId;
    doc.videoId = produced.videoId;
    doc.caption = produced.caption;
    doc.hashtags = produced.hashtags;
    doc.networks = produced.networks;
    doc.manualChannels = produced.manualChannels;
    doc.contentHash = approvalHash(doc);
    doc.status = 'awaiting';
    doc.expiresAt = new Date(Date.now() + WHATSAPP_LIMITS.approvalTtlMs);
    doc.history.push({ at: new Date(), action: 'proposed', version: doc.version, hash: doc.contentHash });
    await doc.save();
    return doc;
  }

  /** Proposition du jour pour un contenu du calendrier. Idempotente : un contenu, un jour, une demande. */
  async proposePlanned(link: WhatsappLinkDocument, projectId: string, contentId: string, day: string): Promise<WhatsappApprovalDocument | null> {
    let approval: WhatsappApprovalDocument;
    try {
      approval = await WhatsappApproval.create({
        userId: link.userId, projectId, contentId, kind: 'planned', forDay: day, mediaKind: 'image', status: 'generating', expiresAt: new Date(Date.now() + 6 * 3_600_000),
      });
    } catch (error) {
      if (isDuplicateKey(error)) return null;
      throw error;
    }
    return this.finish(approval, link, () => this.content.produceForContent(link.userId, projectId, contentId));
  }

  /** Création demandée à la volée par l'utilisateur. */
  async proposeAdhoc(link: WhatsappLinkDocument, projectId: string, brief: string, kind: 'image' | 'video', networks: PublishNetwork[]): Promise<WhatsappApprovalDocument | null> {
    const approval = await WhatsappApproval.create({
      userId: link.userId, projectId, kind: 'adhoc', mediaKind: kind, status: 'generating', networks, expiresAt: new Date(Date.now() + 6 * 3_600_000),
    });
    return this.finish(approval, link, () => this.content.produceAdhoc(link.userId, projectId, brief, kind, networks));
  }

  private async finish(approval: WhatsappApprovalDocument, link: WhatsappLinkDocument, produce: () => Promise<Produced>): Promise<WhatsappApprovalDocument | null> {
    try {
      const open = await this.open(approval._id, await produce());
      if (!(await this.deliver(open, link))) {
        await WhatsappApproval.updateOne({ _id: open._id, status: 'awaiting' }, { $set: { status: 'failed', failureReason: 'send_failed' } });
        return null;
      }
      return open;
    } catch (error: any) {
      logger.error('whatsapp.proposal_failed', { event: 'whatsapp.proposal_failed', approvalId: String(approval._id), error: error?.message });
      await WhatsappApproval.updateOne({ _id: approval._id }, { $set: { status: 'failed', failureReason: error?.message ?? 'generation_failed' } });
      await this.say(link, error?.message === 'quota_exceeded' ? 'quota' : 'generationFailed');
      return null;
    }
  }

  // ── Réponses de l'utilisateur ───────────────────────────────────────────

  /** Les demandes ouvertes d'un utilisateur, de la plus récente à la plus ancienne. */
  async openFor(userId: string): Promise<WhatsappApprovalDocument[]> {
    return WhatsappApproval.find({ userId, status: { $in: OPEN_APPROVAL_STATUSES }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(10);
  }

  /** « Oui, publiez » — l'unique chemin vers la publication. */
  async approve(userId: string, approvalId: string, version?: number): Promise<ApproveOutcome> {
    const doc = await WhatsappApproval.findOne({ _id: approvalId, userId });
    if (!doc) return 'not_found';
    if (doc.status !== 'awaiting') return 'not_open';
    if (doc.expiresAt.getTime() < Date.now()) {
      await this.expire(doc);
      return 'expired';
    }
    if (version !== undefined && version !== doc.version) return 'stale';
    // Ce qui est en base doit être EXACTEMENT ce qui a été montré (légende, média, réseaux, version).
    if (approvalHash(doc) !== doc.contentHash) {
      logger.error('whatsapp.integrity_failed', { event: 'whatsapp.integrity_failed', alert: 'critical', approvalId, userId });
      return 'integrity';
    }
    if (!(await whatsappAccess(userId)).allowed) return 'not_entitled';

    const claimed = await WhatsappApproval.findOneAndUpdate(
      { _id: doc._id, userId, status: 'awaiting', version: doc.version, contentHash: doc.contentHash },
      { $set: { status: 'approved' }, $push: { history: { at: new Date(), action: 'approved', version: doc.version, hash: doc.contentHash } } },
      { new: true }
    );
    if (!claimed) return 'conflict';
    logger.info('whatsapp.approved', { event: 'whatsapp.approved', approvalId, userId, version: claimed.version, networks: claimed.networks });

    await this.publish(claimed);
    return 'published';
  }

  async cancel(userId: string, approvalId: string, version?: number): Promise<boolean> {
    const filter: Record<string, unknown> = { _id: approvalId, userId, status: 'awaiting' };
    if (version !== undefined) filter.version = version;
    const done = await WhatsappApproval.findOneAndUpdate(filter, { $set: { status: 'cancelled' }, $push: { history: { at: new Date(), action: 'cancelled', version: version ?? 0, hash: '' } } });
    return Boolean(done);
  }

  /** L'utilisateur a touché « Modifier » : la demande attend sa consigne. */
  async awaitRevision(userId: string, approvalId: string, version: number): Promise<WhatsappApprovalDocument | null> {
    return WhatsappApproval.findOne({ _id: approvalId, userId, status: 'awaiting', version });
  }

  /**
   * Applique une retouche. Passe par `revising` (verrou) : aucun « oui » ne peut tomber sur une
   * version en cours de modification. La nouvelle version a une nouvelle empreinte ; les anciens
   * boutons deviennent périmés.
   */
  async revise(link: WhatsappLinkDocument, approvalId: string, instruction: string): Promise<'revised' | 'limit' | 'not_open' | 'failed'> {
    const locked = await WhatsappApproval.findOneAndUpdate({ _id: approvalId, userId: link.userId, status: 'awaiting' }, { $set: { status: 'revising' } }, { new: true });
    if (!locked) return 'not_open';
    if (locked.revisions >= WHATSAPP_LIMITS.maxRevisions) {
      await WhatsappApproval.updateOne({ _id: locked._id }, { $set: { status: 'awaiting' } });
      return 'limit';
    }
    try {
      const result = await this.content.revise(locked, instruction);
      locked.caption = result.caption;
      locked.hashtags = result.hashtags;
      locked.flyerId = result.flyerId;
      locked.videoId = result.videoId;
      locked.revisions += 1;
      locked.version += 1;
      locked.contentHash = approvalHash(locked);
      locked.status = 'awaiting';
      locked.expiresAt = new Date(Date.now() + WHATSAPP_LIMITS.approvalTtlMs);
      locked.history.push({ at: new Date(), action: 'revised', version: locked.version, hash: locked.contentHash });
      await locked.save();
      if (!(await this.deliver(locked, link))) return 'failed';
      return 'revised';
    } catch (error: any) {
      logger.error('whatsapp.revise_failed', { event: 'whatsapp.revise_failed', approvalId, error: error?.message });
      // On rend la main : l'ancienne version reste valide, rien n'a changé.
      await WhatsappApproval.updateOne({ _id: locked._id, status: 'revising' }, { $set: { status: 'awaiting' } });
      return 'failed';
    }
  }

  // ── Publication ─────────────────────────────────────────────────────────

  private async publish(approval: WhatsappApprovalDocument): Promise<void> {
    const taken = await WhatsappApproval.findOneAndUpdate({ _id: approval._id, status: 'approved' }, { $set: { status: 'publishing' } }, { new: true });
    if (!taken) return;
    const link = await WhatsappLink.findOne({ userId: taken.userId });
    const results: ApprovalResult[] = [];

    let payload: PublishPayload | null = null;
    try {
      payload = {
        caption: taken.caption,
        hashtags: taken.hashtags,
        mediaKind: taken.mediaKind,
        buffer: taken.mediaKind === 'image' ? await this.content.loadImage(taken) : undefined,
        mimeType: 'image/png',
        publicUrl: await this.content.publicMediaUrl(taken),
      };
    } catch (error: any) {
      logger.error('whatsapp.media_unavailable', { event: 'whatsapp.media_unavailable', approvalId: String(taken._id), error: error?.message });
    }

    for (const network of taken.networks) {
      const at = new Date();
      if (!payload || !(PUBLISH_NETWORKS as readonly string[]).includes(network)) {
        results.push({ network, status: 'failed', error: 'media_unavailable', at });
        continue;
      }
      try {
        const outcome = await this.publisher.publish(taken.userId, taken.projectId, network as PublishNetwork, payload);
        results.push({ network, status: 'published', externalUrl: outcome.externalUrl, at });
      } catch (error) {
        if (error instanceof UnsupportedMediaError) results.push({ network, status: 'manual', at });
        else if (error instanceof NotConnectedError) results.push({ network, status: 'failed', error: 'not_connected', at });
        else results.push({ network, status: 'failed', error: 'publish_failed', at });
      }
    }
    for (const channel of taken.manualChannels) results.push({ network: channel, status: 'manual', at: new Date() });

    const published = results.filter((r) => r.status === 'published').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const status = failed === 0 ? 'published' : published > 0 ? 'partial' : 'failed';
    await WhatsappApproval.updateOne({ _id: taken._id }, { $set: { status, results }, $push: { history: { at: new Date(), action: status, version: taken.version, hash: taken.contentHash } } });
    logger.info('whatsapp.published', { event: 'whatsapp.published', approvalId: String(taken._id), userId: taken.userId, status, results: results.map((r) => `${r.network}:${r.status}`) });

    if (published > 0 && taken.contentId) await this.markPlanned(taken, 'published');
    if (link) await this.report(taken, link, results, payload);
  }

  private async markPlanned(approval: WhatsappApprovalDocument, status: 'published'): Promise<void> {
    try {
      const content = await this.communication.findPlanItem(approval.userId, approval.projectId, approval.contentId!);
      if (content?.planId) await this.communication.updatePlanItem(approval.userId, approval.projectId, content.planId, content.id, { status });
    } catch (error: any) {
      logger.warn('whatsapp.mark_planned_failed', { event: 'whatsapp.mark_planned_failed', error: error?.message });
    }
  }

  /** Compte rendu à l'utilisateur : où c'est publié, ce qu'il doit faire à la main, ce qui a échoué. */
  private async report(approval: WhatsappApprovalDocument, link: WhatsappLinkDocument, results: ApprovalResult[], payload: PublishPayload | null): Promise<void> {
    const lang = link.language;
    const to = this.phoneOf(link);
    if (!to) return;
    const done = results.filter((r) => r.status === 'published');
    try {
      if (done.length) {
        const links = done.filter((r) => r.externalUrl).map((r) => say(lang, 'publishedLink', { network: networkLabel(r.network), url: r.externalUrl! })).join('\n');
        await this.transport.sendText(to, `${say(lang, 'published', { networks: done.map((r) => networkLabel(r.network)).join(', ') })}${links ? `\n${links}` : ''}`);
      }
      for (const result of results) {
        if (result.status === 'failed') {
          await this.transport.sendText(to, say(lang, result.error === 'not_connected' ? 'notConnected' : 'failedNetwork', { network: networkLabel(result.network) }));
        } else if (result.status === 'manual' && payload) {
          await this.transport.sendText(to, say(lang, 'manualStep', { network: networkLabel(result.network) }));
          const caption = [approval.caption, approval.hashtags.map((t) => `#${t}`).join(' ')].filter(Boolean).join('\n\n');
          if (approval.mediaKind === 'image' && payload.buffer) await this.transport.sendImage(to, { buffer: payload.buffer }, caption);
          else await this.transport.sendText(to, caption);
        }
      }
    } catch {
      // Le compte rendu est un confort : la publication, elle, est faite et tracée.
    }
  }

  // ── Expiration ──────────────────────────────────────────────────────────

  private async expire(approval: WhatsappApprovalDocument): Promise<void> {
    const done = await WhatsappApproval.findOneAndUpdate({ _id: approval._id, status: 'awaiting' }, { $set: { status: 'expired' } }, { new: true });
    if (!done) return;
    const link = await WhatsappLink.findOne({ userId: done.userId, status: 'active' });
    // Hors fenêtre de 24 h, aucun texte libre n'est permis : on se tait plutôt que d'enfreindre la règle.
    if (link && this.windowOpen(link)) await this.say(link, 'expired', { day: done.forDay ?? done.createdAt.toISOString().slice(0, 10) });
  }

  /** Expire les demandes sans réponse. Jamais de publication « par défaut ». */
  async expireOverdue(now = new Date()): Promise<number> {
    const overdue = await WhatsappApproval.find({ status: 'awaiting', expiresAt: { $lt: now } }).limit(200);
    for (const approval of overdue) await this.expire(approval);
    // Une génération restée « en cours » trop longtemps est un échec, pas une attente.
    await WhatsappApproval.updateMany({ status: { $in: ['generating', 'revising'] }, updatedAt: { $lt: new Date(now.getTime() - 30 * 60_000) } }, { $set: { status: 'failed', failureReason: 'stuck' } });
    return overdue.length;
  }
}
