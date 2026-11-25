import nodemailer, { Transporter } from 'nodemailer';
import logger from '../../config/logger';
import { emailsSentTotal } from '../../config/metrics';
import { EmailLog } from '../../schemas/emailLog.schema';
import { emailLogoAttachments } from './email-logo';
import { senderAddress, senderForTemplate, type EmailSender } from './email-sender';

/**
 * Envoi des e-mails transactionnels.
 *
 * Ces messages ne sont pas du confort : ils portent un reçu de paiement, une
 * relance avant coupure d'accès, une invitation à la bêta. Trois propriétés en
 * découlent.
 *
 * **Un envoi manqué se voit.** Chaque tentative laisse une ligne dans
 * `email_logs` et une métrique ; le panel admin peut donc répondre à « cet
 * utilisateur a-t-il bien reçu son invitation ? ».
 *
 * **Un envoi manqué ne casse rien.** `send()` ne lève jamais : un paiement
 * encaissé ne doit pas échouer parce que le serveur SMTP est indisponible.
 * L'appelant reçoit un résultat, et l'incident reste visible dans le journal.
 *
 * **Trois tentatives, espacées.** La plupart des échecs SMTP sont temporaires
 * (limite de débit, coupure réseau) ; réessayer résout la majorité d'entre eux
 * sans intervention.
 */

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Identifiant du modèle, pour le journal et les métriques. */
  template: string;
  /** Entité concernée : référence de paiement, abonnement, e-mail bêta. */
  relatedId?: string;
  relatedType?: string;
  userId?: string;
  replyTo?: string;
  /**
   * Expéditeur imposé. Sans lui, il se déduit du modèle (email-sender.ts) :
   * `no-reply@` pour ce qui n'attend pas de réponse.
   */
  sender?: EmailSender;
}

export interface SendEmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  attempts: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class TransactionalEmailService {
  private transporter: Transporter | null = null;

  /**
   * Le transport est construit à la première utilisation.
   *
   * Les identifiants SMTP viennent des secrets, chargés dans `bootstrap()` :
   * un transport construit à l'import partirait sans mot de passe.
   */
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    return this.transporter;
  }

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  /** Expéditeur affiché : no-reply@ ou contact, selon le modèle. */
  private from(sender: EmailSender): string {
    return `"IDEM" <${senderAddress(sender)}>`;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      // En développement, l'absence de SMTP est normale : on journalise sans
      // faire échouer l'action métier qui déclenchait l'envoi.
      logger.warn('email.not_configured', {
        event: 'email.not_configured',
        template: input.template,
        to: maskEmail(input.to),
      });
      return { sent: false, error: 'SMTP non configuré', attempts: 0 };
    }

    const startedAt = Date.now();
    let lastError = '';

    let sender: EmailSender = input.sender ?? senderForTemplate(input.template);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const info = await this.getTransporter().sendMail({
          from: this.from(sender),
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          replyTo: input.replyTo,
          // Un message sans réponse attendue le dit aux messageries : les
          // réponses automatiques (absence, congés) ne partent pas vers no-reply@.
          headers: sender === 'no-reply' ? { 'Auto-Submitted': 'auto-generated' } : undefined,
          // Le logo voyage avec le message : une image distante est bloquée.
          attachments: emailLogoAttachments(input.html),
        });

        const durationMs = Date.now() - startedAt;

        await this.record({
          ...input,
          status: 'sent',
          messageId: info.messageId,
          attempts: attempt,
          durationMs,
        });

        emailsSentTotal.inc({ template: input.template, status: 'sent', service: 'idem-api' });

        logger.info('email.sent', {
          event: 'email.sent',
          template: input.template,
          to: maskEmail(input.to),
          attempts: attempt,
          durationMs,
        });

        return { sent: true, messageId: info.messageId, attempts: attempt };
      } catch (error: any) {
        lastError = error.message;

        // Le serveur refuse l'alias (« not owned by user ») : il n'existe pas
        // ou n'est plus rattaché au compte SMTP. Le message part alors de
        // contact@ — une inscription ne doit pas échouer pour une question
        // d'expéditeur — et l'alerte dit quoi réparer.
        if (sender !== 'contact' && error.responseCode === 553) {
          logger.error(`email.sender_rejected: ${error.message}`, {
            event: 'email.sender_rejected',
            alert: 'critical',
            template: input.template,
            sender: senderAddress(sender),
            hint: `Rattacher ${senderAddress(sender)} comme alias du compte SMTP chez Private Email.`,
          });
          sender = 'contact';
          continue;
        }

        if (attempt < MAX_ATTEMPTS) {
          // Délai croissant : une limite de débit se lève rarement dans la
          // seconde qui suit.
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
      }
    }

    const durationMs = Date.now() - startedAt;

    await this.record({
      ...input,
      status: 'failed',
      error: lastError,
      attempts: MAX_ATTEMPTS,
      durationMs,
    });

    emailsSentTotal.inc({ template: input.template, status: 'failed', service: 'idem-api' });

    logger.error(`email.failed: ${lastError}`, {
      event: 'email.failed',
      template: input.template,
      to: maskEmail(input.to),
      attempts: MAX_ATTEMPTS,
    });

    return { sent: false, error: lastError, attempts: MAX_ATTEMPTS };
  }

  /** Écrit la trace. N'interrompt jamais l'envoi. */
  private async record(entry: {
    template: string;
    to: string;
    subject: string;
    status: 'sent' | 'failed';
    messageId?: string;
    error?: string;
    attempts: number;
    relatedId?: string;
    relatedType?: string;
    userId?: string;
    durationMs?: number;
  }): Promise<void> {
    try {
      await EmailLog.create({ ...entry, sentAt: new Date() });
    } catch (error: any) {
      logger.error(`email.log_write_failed: ${error.message}`, {
        event: 'email.log_write_failed',
        template: entry.template,
      });
    }
  }

  /** Derniers envois vers une adresse — utilisé par le panel admin. */
  async history(to: string, limit = 20): Promise<Record<string, unknown>[]> {
    return EmailLog.find({ to: to.toLowerCase() })
      .sort({ sentAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean();
  }
}

/** `jean.dupont@idem.africa` → `je***@idem.africa`, pour les logs. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export const transactionalEmailService = new TransactionalEmailService();
export default transactionalEmailService;
