/**
 * Le journal du moteur partagé. Le core n'a pas de journal à lui : il écrit dans celui de
 * l'hôte qui l'exécute (API IDEM, API iVision), que l'hôte branche au démarrage par
 * `configureCore({ logger })`. Sans hôte (contrôles, scripts), les lignes partent sur la console.
 */
export type LogMeta = Record<string, unknown>;

export interface CoreLogger {
  info(message: string, meta?: LogMeta): unknown;
  warn(message: string, meta?: LogMeta): unknown;
  error(message: string, meta?: LogMeta): unknown;
  debug?(message: string, meta?: LogMeta): unknown;
}

const consoleLogger: CoreLogger = {
  info: (m, x) => console.log(m, x ? JSON.stringify(x) : ''),
  warn: (m, x) => console.warn(m, x ? JSON.stringify(x) : ''),
  error: (m, x) => console.error(m, x ? JSON.stringify(x) : ''),
  debug: () => undefined,
};

let sink: CoreLogger = consoleLogger;

/** Branche le journal de l'hôte (winston pour les deux API). */
export function setCoreLogger(next: CoreLogger): void {
  sink = next;
}

const logger: Required<CoreLogger> = {
  info: (m, x) => sink.info(m, x),
  warn: (m, x) => sink.warn(m, x),
  error: (m, x) => sink.error(m, x),
  debug: (m, x) => sink.debug?.(m, x),
};

export default logger;
