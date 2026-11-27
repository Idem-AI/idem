/**
 * Email delivery delegated to the main IDEM API (`apps/api`).
 *
 * Avoids duplicating SMTP credentials, SPF/DKIM setup and email logging inside
 * `ideploy-api`. Instead, this service calls `POST {IDEM_API_URL}/internal/ideploy/email`
 * authenticated via `x-api-key: INTERNAL_API_KEY`.
 *
 * Never blocking: network issues or API downtime are logged as warnings and
 * will not fail a migration or deployment.
 */
import axios from 'axios';
import logger from '../config/logger';

export interface EmailPayload {
  to: string;
  subject: string;
  /** Plain-text fallback. */
  text: string;
  /** Rich HTML body. */
  html?: string;
  template?: string;
  sender?: 'no-reply' | 'support' | 'contact';
  /**
   * The message as text blocks: the IDEM API lays it out like every IDEM email
   * (logo attached, escaped values). Preferred to `html`, kept as the fallback.
   */
  layout?: {
    title: string;
    subtitle?: string;
    preheader: string;
    paragraphs: string[];
    panels?: { title: string; rows: { label: string; value: string }[] }[];
    cta?: { label: string; url: string };
    footerNote?: string;
  };
}

const IDEM_API_URL = process.env.IDEM_API_URL || 'http://localhost:3001';

/**
 * Send an email via the central IDEM API.
 *
 * @returns `true` when the email was accepted and sent, `false` otherwise.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!apiKey) {
    logger.warn('Email skipped: INTERNAL_API_KEY not configured.', {
      event: 'email.no_api_key',
      to: payload.to,
      subject: payload.subject,
    });
    return false;
  }

  try {
    const { data } = await axios.post(
      `${IDEM_API_URL}/internal/ideploy/email`,
      {
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        layout: payload.layout,
        template: payload.template ?? 'ideploy.domain_migration',
        sender: payload.sender ?? 'no-reply',
      },
      {
        headers: { 'x-api-key': apiKey },
        timeout: 15_000,
      }
    );

    if (data?.success) {
      logger.info('Email sent successfully via IDEM API', {
        event: 'email.sent',
        to: payload.to,
        subject: payload.subject,
      });
      return true;
    }

    logger.warn('IDEM API refused or failed to send email', {
      event: 'email.api_error',
      to: payload.to,
      response: data,
    });
    return false;
  } catch (err: any) {
    logger.error('Failed to send email via IDEM API', {
      event: 'email.failed',
      to: payload.to,
      subject: payload.subject,
      error: err?.response?.data?.message ?? err?.message,
      status: err?.response?.status,
    });
    return false;
  }
}
