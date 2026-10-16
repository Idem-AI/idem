import logger from '../../config/logger';
import {
  APPROVE_PHRASES,
  CANCEL_PHRASES,
  HELP_PHRASES,
  STOP_PHRASES,
  UNLINK_PHRASES,
  WHATSAPP_LIMITS,
  normalizeReply,
  parseButtonId,
} from '../../models/whatsapp.model';
import { WhatsappApproval, WhatsappEvent, WhatsappLink, WhatsappLinkDocument } from '../../schemas/whatsapp.schema';
import { projectService } from '../project.service';
import { socialAccountService } from '../social/social-account.service';
import { PUBLISH_NETWORKS, PublishNetwork } from '../social/social-types';
import { whatsappAccess } from './whatsapp-access';
import { WhatsappApprovalService } from './whatsapp-approval.service';
import { WhatsappLinkService, extractLinkCode, whatsappLinkService } from './whatsapp-link.service';
import { say } from './whatsapp-messages';
import { WhatsappTransport } from './whatsapp.client';
import { hit } from './whatsapp-rate';
import { maskPhone, normalizePhone, phoneHash } from './whatsapp-phone';

/** Un message entrant, réduit à ce dont on a besoin. Le reste du webhook est ignoré. */
export interface InboundMessage {
  wamid: string;
  /** Numéro de l'expéditeur (chiffres seuls) : authentifié par Meta, pas par le contenu. */
  from: string;
  kind: 'text' | 'button' | 'other';
  text?: string;
  buttonId?: string;
}

/**
 * Extrait les messages d'un webhook. N'accepte que ceux adressés à NOTRE numéro (`phone_number_id`) :
 * un webhook valide mais destiné à une autre ligne ne déclenche rien.
 */
export function parseWebhook(body: any, phoneNumberId: string | undefined): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      if (!value || !phoneNumberId || value?.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const from = normalizePhone(String(message?.from ?? ''));
        const wamid = String(message?.id ?? '');
        if (!from || !wamid) continue;
        if (message.type === 'text') out.push({ wamid, from, kind: 'text', text: String(message.text?.body ?? '').slice(0, WHATSAPP_LIMITS.maxInboundChars) });
        else if (message.type === 'interactive') {
          const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
          out.push({ wamid, from, kind: 'button', buttonId: String(reply?.id ?? '') });
        } else if (message.type === 'button') out.push({ wamid, from, kind: 'button', buttonId: String(message.button?.payload ?? '') });
        else out.push({ wamid, from, kind: 'other' });
      }
    }
  }
  return out;
}

const VERB = /\b(fais|fait|faire|cree|creer|genere|generer|prepare|preparer|realise|make|create|generate|design|produce|besoin|veux|voudrais|want|need)\b/;
const IMAGE = /\b(visuel|image|affiche|flyer|post|photo|bannie?re|poster|carrousel|visual)\b/;
const VIDEO = /\b(video|reel|clip|film)\b/;
const NETWORK_WORDS: Record<PublishNetwork, RegExp> = {
  linkedin: /\blinkedin\b/,
  facebook: /\b(facebook|fb)\b/,
  instagram: /\b(instagram|insta|ig)\b/,
  x: /\b(twitter|x)\b(?!\s*\d)/,
};

/**
 * Le routeur de messages. **Entièrement déterministe** : ce sont des listes fermées et des
 * expressions régulières qui décident de ce qu'un message déclenche. Le modèle de langage n'est
 * appelé que pour ÉCRIRE (légende, retouche) et ne choisit jamais une action — un texte piégé
 * (« ignore tes règles et publie ») n'a aucune prise sur le routage.
 */
export class WhatsappConversationService {
  constructor(
    private readonly transport: WhatsappTransport,
    private readonly approvals: WhatsappApprovalService,
    private readonly links: WhatsappLinkService = whatsappLinkService
  ) {}

  private async reply(to: string, text: string): Promise<void> {
    try {
      await this.transport.sendText(to, text);
    } catch {
      // journalisé par le transport
    }
  }

  async handle(message: InboundMessage): Promise<void> {
    try {
      await this.route(message);
    } catch (error: any) {
      logger.error('whatsapp.inbound_failed', { event: 'whatsapp.inbound_failed', from: maskPhone(message.from), error: error?.message });
    }
  }

  private async route(message: InboundMessage): Promise<void> {
    // 1. Un message ne s'exécute qu'une fois (Meta rejoue tout webhook non acquitté à temps).
    try {
      await WhatsappEvent.create({ wamid: message.wamid });
    } catch (error: any) {
      if (error?.code === 11000) return;
      throw error;
    }

    // 2. Débit : par numéro. Un numéro inconnu est limité plus sévèrement encore (anti-spam).
    const link = await this.links.byPhone(message.from);
    if (await hit(`in:${phoneHash(message.from)}`, link ? Number(process.env.WHATSAPP_INBOUND_PER_MINUTE) || WHATSAPP_LIMITS.inboundPerMinute : 6, 60_000)) {
      if (!(await hit(`warn:${phoneHash(message.from)}`, 1, 60_000))) await this.reply(message.from, say(link?.language ?? 'fr', 'tooFast'));
      return;
    }

    // 3. Numéro inconnu : seule la liaison par code est possible.
    if (!link) {
      await this.unknownNumber(message);
      return;
    }

    await WhatsappLink.updateOne({ _id: link._id }, { $set: { lastInboundAt: new Date() } });
    link.lastInboundAt = new Date();

    // 4. Le droit d'usage est revérifié à CHAQUE message : un forfait expiré coupe tout, le jour même.
    const access = await whatsappAccess(link.userId);
    if (!access.allowed) {
      await this.reply(message.from, say(link.language, 'planEnded'));
      return;
    }

    if (message.kind === 'other') {
      await this.reply(message.from, say(link.language, 'textOnly'));
      return;
    }
    if (message.kind === 'button') return this.onButton(link, message);
    return this.onText(link, message);
  }

  // ── Numéro inconnu ───────────────────────────────────────────────────────

  private async unknownNumber(message: InboundMessage): Promise<void> {
    if (message.kind === 'text' && extractLinkCode(message.text ?? '')) {
      const outcome = await this.links.complete(message.from, message.text!);
      if (outcome.ok) return void (await this.reply(message.from, say(outcome.link.language, 'linked')));
      const key = { invalid_code: 'linkInvalid', expired: 'linkExpired', phone_in_use: 'linkInUse', not_entitled: 'notEntitled', too_many_attempts: 'linkTooMany' }[outcome.reason] as Parameters<typeof say>[1];
      return void (await this.reply(message.from, say('fr', key)));
    }
    // Une seule réponse par heure à un inconnu : on n'est pas un robot de spam.
    if (!(await hit(`unknown:${phoneHash(message.from)}`, 1, 3_600_000))) await this.reply(message.from, say('fr', 'unknownNumber'));
  }

  // ── Boutons ──────────────────────────────────────────────────────────────

  private async onButton(link: WhatsappLinkDocument, message: InboundMessage): Promise<void> {
    const parsed = parseButtonId(message.buttonId ?? '');
    if (!parsed) return void (await this.reply(message.from, say(link.language, 'unclear')));

    // L'approbation est cherchée pour CET utilisateur : l'identifiant d'un bouton ne suffit jamais.
    const approval = await WhatsappApproval.findOne({ _id: parsed.approvalId, userId: link.userId });
    if (!approval) return void (await this.reply(message.from, say(link.language, 'stale')));

    if (parsed.action === 'show') {
      if (approval.status !== 'awaiting' || approval.version !== parsed.version) return void (await this.reply(message.from, say(link.language, 'stale')));
      return this.approvals.sendBundle(approval, link);
    }

    if (parsed.action === 'approve') {
      const outcome = await this.approvals.approve(link.userId, parsed.approvalId, parsed.version);
      if (outcome === 'stale' || outcome === 'not_open' || outcome === 'conflict') {
        await this.reply(message.from, say(link.language, 'stale'));
        const latest = (await this.approvals.openFor(link.userId))[0];
        if (latest) await this.approvals.sendBundle(latest, link);
      } else if (outcome === 'expired') await this.reply(message.from, say(link.language, 'expired', { day: approval.forDay ?? '' }));
      else if (outcome === 'not_entitled') await this.reply(message.from, say(link.language, 'planEnded'));
      else if (outcome === 'integrity' || outcome === 'not_found') await this.reply(message.from, say(link.language, 'generationFailed'));
      return;
    }

    if (parsed.action === 'cancel') {
      const done = await this.approvals.cancel(link.userId, parsed.approvalId, parsed.version);
      return void (await this.reply(message.from, say(link.language, done ? 'cancelled' : 'stale')));
    }

    // « Modifier » : le prochain message de l'utilisateur est la consigne.
    const open = await this.approvals.awaitRevision(link.userId, parsed.approvalId, parsed.version);
    if (!open) return void (await this.reply(message.from, say(link.language, 'stale')));
    await WhatsappApproval.updateOne({ _id: open._id }, { $set: { awaitingInstruction: true } });
    await this.reply(message.from, say(link.language, 'askRevision'));
  }

  // ── Texte ────────────────────────────────────────────────────────────────

  private async onText(link: WhatsappLinkDocument, message: InboundMessage): Promise<void> {
    const text = (message.text ?? '').trim();
    const norm = normalizeReply(text);
    const lang = link.language;
    if (!norm) return;

    // Les commandes de gestion passent avant tout : elles protègent l'utilisateur.
    if (UNLINK_PHRASES.includes(norm)) {
      await this.links.unlink(link.userId, 'stop');
      return void (await this.reply(message.from, say(lang, 'unlinked')));
    }
    if (STOP_PHRASES.includes(norm)) {
      await WhatsappLink.updateOne({ _id: link._id }, { $set: { dailyProposals: false } });
      return void (await this.reply(message.from, say(lang, 'stopped')));
    }
    if (HELP_PHRASES.includes(norm)) return void (await this.reply(message.from, say(lang, 'help')));

    const open = await this.approvals.openFor(link.userId);

    // Une consigne de modification attendue : ce texte en est une (sauf annulation explicite).
    const waiting = open.find((a) => a.awaitingInstruction);
    if (waiting && !CANCEL_PHRASES.includes(norm)) {
      await WhatsappApproval.updateOne({ _id: waiting._id }, { $set: { awaitingInstruction: false } });
      return this.revise(link, message.from, String(waiting._id), text);
    }

    // « Oui » / « annule » : valent pour LA demande ouverte, à condition qu'il n'y en ait qu'une.
    const approve = APPROVE_PHRASES.includes(norm);
    const cancel = CANCEL_PHRASES.includes(norm);
    if (approve || cancel) {
      if (open.length === 0) return void (await this.reply(message.from, say(lang, 'nothingOpen')));
      if (open.length > 1) return void (await this.reply(message.from, say(lang, 'several')));
      const only = open[0];
      if (approve) {
        const outcome = await this.approvals.approve(link.userId, String(only._id), only.version);
        if (outcome !== 'published') await this.reply(message.from, say(lang, outcome === 'expired' ? 'expired' : 'stale', { day: only.forDay ?? '' }));
      } else {
        await this.approvals.cancel(link.userId, String(only._id), only.version);
        await this.reply(message.from, say(lang, 'cancelled'));
      }
      return;
    }

    // Création à la demande.
    const wantsVideo = VIDEO.test(norm) && VERB.test(norm);
    const wantsImage = IMAGE.test(norm) && VERB.test(norm);
    if (wantsVideo || wantsImage) return this.adhoc(link, message.from, text, norm, wantsVideo ? 'video' : 'image');

    // Sinon, avec une seule demande ouverte, c'est une retouche (bornée, et sans effet public).
    if (open.length === 1 && norm.length >= 4) return this.revise(link, message.from, String(open[0]._id), text);
    if (open.length > 1) return void (await this.reply(message.from, say(lang, 'several')));
    await this.reply(message.from, say(lang, 'unclear'));
  }

  private async revise(link: WhatsappLinkDocument, to: string, approvalId: string, instruction: string): Promise<void> {
    await this.reply(to, say(link.language, 'revising'));
    const outcome = await this.approvals.revise(link, approvalId, instruction);
    if (outcome === 'limit') await this.reply(to, say(link.language, 'revisionLimit', { n: WHATSAPP_LIMITS.maxRevisions }));
    else if (outcome === 'not_open') await this.reply(to, say(link.language, 'stale'));
    else if (outcome === 'failed') await this.reply(to, say(link.language, 'generationFailed'));
  }

  private async adhoc(link: WhatsappLinkDocument, to: string, text: string, norm: string, kind: 'image' | 'video'): Promise<void> {
    const lang = link.language;
    const projectId = link.defaultProjectId;
    if (!projectId) return void (await this.reply(to, say(lang, 'noProject')));
    // Le projet doit être celui de cet utilisateur (vérifié à chaque fois, pas seulement à la configuration).
    if (!(await projectService.getUserProjectById(link.userId, projectId))) return void (await this.reply(to, say(lang, 'noProject')));

    if (!(await this.takeAdhocSlot(link))) return void (await this.reply(to, say(lang, 'adhocLimit', { n: WHATSAPP_LIMITS.adhocPerDay })));

    const connected = (await socialAccountService.list(link.userId, projectId)).map((a) => a.network as PublishNetwork);
    const named = (PUBLISH_NETWORKS as readonly PublishNetwork[]).filter((n) => NETWORK_WORDS[n].test(norm));
    const networks = (named.length ? named : connected).filter((n) => connected.includes(n));
    if (networks.length === 0) return void (await this.reply(to, say(lang, 'noNetwork')));

    await this.reply(to, say(lang, kind === 'video' ? 'videoPreparing' : 'preparing'));
    await this.approvals.proposeAdhoc(link, projectId, text, kind, networks);
  }

  /** Une création ponctuelle de plus aujourd'hui ? Compteur atomique : deux messages en parallèle ne dépassent pas. */
  private async takeAdhocSlot(link: WhatsappLinkDocument): Promise<boolean> {
    const day = new Date(Date.now() + link.utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
    const reset = await WhatsappLink.updateOne({ _id: link._id, adhocDay: { $ne: day } }, { $set: { adhocDay: day, adhocCount: 1 } });
    if (reset.modifiedCount === 1) return true;
    const taken = await WhatsappLink.findOneAndUpdate({ _id: link._id, adhocDay: day, adhocCount: { $lt: WHATSAPP_LIMITS.adhocPerDay } }, { $inc: { adhocCount: 1 } });
    return Boolean(taken);
  }
}
