import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

/**
 * Contexte de traçage — un identifiant unique par requête HTTP (corrélation),
 * propagé via AsyncLocalStorage à tout le long de la chaîne d'appels (comme
 * request-language.ts et revision-context.util.ts).
 *
 * Le logger (config/logger.ts) lit ce contexte et l'injecte automatiquement
 * dans CHAQUE ligne de log existante (requestId, userId, projectId, route) —
 * aucune modification n'est nécessaire dans le code déjà instrumenté avec
 * `logger.info/warn/error(...)` pour bénéficier de la corrélation.
 */
export interface TraceContext {
  requestId: string;
  /** Absents pour une tâche de fond (planificateur, réconciliation). */
  method?: string;
  path?: string;
  startedAt: number;
  userId?: string;
  projectId?: string;
  /** Nom de la tâche de fond qui a ouvert ce contexte (`billing.reconcile`…). */
  job?: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

export function runWithTrace<T>(context: TraceContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getTraceContext(): TraceContext | undefined {
  return storage.getStore();
}

/** Attache l'utilisateur authentifié au contexte courant (appelé par authenticate()). */
export function setTraceUserId(userId: string): void {
  const store = storage.getStore();
  if (store) store.userId = userId;
}

/** Attache le projet ciblé au contexte courant, pour corréler tous les logs d'une requête à son projet. */
export function setTraceProjectId(projectId: string): void {
  const store = storage.getStore();
  if (store && projectId) store.projectId = projectId;
}

/** Champs de corrélation à fusionner dans une entrée de log (utilisé par le formatter winston). */
export function traceLogFields(): Record<string, string | number> {
  const store = storage.getStore();
  if (!store) return {};
  const fields: Record<string, string | number> = { requestId: store.requestId };
  if (store.userId) fields.userId = store.userId;
  if (store.projectId) fields.projectId = store.projectId;
  if (store.job) fields.job = store.job;
  return fields;
}

/**
 * Exécute une tâche de fond dans son propre contexte de traçage : chaque
 * passage d'un planificateur reçoit un identifiant, et tout ce qu'il journalise
 * (y compris les erreurs) se relit d'un seul filtre dans Grafana.
 */
export function runJobWithTrace<T>(job: string, fn: () => T): T {
  return storage.run({ requestId: `job-${randomUUID()}`, job, startedAt: Date.now() }, fn);
}

/**
 * En-têtes à joindre à un appel vers un autre service IDEM (ideploy-api,
 * appgen) : le même `X-Request-Id` suit la requête d'un service à l'autre, et
 * une recherche sur cet identifiant dans Grafana montre le parcours complet.
 */
export function traceHeaders(): Record<string, string> {
  const store = storage.getStore();
  return store ? { 'X-Request-Id': store.requestId } : {};
}
