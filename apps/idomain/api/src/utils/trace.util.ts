import { AsyncLocalStorage } from 'async_hooks';

/**
 * Contexte de traçage — un identifiant par requête HTTP ou par tâche de fond
 * (BullMQ), propagé via AsyncLocalStorage à toute la chaîne d'appels.
 *
 * Le logger (config/logger.ts) lit ce contexte et l'injecte dans CHAQUE ligne
 * de log (requestId, userId, teamId, queue, jobId) : les ~120 appels
 * `logger.*` existants en bénéficient sans modification.
 *
 * Un `X-Request-Id` reçu de l'API centrale est repris (voir
 * request-trace.middleware.ts), et l'identifiant suit la requête jusque dans
 * le worker qui exécute le déploiement (voir queue/queues.ts) : une recherche
 * sur cet identifiant dans Grafana montre le parcours complet.
 */
export interface TraceContext {
  requestId: string;
  /** Absents pour une tâche de fond. */
  method?: string;
  path?: string;
  startedAt: number;
  userId?: string | number;
  teamId?: string | number;
  queue?: string;
  jobId?: string;
  jobName?: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

export function runWithTrace<T>(context: TraceContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getTraceContext(): TraceContext | undefined {
  return storage.getStore();
}

/** Attache l'utilisateur authentifié (et son équipe) au contexte courant. */
export function setTraceUser(userId: string | number, teamId?: string | number | null): void {
  const store = storage.getStore();
  if (!store) return;
  store.userId = userId;
  if (teamId !== undefined && teamId !== null) store.teamId = teamId;
}

/** Champs de corrélation à fusionner dans une entrée de log (utilisé par le formatter winston). */
export function traceLogFields(): Record<string, string | number> {
  const store = storage.getStore();
  if (!store) return {};
  const fields: Record<string, string | number> = { requestId: store.requestId };
  if (store.userId !== undefined) fields.userId = store.userId;
  if (store.teamId !== undefined) fields.teamId = store.teamId;
  if (store.queue) fields.queue = store.queue;
  if (store.jobId) fields.jobId = store.jobId;
  if (store.jobName) fields.jobName = store.jobName;
  return fields;
}

/** En-têtes à joindre à un appel vers un autre service IDEM. */
export function traceHeaders(): Record<string, string> {
  const store = storage.getStore();
  return store ? { 'X-Request-Id': store.requestId } : {};
}
