import crypto from 'crypto';
import logger from '../../config/logger';
import { hashValue } from '../../utils/crypto.util';
import { LINK_CODE_PREFIX, WHATSAPP_LIMITS } from '../../models/whatsapp.model';
import { WhatsappApproval, WhatsappLink, WhatsappLinkDocument } from '../../schemas/whatsapp.schema';
import { whatsappAccess } from './whatsapp-access';
import { maskPhone, phoneEnc, phoneHash } from './whatsapp-phone';

/** Alphabet sans 0/O/1/I : le code se lit et se recopie sans erreur. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(): string {
  const bytes = crypto.randomBytes(8);
  const chars = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  return `${LINK_CODE_PREFIX}-${chars}`;
}

/** L'empreinte se calcule sur le code normalisé (majuscules, sans séparateur) : « idem abcd… » marche aussi. */
export function codeHash(code: string): string {
  return hashValue(`walink:${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`);
}

/** Cherche un code de liaison dans un message entrant. */
export function extractLinkCode(text: string): string | null {
  const match = new RegExp(`${LINK_CODE_PREFIX}[\\s-]*([A-Z2-9]{8})\\b`, 'i').exec(text || '');
  return match ? `${LINK_CODE_PREFIX}-${match[1].toUpperCase()}` : null;
}

export type LinkOutcome =
  | { ok: true; link: WhatsappLinkDocument }
  | { ok: false; reason: 'invalid_code' | 'expired' | 'phone_in_use' | 'not_entitled' | 'too_many_attempts' };

export interface LinkStart {
  code: string;
  /** Lien qui ouvre WhatsApp sur le numéro d'IDEM, message déjà écrit : l'utilisateur n'a qu'à envoyer. */
  waUrl: string | null;
  expiresAt: Date;
}

export class WhatsappLinkService {
  /**
   * Prépare la liaison. Le code est affiché UNE fois ; seule son empreinte est conservée. C'est le
   * téléphone qui prouve qu'il l'a reçu : le message vient de WhatsApp, authentifié par Meta, avec le
   * numéro de l'expéditeur. Pas de SMS à intercepter, pas de numéro saisi à la main (donc pas de
   * numéro d'un tiers lié par erreur ou par malveillance).
   */
  async start(userId: string, defaultProjectId?: string): Promise<{ ok: true; start: LinkStart } | { ok: false; reason: 'not_entitled' }> {
    const access = await whatsappAccess(userId);
    if (!access.allowed) return { ok: false, reason: 'not_entitled' };

    const code = newCode();
    const expiresAt = new Date(Date.now() + WHATSAPP_LIMITS.linkTokenTtlMs);
    await WhatsappLink.updateOne(
      { userId },
      {
        $set: { tokenHash: codeHash(code), tokenExpiresAt: expiresAt, tokenAttempts: 0, ...(defaultProjectId ? { defaultProjectId } : {}) },
        // Un numéro déjà actif reste actif tant que le nouveau n'est pas prouvé.
        $setOnInsert: { userId, status: 'pending', dailyProposals: false, adhocCount: 0, sendHour: 8, utcOffsetMinutes: 60, language: 'fr' },
      },
      { upsert: true }
    );

    const business = (process.env.WHATSAPP_BUSINESS_NUMBER || '').replace(/\D/g, '');
    return { ok: true, start: { code, waUrl: business ? `https://wa.me/${business}?text=${encodeURIComponent(code)}` : null, expiresAt } };
  }

  /** Un message entrant porte-t-il un code valide ? Si oui, ce numéro devient celui du compte. */
  async complete(phoneDigits: string, text: string): Promise<LinkOutcome> {
    const code = extractLinkCode(text);
    if (!code) return { ok: false, reason: 'invalid_code' };

    const link = await WhatsappLink.findOne({ tokenHash: codeHash(code) });
    if (!link || !link.tokenExpiresAt) return { ok: false, reason: 'invalid_code' };
    if (link.tokenExpiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };
    if (link.tokenAttempts >= WHATSAPP_LIMITS.linkMaxAttempts) return { ok: false, reason: 'too_many_attempts' };

    // Le droit d'usage est revérifié au moment de lier : un forfait expiré entre-temps ferme la porte.
    if (!(await whatsappAccess(link.userId)).allowed) return { ok: false, reason: 'not_entitled' };

    const hash = phoneHash(phoneDigits);
    const owner = await WhatsappLink.findOne({ phoneHash: hash, status: 'active', userId: { $ne: link.userId } }).select('_id').lean();
    if (owner) {
      await WhatsappLink.updateOne({ _id: link._id }, { $inc: { tokenAttempts: 1 } });
      return { ok: false, reason: 'phone_in_use' };
    }

    // Usage unique : le code est consommé par la mise à jour conditionnelle elle-même.
    const claimed = await WhatsappLink.findOneAndUpdate(
      { _id: link._id, tokenHash: codeHash(code) },
      {
        $set: {
          status: 'active',
          phoneHash: hash,
          phoneEnc: phoneEnc(phoneDigits, link.userId),
          phoneLast4: phoneDigits.slice(-4),
          linkedAt: new Date(),
          lastInboundAt: new Date(),
        },
        $unset: { tokenHash: '', tokenExpiresAt: '' },
      },
      { new: true }
    );
    if (!claimed) return { ok: false, reason: 'invalid_code' };

    logger.info('whatsapp.linked', { event: 'whatsapp.linked', userId: claimed.userId, phone: maskPhone(phoneDigits) });
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
