import path from 'path';
import util from 'util';
import winston from 'winston';
import { traceLogFields } from '../utils/trace.util';
import {
  baseMeta,
  consoleIsJson,
  jsonLine,
  normalizeErrors,
  prettyConsole,
  sanitizeInfo,
} from './log-format';

// Determine log level from environment variable or default to 'info'
const level = process.env.LOG_LEVEL || 'info';

/** Dossier des fichiers de journaux ; `combined.log` est celui que collecte Grafana. */
const LOG_DIR = process.env.LOG_DIR || 'logs';

/**
 * Injecte automatiquement les champs de corrélation (requestId, userId,
 * projectId, job) dans CHAQUE ligne de log, sans toucher aux ~2000 call sites
 * `logger.info/warn/error(...)` existants dans la codebase. Le contexte est
 * seedé par request-trace.middleware.ts (un par requête HTTP) ou par
 * runJobWithTrace (une tâche de fond), et enrichi en cours de route
 * (authenticate() appelle setTraceUserId, les controllers/tools appellent
 * setTraceProjectId). Une valeur passée explicitement dans l'appel prime.
 */
const traceEnrichment = winston.format((info) => {
  const record = info as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(traceLogFields())) {
    if (record[key] === undefined) record[key] = value;
  }
  return info;
});

/** Isole les événements de traçage IA/Chronicle/Coherence/HTTP dans un fichier dédié. */
const AI_TRACE_PREFIXES = ['http.', 'ai.', 'chronicle.', 'coherence.', 'advisor.'];
const aiTraceFilter = winston.format((info) => {
  const event = typeof info.event === 'string' ? info.event : '';
  return AI_TRACE_PREFIXES.some((p) => event.startsWith(p)) ? info : false;
});

/**
 * Canal dédié à l'argent : encaissement, facturation, crédits, bêta, e-mails.
 *
 * Isolé du reste pour une raison pratique : quand un client dit « j'ai payé et
 * je n'ai rien reçu », on veut relire SA transaction sans la chercher au milieu
 * des générations IA. Ces lignes sont AUSSI dans `combined.log`, seul fichier
 * envoyé à Grafana (où `{service="idem-api"} | json | event=~"payment.*"` les
 * retrouve) : ce fichier-ci n'est qu'une copie locale à rétention longue.
 */
const PAYMENT_TRACE_PREFIXES = ['payment.', 'billing.', 'beta.', 'email.'];
const paymentTraceFilter = winston.format((info) => {
  const event = typeof info.event === 'string' ? info.event : '';
  return PAYMENT_TRACE_PREFIXES.some((p) => event.startsWith(p)) ? info : false;
});

const logger = winston.createLogger({
  level: level,
  format: winston.format.combine(
    winston.format.errors({ stack: true }), // Error passée seule : message + stack
    winston.format.splat(),
    normalizeErrors(), // toute erreur → champ `error` sérialisé
    traceEnrichment(), // requestId/userId/projectId on every line
    sanitizeInfo() // secrets masqués, tailles bornées, horodatage ISO
  ),
  defaultMeta: baseMeta('idem-api', process.env.npm_package_version),
  transports: [
    // Console : lisible en développement, JSON en production (stdout collecté
    // par Docker/Alloy). Forçable avec LOG_FORMAT=json|pretty.
    new winston.transports.Console({
      format: consoleIsJson() ? jsonLine : prettyConsole,
    }),
    // File transport for errors — relecture locale rapide
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: jsonLine,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    // Tous les journaux — LE fichier collecté par Alloy/Promtail vers Loki.
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: jsonLine,
      maxsize: 20971520, // 20MB
      maxFiles: 5,
      tailable: true,
    }),
    // Dedicated trace channel: HTTP requests + AI decisions (tool calls, tours
    // agentiques, requêtes Chronicle, vérifications de cohérence). Isolé pour
    // pouvoir suivre "tout ce qui se passe" avec un simple `tail -f`.
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'ai-trace.log'),
      format: winston.format.combine(aiTraceFilter(), jsonLine),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    // Canal argent : paiements, facturation, crédits, bêta, e-mails. Rétention
    // plus longue que les autres (20 Mo × 10) — une contestation de paiement
    // arrive des semaines après la transaction, et c'est précisément le moment
    // où l'on a besoin de la trace.
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'payments.log'),
      format: winston.format.combine(paymentTraceFilter(), jsonLine),
      maxsize: 20971520, // 20MB
      maxFiles: 10,
      tailable: true,
    }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

/**
 * Un incident qui doit réveiller quelqu'un : la ligne porte `alert="critical"`,
 * et la règle Grafana « Événement critique » envoie un e-mail à la première
 * occurrence (infra/observability/grafana/provisioning/alerting).
 *
 * À réserver aux cas où l'on perd de l'argent, des données ou le service :
 * paiement encaissé mais non livré, base inaccessible, crash du processus.
 */
export function logCritical(event: string, meta: Record<string, unknown> = {}): void {
  logger.error(event, { event, alert: 'critical', ...meta });
}

/**
 * Redirige `console.*` vers le logger : les ~365 `console.log/error` encore
 * présents (démarrage, gestionnaire d'erreurs global, scripts de service)
 * deviennent des lignes JSON corrélées au lieu de texte brut invisible pour
 * Grafana. Le transport Console de winston écrit directement sur stdout, sans
 * repasser par `console.log` : pas de boucle.
 */
export function captureConsole(): void {
  const route = (lvl: 'info' | 'warn' | 'error' | 'debug') =>
    (...args: unknown[]) => {
      const error = args.find((a) => a instanceof Error);
      const message = util.format(...args.filter((a) => a !== error));
      logger.log(lvl, message || (error as Error | undefined)?.message || '', {
        event: 'console',
        ...(error ? { error } : {}),
      });
    };
  console.log = route('info');
  console.info = route('info');
  console.warn = route('warn');
  console.error = route('error');
  console.debug = route('debug');
}

/**
 * Journalise les fins brutales du processus avant qu'il ne meure : sans cela,
 * un crash en production ne laisse qu'une trace texte dans les journaux Docker,
 * sans contexte et sans alerte.
 *
 * Le comportement d'avant est conservé : une exception non rattrapée est
 * journalisée et le serveur continue (c'était déjà le cas via
 * `handleExceptions` + `exitOnError: false`) ; une promesse rejetée sans
 * gestionnaire arrête le processus comme le fait Node (le conteneur redémarre)
 * — seulement, désormais, après avoir laissé une ligne critique.
 */
export function installProcessHandlers(): void {
  const report = (event: string, err: unknown) =>
    logCritical(event, { error: err instanceof Error ? err : new Error(String(err)) });
  process.on('uncaughtException', (err) => report('process.uncaught_exception', err));
  process.on('unhandledRejection', (reason) => {
    report('process.unhandled_rejection', reason);
    // Laisse aux transports fichiers le temps d'écrire la dernière ligne.
    setTimeout(() => process.exit(1), 500).unref();
  });
  process.on('warning', (warning) => {
    logger.warn(warning.message, { event: 'process.warning', error: warning });
  });
}

// Stream for Morgan (HTTP request logger)
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
