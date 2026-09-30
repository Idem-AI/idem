import { AsyncLocalStorage } from 'async_hooks';

/**
 * Contexte de traçage — un identifiant par requête HTTP, propagé via
 * AsyncLocalStorage à toute la chaîne d'appels (génération, outils, appels aux
 * modèles). Le logger (config/logger.ts) l'injecte dans chaque ligne de log.
 *
 * Un `X-Request-Id` reçu de l'API centrale est repris, et il est renvoyé à
 * l'API sur les appels sortants (auth, facturation) : une recherche sur cet
 * identifiant dans Grafana montre le parcours complet entre les services.
 */
export interface TraceContext {
  requestId: string;
  method?: string;
  path?: string;
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

/** Attache l'utilisateur authentifié au contexte courant (appelé par requireIdemUser). */
export function setTraceUserId(userId: string): void {
  const store = storage.getStore();
  if (store) store.userId = userId;
}

/** Attache le projet généré au contexte courant. */
export function setTraceProjectId(projectId: string): void {
  const store = storage.getStore();
  if (store && projectId) store.projectId = projectId;
}

/** Champs de corrélation à fusionner dans une entrée de log (utilisé par le formatter winston). */
export function traceLogFields(): Record<string, string> {
  const store = storage.getStore();
  if (!store) return {};
  const fields: Record<string, string> = { requestId: store.requestId };
  if (store.userId) fields.userId = store.userId;
  if (store.projectId) fields.projectId = store.projectId;
  return fields;
}

/** En-têtes à joindre à un appel vers un autre service IDEM. */
export function traceHeaders(): Record<string, string> {
  const store = storage.getStore();
  return store ? { 'X-Request-Id': store.requestId } : {};
}
