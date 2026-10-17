/**
 * Le processus des tâches longues d'iDomain (BullMQ) : enregistrements, connexions, événements,
 * maintenance. Séparé de l'API pour qu'un fournisseur lent ne ralentisse jamais une page.
 *
 * Chaque tâche rouvre le contexte de traçage de la requête qui l'a créée : ses journaux portent
 * le même `requestId` que le clic d'origine.
 */
import { loadSecrets } from './config/secrets';

async function bootstrap(): Promise<void> {
  await loadSecrets();
  const { default: logger, captureConsole, installProcessHandlers, logCritical } = await import('./config/logger');
  captureConsole();
  installProcessHandlers();

  const { Worker } = await import('bullmq');
  const { redisOptions } = await import('./config/redis');
  const { connectDatabase, query } = await import('./config/db');
  const { QUEUE_NAMES, QUEUE_PREFIX, getQueue, enqueueConnection, enqueueOrderItem } = await import('./queue/queues');
  const { runWithTrace } = await import('./utils/trace.util');
  const { executeItem, releaseItem, RetryLater } = await import('./modules/orders/execution.service');
  const { advance } = await import('./modules/connections/connections.service');
  const { deliver } = await import('./modules/webhooks/webhooks.service');
  const { checkProviderHealth, syncProviderCosts } = await import('./modules/providers/providers.service');
  const { retryPendingRefunds } = await import('./modules/payments/wallet.service');
  const { randomUUID } = await import('crypto');

  await connectDatabase();

  type JobLike = { id?: string; name: string; data: Record<string, unknown> & { __trace?: { requestId?: string; userId?: string } }; attemptsMade: number; opts: { attempts?: number } };
  const traced =
    (queue: string, fn: (job: JobLike) => Promise<void>) =>
    (job: JobLike): Promise<void> =>
      runWithTrace({ requestId: job.data.__trace?.requestId ?? randomUUID(), userId: job.data.__trace?.userId, queue, jobId: job.id, jobName: job.name, startedAt: Date.now() }, () => fn(job));

  const workers = [
    new Worker(
      QUEUE_NAMES.orders,
      traced(QUEUE_NAMES.orders, async (job) => {
        const itemId = String(job.data.itemId);
        try {
          await executeItem(itemId);
        } catch (error) {
          await releaseItem(itemId);
          if (!(error instanceof RetryLater)) logger.error('order.execute_failed', { event: 'order.execute_failed', itemId, error });
          // Dernière tentative épuisée sur un résultat incertain : un humain doit trancher.
          if ((job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1)) {
            await query(`UPDATE order_items SET status = 'needs_review', updated_at = now() WHERE id = $1 AND status IN ('pending', 'registering')`, [itemId]);
            await query(`UPDATE orders SET status = 'needs_review', status_reason = $2, updated_at = now() WHERE id = (SELECT order_id FROM order_items WHERE id = $1)`, [itemId, (error as Error).message.slice(0, 200)]);
            logCritical('order.needs_review', { itemId, reason: (error as Error).message });
          }
          throw error;
        }
      }),
      { connection: redisOptions, prefix: QUEUE_PREFIX, concurrency: 4 }
    ),
    new Worker(QUEUE_NAMES.connections, traced(QUEUE_NAMES.connections, async (job) => advance(String(job.data.connectionId))), { connection: redisOptions, prefix: QUEUE_PREFIX, concurrency: 8 }),
    new Worker(
      QUEUE_NAMES.webhooks,
      traced(QUEUE_NAMES.webhooks, async (job) => deliver(String(job.data.deliveryId), (job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1))),
      { connection: redisOptions, prefix: QUEUE_PREFIX, concurrency: 4 }
    ),
    new Worker(
      QUEUE_NAMES.maintenance,
      traced(QUEUE_NAMES.maintenance, async (job) => {
        switch (job.name) {
          case 'provider-health':
            return checkProviderHealth();
          case 'provider-costs':
            await syncProviderCosts();
            return;
          case 'refunds':
            await retryPendingRefunds();
            return;
          case 'sweep': {
            // Filet de sécurité : ce qu'une tâche perdue (Redis vidé, arrêt brutal) aurait laissé en route.
            const items = await query<{ id: string }>(
              `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE o.status IN ('paid', 'processing') AND oi.status IN ('pending', 'registering') AND oi.updated_at < now() - interval '10 minutes' LIMIT 100`
            );
            for (const i of items) await enqueueOrderItem(i.id);
            const held = await query<{ id: string }>(`SELECT id FROM order_items WHERE status = 'on_hold' AND updated_at < now() - interval '20 minutes' LIMIT 100`);
            for (const i of held) await enqueueOrderItem(i.id);
            const connections = await query<{ id: string }>(
              `SELECT id FROM domain_connections WHERE status IN ('verifying_ownership', 'pending', 'configuring_dns', 'attaching', 'waiting_dns', 'activating_tls') AND updated_at < now() - interval '15 minutes' LIMIT 200`
            );
            for (const c of connections) await enqueueConnection(c.id);
            return;
          }
        }
      }),
      { connection: redisOptions, prefix: QUEUE_PREFIX, concurrency: 1 }
    ),
  ];

  for (const w of workers) {
    w.on('failed', (job, error) => logger.warn('job.failed', { event: 'job.failed', queue: w.name, jobId: job?.id, attempts: job?.attemptsMade, error }));
    w.on('error', (error) => logger.error('worker.error', { event: 'worker.error', queue: w.name, error }));
  }

  const maintenance = getQueue(QUEUE_NAMES.maintenance);
  await maintenance.upsertJobScheduler('provider-health', { every: 10 * 60_000 }, { name: 'provider-health' });
  await maintenance.upsertJobScheduler('provider-costs', { pattern: '0 3 * * *' }, { name: 'provider-costs' });
  await maintenance.upsertJobScheduler('refunds', { every: 10 * 60_000 }, { name: 'refunds' });
  await maintenance.upsertJobScheduler('sweep', { every: 5 * 60_000 }, { name: 'sweep' });
  // Au démarrage : état et coûts des fournisseurs tout de suite (une base neuve n'a que les valeurs de départ).
  await maintenance.add('provider-health', {});
  await maintenance.add('provider-costs', {});

  logger.info('idomain.worker_started', { event: 'idomain.worker_started', queues: Object.values(QUEUE_NAMES) });

  const shutdown = async () => {
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('iDomain worker failed to start', error);
  process.exit(1);
});
