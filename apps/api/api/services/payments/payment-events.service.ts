import logger from '../../config/logger';
import {
  paymentCallbacksTotal,
  paymentFulfillmentFailuresTotal,
  paymentTimeToFinal,
  paymentsCompletedTotal,
  paymentsFailedTotal,
  paymentsInitiatedTotal,
  pawapayRequestDuration,
  pawapayRequestsTotal,
} from '../../config/metrics';
import { PaymentEventSource, PaymentEventType, PaymentTransactionModel } from '../../models/payment.model';
import { PaymentEvent } from '../../schemas/payment.schema';
import { getTraceContext } from '../../utils/trace.util';

/**
 * Journal d'une transaction : un seul point d'écriture pour les trois
 * destinations d'un même événement.
 *
 *  1. **La base** (`payment_events`) — la timeline que lit le panel admin. Elle
 *     répond à « où en est ce paiement et pourquoi s'est-il arrêté là ».
 *  2. **Les logs** (`logs/payments.log`, collectés par Promtail) — la
 *     corrélation avec le reste de la requête via `requestId`.
 *  3. **Les métriques Prometheus** — les alertes.
 *
 * Écrire aux trois endroits depuis chaque appelant garantirait qu'ils finissent
 * par diverger : un cas d'erreur journalisé mais non compté, une métrique
 * incrémentée sans trace. Ici l'appelant décrit l'événement une fois.
 *
 * Aucune écriture n'est jamais bloquante pour le paiement lui-même : si la
 * timeline échoue, on le signale mais on n'échoue pas la transaction — perdre
 * une ligne de journal est moins grave que perdre un encaissement.
 */

/** Clés dont la valeur ne doit jamais atterrir dans un journal. */
const SENSITIVE_KEYS = [
  'phonenumber',
  'phone',
  'msisdn',
  'authorization',
  'token',
  'apikey',
  'api_key',
  'password',
  'secret',
  'signature',
];

/**
 * Expurge récursivement une charge utile.
 *
 * Les corps pawaPay contiennent le numéro complet de l'abonné. Il a sa place
 * sur la transaction (chiffré) et nulle part ailleurs : un log part vers Loki,
 * où il serait consultable par toute personne ayant accès aux tableaux de bord.
 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;

  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        const raw = typeof inner === 'string' ? inner : '';
        // On garde les deux derniers chiffres : assez pour qu'un agent de
        // support confirme un numéro dicté au téléphone, trop peu pour le
        // reconstituer.
        result[key] = raw.length > 2 ? `***${raw.slice(-2)}` : '***';
        continue;
      }
      result[key] = sanitize(inner, depth + 1);
    }
    return result;
  }

  return value;
}

export interface RecordEventInput {
  transactionId: string;
  depositId: string;
  type: PaymentEventType;
  source: PaymentEventSource;
  message: string;
  level?: 'info' | 'warn' | 'error';
  httpStatus?: number;
  durationMs?: number;
  data?: Record<string, unknown>;
  /** Champs joints aux logs uniquement (référence, opérateur, statut…). */
  logFields?: Record<string, unknown>;
}

export class PaymentEventsService {
  /** Ajoute un événement à la timeline et le journalise. */
  async record(input: RecordEventInput): Promise<void> {
    const level = input.level ?? 'info';
    const requestId = getTraceContext()?.requestId;
    const data = input.data ? (sanitize(input.data) as Record<string, unknown>) : undefined;

    logger[level](`payment.${input.type}`, {
      event: `payment.${input.type}`,
      depositId: input.depositId,
      source: input.source,
      message: input.message,
      ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus } : {}),
      ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
      ...(input.logFields ?? {}),
    });

    try {
      await PaymentEvent.create({
        transactionId: input.transactionId,
        depositId: input.depositId,
        type: input.type,
        source: input.source,
        level,
        message: input.message,
        httpStatus: input.httpStatus,
        durationMs: input.durationMs,
        requestId,
        data,
        at: new Date(),
      });
    } catch (error: any) {
      logger.error(`payment.event_write_failed: ${error.message}`, {
        event: 'payment.event_write_failed',
        depositId: input.depositId,
        type: input.type,
      });
    }
  }

  /** Timeline complète d'une transaction, la plus ancienne d'abord. */
  async timeline(transactionId: string, limit = 500): Promise<Record<string, unknown>[]> {
    return PaymentEvent.find({ transactionId })
      .sort({ at: 1 })
      .limit(Math.min(Math.max(limit, 1), 1000))
      .lean();
  }

  // ============================================
  // MÉTRIQUES
  // ============================================

  markInitiated(tx: Pick<PaymentTransactionModel, 'provider' | 'country' | 'intent'>): void {
    paymentsInitiatedTotal.inc({
      provider: tx.provider,
      country: tx.country,
      intent_type: tx.intent.type,
      service: 'idem-api',
    });
  }

  /**
   * Compte un statut final et mesure le temps qu'il a mis à venir.
   *
   * Le délai est calculé depuis la création et non depuis l'acceptation :
   * c'est l'attente réellement vécue par l'abonné qui compte, pas celle du
   * système.
   */
  markFinal(tx: PaymentTransactionModel, createdAt: Date): void {
    const seconds = (Date.now() - createdAt.getTime()) / 1000;

    paymentTimeToFinal.observe(
      { provider: tx.provider, status: tx.status, service: 'idem-api' },
      seconds
    );

    if (tx.status === 'COMPLETED') {
      paymentsCompletedTotal.inc({
        provider: tx.provider,
        country: tx.country,
        intent_type: tx.intent.type,
        service: 'idem-api',
      });
      return;
    }

    paymentsFailedTotal.inc({
      provider: tx.provider,
      failure_code: tx.failureCode ?? 'UNSPECIFIED',
      status: tx.status,
      service: 'idem-api',
    });
  }

  markFulfillmentFailure(intentType: string): void {
    paymentFulfillmentFailuresTotal.inc({ intent_type: intentType, service: 'idem-api' });
  }

  recordCallback(kind: 'deposit' | 'refund', result: string): void {
    paymentCallbacksTotal.inc({ kind, result, service: 'idem-api' });
  }

  recordPawapayCall(endpoint: string, status: string, durationMs: number): void {
    pawapayRequestsTotal.inc({ endpoint, status, service: 'idem-api' });
    pawapayRequestDuration.observe({ endpoint, service: 'idem-api' }, durationMs / 1000);
  }
}

export const paymentEventsService = new PaymentEventsService();
export default paymentEventsService;
