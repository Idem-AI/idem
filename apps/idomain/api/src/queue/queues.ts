/**
 * Les files des tâches longues (BullMQ sur Redis), exécutées par le processus worker
 * (`src/worker.ts`), jamais pendant une requête HTTP :
 *
 *   orders       enregistrer chaque ligne payée chez le fournisseur retenu ;
 *   connections  faire avancer un domaine relié à une application (DNS → rattachement → HTTPS) ;
 *   webhooks     livrer les événements signés aux produits (iDeploy, iCode) ;
 *   maintenance  relevé des coûts et de la santé des fournisseurs, reprise des commandes en suspens.
 *
 * L'identifiant de tâche est celui de l'objet traité : une même ligne ne peut pas être en file deux fois.
 */
import { JobsOptions, Queue, QueueOptions } from 'bullmq';
import { redisOptions } from '../config/redis';
import { getTraceContext } from '../utils/trace.util';

// BullMQ refuse ':' dans un nom de file (c'est le séparateur de clés Redis).
export const QUEUE_NAMES = {
  orders: 'idomain-orders',
  connections: 'idomain-connections',
  webhooks: 'idomain-webhooks',
  maintenance: 'idomain-maintenance',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_PREFIX = 'idomain';

const baseOptions: QueueOptions = {
  connection: redisOptions,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: 'exponential', delay: 15_000 },
    removeOnComplete: { age: 24 * 3600, count: 2000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
};

const registry = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = registry.get(name);
  if (!q) {
    q = withTracePropagation(new Queue(name, baseOptions));
    registry.set(name, q);
  }
  return q;
}

/** La tâche emporte l'identifiant de la requête qui l'a créée : un seul `requestId` de bout en bout. */
function withTracePropagation(queue: Queue): Queue {
  const add = queue.add.bind(queue);
  queue.add = ((jobName: string, data: unknown, opts?: JobsOptions) => {
    const ctx = getTraceContext();
    const traced =
      ctx && data && typeof data === 'object' && !Array.isArray(data) ? { ...(data as Record<string, unknown>), __trace: { requestId: ctx.requestId, userId: ctx.userId } } : data;
    return add(jobName, traced, opts);
  }) as Queue['add'];
  return queue;
}

/**
 * Enregistrer une ligne de commande. L'exécution est idempotente (état en base, ligne « prise »
 * atomiquement) : un rappel en double est sans danger, un rappel ignoré bloquerait la ligne.
 */
export function enqueueOrderItem(itemId: string, delayMs = 0): Promise<unknown> {
  return getQueue(QUEUE_NAMES.orders).add('execute-item', { itemId }, { jobId: `item-${itemId}-${Date.now() + delayMs}`, delay: delayMs });
}

/**
 * Faire avancer une connexion ; `delayMs` pour relire le DNS plus tard. Un identifiant par rappel :
 * un identifiant par créneau se confondait avec celui de la tâche EN COURS quand elle se
 * reprogrammait elle-même, et BullMQ ignorait la relance (la chaîne s'arrêtait). Un rappel en
 * double est sans danger : chaque étape relit l'état en base.
 */
export function enqueueConnection(connectionId: string, delayMs = 0): Promise<unknown> {
  return getQueue(QUEUE_NAMES.connections).add('advance', { connectionId }, { jobId: `conn-${connectionId}-${Date.now() + delayMs}`, delay: delayMs, attempts: 3 });
}

export function enqueueWebhook(deliveryId: string): Promise<unknown> {
  return getQueue(QUEUE_NAMES.webhooks).add('deliver', { deliveryId }, { jobId: `hook-${deliveryId}`, attempts: 10, backoff: { type: 'exponential', delay: 30_000 } });
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...registry.values()].map((q) => q.close()));
}
