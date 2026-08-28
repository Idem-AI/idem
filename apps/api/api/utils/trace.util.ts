import { AsyncLocalStorage } from 'async_hooks';

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
  method: string;
  path: string;
  startedAt: number;
  userId?: string;
  projectId?: string;
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
  return fields;
}
