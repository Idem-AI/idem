import crypto from 'crypto';
import type { Request, Response } from 'express';
import logger from '../config/logger';
import { authEmail, type AuthEmailAction } from '../services/email/auth-templates';
import { firstNameOf } from '../services/email/email-layout';
import { maskEmail, transactionalEmailService } from '../services/email/email.service';

/**
 * « Send Email Hook » du serveur d'authentification (GoTrue).
 *
 * Règle : tous les e-mails IDEM partent du même SMTP. GoTrue avait le sien
 * (`AUTH_SMTP_*`, autre expéditeur, autre mot de passe) ; il n'envoie plus
 * rien et appelle cette route, qui passe par `transactionalEmailService` —
 * même compte, même expéditeur, même journal `email_logs`, même mise en page.
 *
 * **Signature** : Standard Webhooks (en-têtes `webhook-id`,
 * `webhook-timestamp`, `webhook-signature`), HMAC-SHA256 sur
 * `id.timestamp.corps`. La clé est le secret JWT déjà partagé par les deux
 * services (`AUTH_JWT_SECRET` = `SUPABASE_JWT_SECRET`) : le conteneur GoTrue
 * le passe en base64 au démarrage (infra/supabase-auth/docker-compose.yml),
 * donc aucune nouvelle variable à tenir synchronisée. Un contenu signé ici
 * (`msg_….<horodatage>.{json}`) ne peut pas passer pour l'entrée d'un JWT
 * (`eyJ….eyJ…`), et inversement : la réutilisation de la clé ne permet pas de
 * forger l'un avec l'autre.
 */

const TOLERANCE_SECONDS = 5 * 60;

/**
 * GoTrue abandonne un hook au bout de 5 s. Au-delà de ce délai, l'envoi
 * continue (ses tentatives sont journalisées) et GoTrue reçoit « accepté » :
 * mieux vaut un e-mail qui arrive avec quelques secondes de retard qu'une
 * inscription refusée alors que le message part.
 */
const RESPOND_WITHIN_MS = 4_000;

interface HookPayload {
  user?: {
    id?: string;
    email?: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data?: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
}

/** Adresse publique du serveur d'authentification, base des liens. */
function authPublicUrl(): string {
  const configured = (process.env.SUPABASE_AUTH_URL ?? '').replace(/\/+$/, '');
  // En production, SUPABASE_AUTH_URL est l'adresse interne (http://idem-auth:9999),
  // injoignable depuis la boîte de réception d'un utilisateur.
  if (configured.startsWith('https://')) return configured;
  if (process.env.NODE_ENV === 'production') return 'https://auth.idem.africa';
  return configured || 'http://localhost:9999';
}

function verifySignature(req: Request): boolean {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  const id = req.header('webhook-id');
  const timestamp = req.header('webhook-timestamp');
  const signatures = req.header('webhook-signature');
  if (!secret || !raw || !id || !timestamp || !signatures) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > TOLERANCE_SECONDS) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(`${id}.${timestamp}.${raw.toString('utf8')}`)
    .digest();

  // Plusieurs signatures possibles (rotation) : « v1,<b64> v1,<b64> ».
  return signatures.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

function verifyLink(tokenHash: string, type: string, redirectTo?: string): string {
  const params = new URLSearchParams({ token: tokenHash, type });
  if (redirectTo) params.set('redirect_to', redirectTo);
  return `${authPublicUrl()}/verify?${params.toString()}`;
}

interface Outgoing {
  to: string;
  action: AuthEmailAction;
  link?: string;
  code?: string;
}

/** Ce que GoTrue demande, traduit en messages à envoyer. */
function plan(payload: HookPayload): Outgoing[] | null {
  const user = payload.user ?? {};
  const data = payload.email_data ?? {};
  const type = data.email_action_type ?? '';
  const email = user.email ?? '';
  const redirect = data.redirect_to || data.site_url;

  switch (type) {
    case 'signup':
    case 'invite':
    case 'magiclink':
    case 'recovery':
      if (!email || !data.token_hash) return null;
      return [{ to: email, action: type, link: verifyLink(data.token_hash, type, redirect) }];

    case 'email_change': {
      // Noms croisés par GoTrue (compatibilité) : `token_hash_new` va à
      // l'adresse ACTUELLE, `token_hash` à la NOUVELLE.
      const out: Outgoing[] = [];
      if (email && data.token_hash_new) {
        out.push({
          to: email,
          action: 'email_change_current',
          link: verifyLink(data.token_hash_new, 'email_change', redirect),
        });
      }
      if (user.new_email && data.token_hash) {
        out.push({
          to: user.new_email,
          action: 'email_change_new',
          link: verifyLink(data.token_hash, 'email_change', redirect),
        });
      }
      return out.length ? out : null;
    }

    case 'reauthentication':
      if (!email || !data.token) return null;
      return [{ to: email, action: 'reauthentication', code: data.token }];

    default:
      // Notifications (mot de passe changé, etc.) : désactivées dans GoTrue.
      // Si l'une est activée un jour sans modèle, on le voit dans les journaux
      // sans bloquer l'opération de l'utilisateur.
      return [];
  }
}

function hookError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: { http_code: status, message } });
}

export async function authSendEmailHookController(req: Request, res: Response) {
  if (!verifySignature(req)) {
    logger.warn('auth_email_hook.bad_signature', { event: 'auth_email_hook.bad_signature' });
    return hookError(res, 401, 'Signature invalide');
  }

  const payload = req.body as HookPayload;
  const type = payload.email_data?.email_action_type ?? 'inconnu';
  const messages = plan(payload);

  if (messages === null) {
    logger.error('auth_email_hook.incomplete_payload', { event: 'auth_email_hook.incomplete_payload', type });
    return hookError(res, 400, 'Données insuffisantes pour cet e-mail');
  }
  if (messages.length === 0) {
    logger.warn('auth_email_hook.unhandled_type', { event: 'auth_email_hook.unhandled_type', type });
    return res.status(200).json({});
  }

  const meta = payload.user?.user_metadata ?? {};
  const displayName = String(meta.display_name ?? meta.full_name ?? meta.name ?? '');

  const sending = Promise.all(
    messages.map((message) => {
      const rendered = authEmail({
        action: message.action,
        firstName: firstNameOf(displayName, message.to) || undefined,
        link: message.link,
        code: message.code,
        newEmail: payload.user?.new_email,
      });
      return transactionalEmailService.send({
        to: message.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        template: `auth-${message.action}`,
        relatedType: 'auth',
        relatedId: payload.user?.id,
      });
    })
  );

  const outcome = await Promise.race([
    sending,
    new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), RESPOND_WITHIN_MS)),
  ]);

  if (outcome === 'pending') {
    logger.info('auth_email_hook.slow_send', {
      event: 'auth_email_hook.slow_send',
      type,
      to: messages.map((m) => maskEmail(m.to)),
    });
    return res.status(200).json({});
  }

  const failed = outcome.find((result) => !result.sent);
  if (failed) {
    return hookError(res, 500, `E-mail non envoyé : ${failed.error ?? 'erreur SMTP'}`);
  }
  return res.status(200).json({});
}
