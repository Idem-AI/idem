import crypto from 'crypto';
import logger from '../../config/logger';
import { hashValue } from '../../utils/crypto.util';
import { WHATSAPP_LIMITS } from '../../models/whatsapp.model';
import { WhatsappApproval, WhatsappLink, WhatsappLinkDocument } from '../../schemas/whatsapp.schema';
import { whatsappAccess } from './whatsapp-access';
import { maskPhone, normalizePhone, phoneEnc, phoneHash } from './whatsapp-phone';
import { CloudApiTransport, WhatsappTransport } from './whatsapp.client';
import { hit } from './whatsapp-rate';

/** Alphabet sans 0/O/1/I : le code se lit et se recopie sans erreur. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

/** L'empreinte se calcule sur le code normalisé (majuscules, sans espace) : la casse ou un espace ne gênent pas la saisie. */
export function codeHash(code: string): string {
  return hashValue(`walink:${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`);
}

export type RequestCodeOutcome =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: 'invalid_phone' | 'not_entitled' | 'phone_in_use' | 'too_many_attempts' | 'send_failed' };

export type LinkOutcome = { ok: true; link: WhatsappLinkDocument } | { ok: false; reason: 'invalid_code' | 'expired' | 'too_many_attempts' };

export class WhatsappLinkService {
  constructor(private readonly transport: WhatsappTransport = new CloudApiTransport()) {}

  /**
   * L'utilisateur saisit son numéro dans IDEM ; on lui envoie un code par WhatsApp (modèle approuvé :
   * aucune fenêtre de service n'est ouverte avec un numéro qui n'a jamais écrit à IDEM). C'est la
   * saisie du code DANS IDEM, pas l'envoi, qui prouve qu'il a bien ce téléphone en main — personne ne
   * peut lier le numéro d'un tiers sans lire les messages de ce tiers.
   */
  async requestCode(userId: string, rawPhone: string, defaultProjectId?: string): Promise<RequestCodeOutcome> {
    const access = await whatsappAccess(userId);
    if (!access.allowed) return { ok: false, reason: 'not_entitled' };

    const phoneDigits = normalizePhone(rawPhone);
    if (!phoneDigits) return { ok: false, reason: 'invalid_phone' };

    if (await hit(`link-request:${userId}`, WHATSAPP_LIMITS.linkRequestsPerHour, 3_600_000)) return { ok: false, reason: 'too_many_attempts' };

    const hash = phoneHash(phoneDigits);
    const owner = await WhatsappLink.findOne({ phoneHash: hash, status: 'active', userId: { $ne: userId } }).select('_id').lean();
    if (owner) return { ok: false, reason: 'phone_in_use' };

    const code = newCode();
    const expiresAt = new Date(Date.now() + WHATSAPP_LIMITS.linkTokenTtlMs);
    await WhatsappLink.updateOne(
      { userId },
      {
        $set: {
          tokenHash: codeHash(code),
          tokenExpiresAt: expiresAt,
          tokenAttempts: 0,
          pendingPhoneHash: hash,
          pendingPhoneEnc: phoneEnc(phoneDigits, userId),
          pendingPhoneLast4: phoneDigits.slice(-4),
          ...(defaultProjectId ? { defaultProjectId } : {}),
        },
        $setOnInsert: { userId, status: 'pending', dailyProposals: false, adhocCount: 0, sendHour: 8, utcOffsetMinutes: 60, language: 'fr' },
      },
      { upsert: true }
    );

    const template = process.env.WHATSAPP_TEMPLATE_LINK_CODE || 'idem_link_code';
    try {
      await this.transport.sendTemplate(phoneDigits, template, 'fr', [code]);
    } catch (error: any) {
      // Le code n'est jamais parti : on retire l'attente, sinon un essai ultérieur verrait un code mort.
      await WhatsappLink.updateOne({ userId }, { $unset: { tokenHash: '', tokenExpiresAt: '', pendingPhoneHash: '', pendingPhoneEnc: '', pendingPhoneLast4: '' } });
      logger.error('whatsapp.link_code_failed', { event: 'whatsapp.link_code_failed', userId, error: error?.message });
      return { ok: false, reason: 'send_failed' };
    }
    logger.info('whatsapp.link_code_sent', { event: 'whatsapp.link_code_sent', userId, phone: maskPhone(phoneDigits) });
    return { ok: true, expiresAt };
  }

  /** L'utilisateur recopie dans IDEM le code reçu sur WhatsApp : le numéro en attente devient celui du compte. */
  async confirmCode(userId: string, rawCode: string): Promise<LinkOutcome> {
    const link = await WhatsappLink.findOne({ userId });
    if (!link?.tokenHash || !link.tokenExpiresAt || !link.pendingPhoneHash) return { ok: false, reason: 'invalid_code' };
    if (link.tokenExpiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };
    if (link.tokenAttempts >= WHATSAPP_LIMITS.linkMaxAttempts) return { ok: false, reason: 'too_many_attempts' };

    if (codeHash(rawCode) !== link.tokenHash) {
      await WhatsappLink.updateOne({ _id: link._id }, { $inc: { tokenAttempts: 1 } });
      return { ok: false, reason: 'invalid_code' };
    }

    // Revérifié : le numéro aurait pu être lié par un autre compte entre l'envoi du code et sa saisie.
    const owner = await WhatsappLink.findOne({ phoneHash: link.pendingPhoneHash, status: 'active', userId: { $ne: userId } }).select('_id').lean();
    if (owner) return { ok: false, reason: 'invalid_code' };

    // Usage unique : le code est consommé par la mise à jour conditionnelle elle-même.
    const claimed = await WhatsappLink.findOneAndUpdate(
      { _id: link._id, tokenHash: link.tokenHash },
      {
        $set: { status: 'active', phoneHash: link.pendingPhoneHash, phoneEnc: link.pendingPhoneEnc, phoneLast4: link.pendingPhoneLast4, linkedAt: new Date() },
        $unset: { tokenHash: '', tokenExpiresAt: '', pendingPhoneHash: '', pendingPhoneEnc: '', pendingPhoneLast4: '' },
      },
      { new: true }
    );
    if (!claimed) return { ok: false, reason: 'invalid_code' };

    logger.info('whatsapp.linked', { event: 'whatsapp.linked', userId: claimed.userId });
    return { ok: true, link: claimed };
  }

  /** Le compte lié à ce numéro, s'il existe et reste actif. */
  async byPhone(phoneDigits: string): Promise<WhatsappLinkDocument | null> {
    return WhatsappLink.findOne({ phoneHash: phoneHash(phoneDigits), status: 'active' });
  }

  async get(userId: string): Promise<WhatsappLinkDocument | null> {
    return WhatsappLink.findOne({ userId });
  }

  /** Délie : le numéro est effacé, les demandes en attente sont annulées (rien ne partira plus). */
  async unlink(userId: string, reason: 'user' | 'stop' | 'plan_ended' = 'user'): Promise<void> {
    await WhatsappLink.updateOne(
      { userId },
      { $set: { status: 'revoked', dailyProposals: false }, $unset: { phoneEnc: '', phoneHash: '', phoneLast4: '', tokenHash: '', tokenExpiresAt: '' } }
    );
    await WhatsappApproval.updateMany({ userId, status: { $in: ['generating', 'awaiting', 'revising'] } }, { $set: { status: 'cancelled', failureReason: `unlinked:${reason}` } });
    logger.info('whatsapp.unlinked', { event: 'whatsapp.unlinked', userId, reason });
  }

  async updateSettings(
    userId: string,
    patch: { dailyProposals?: boolean; sendHour?: number; utcOffsetMinutes?: number; language?: 'fr' | 'en'; defaultProjectId?: string }
  ): Promise<WhatsappLinkDocument | null> {
    const set: Record<string, unknown> = {};
    if (typeof patch.dailyProposals === 'boolean') {
      set.dailyProposals = patch.dailyProposals;
      // Le consentement est daté : c'est la preuve qu'IDEM peut écrire en premier.
      if (patch.dailyProposals) set.consentAt = new Date();
    }
    if (Number.isInteger(patch.sendHour) && patch.sendHour! >= 0 && patch.sendHour! <= 23) set.sendHour = patch.sendHour;
    if (Number.isInteger(patch.utcOffsetMinutes) && Math.abs(patch.utcOffsetMinutes!) <= 14 * 60) set.utcOffsetMinutes = patch.utcOffsetMinutes;
    if (patch.language === 'fr' || patch.language === 'en') set.language = patch.language;
    if (typeof patch.defaultProjectId === 'string' && patch.defaultProjectId.length <= 64) set.defaultProjectId = patch.defaultProjectId;
    return WhatsappLink.findOneAndUpdate({ userId, status: 'active' }, { $set: set }, { new: true });
  }
}

export const whatsappLinkService = new WhatsappLinkService();
