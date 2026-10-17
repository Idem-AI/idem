/**
 * Les événements envoyés aux produits IDEM (iDeploy, iCode) : signés, rejouables, relivrés.
 *
 * Signature : en-tête `X-IDomain-Signature: t=<secondes>,v1=<hex>` où v1 = HMAC-SHA256 du secret
 * partagé sur `<t>.<corps JSON>`. Le destinataire refuse un horodatage de plus de 5 minutes et
 * déduplique sur `X-IDomain-Delivery` (même identifiant à chaque relivraison).
 *
 * `domain.active` ne part qu'après validation effective : DNS bon ET certificat HTTPS valide.
 */
import axios from 'axios';
import { createHmac } from 'crypto';
import { env } from '../../config/env';
import { one, query } from '../../config/db';
import logger from '../../config/logger';
import { enqueueWebhook } from '../../queue/queues';

export type DomainEvent = 'order.completed' | 'order.failed' | 'domain.registered' | 'domain.active' | 'connection.failed';

export function sign(body: string, timestamp: number, secret = env.webhookSecret): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Écrit l'événement pour chaque destinataire configuré, puis le confie au worker. */
export async function emit(event: DomainEvent, data: Record<string, unknown>): Promise<void> {
  const targets = env.webhookTargets;
  if (!targets.length || !env.webhookSecret) return;
  for (const target of targets) {
    const payload = { event, createdAt: new Date().toISOString(), data };
    const row = await one<{ id: string }>(`INSERT INTO webhook_deliveries (event, target, url, payload) VALUES ($1, $2, $3, $4) RETURNING id`, [event, target.name, target.url, JSON.stringify(payload)]);
    await enqueueWebhook(row!.id).catch((error) => logger.error('webhook.enqueue_failed', { event: 'webhook.enqueue_failed', deliveryId: row!.id, error }));
  }
}

/** Une tentative de livraison ; une erreur relance la tâche (BullMQ, attente croissante). */
export async function deliver(deliveryId: string, finalAttempt: boolean): Promise<void> {
  const row = await one<{ id: string; event: string; url: string; payload: unknown; status: string }>(`SELECT id, event, url, payload, status FROM webhook_deliveries WHERE id = $1`, [deliveryId]);
  if (!row || row.status === 'delivered') return;
  const body = JSON.stringify(row.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const res = await axios.post(row.url, body, {
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'X-IDomain-Event': row.event,
        'X-IDomain-Delivery': row.id,
        'X-IDomain-Signature': `t=${timestamp},v1=${sign(body, timestamp)}`,
      },
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 300) {
      await query(`UPDATE webhook_deliveries SET status = 'delivered', attempts = attempts + 1, last_status = $2, delivered_at = now(), last_error = NULL WHERE id = $1`, [row.id, res.status]);
      return;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    await query(`UPDATE webhook_deliveries SET attempts = attempts + 1, last_error = $2, status = $3 WHERE id = $1`, [row.id, String((error as Error).message).slice(0, 300), finalAttempt ? 'failed' : 'pending']);
    if (finalAttempt) logger.error('webhook.abandoned', { event: 'webhook.abandoned', deliveryId: row.id, url: row.url, error });
    throw error;
  }
}
