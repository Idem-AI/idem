import path from 'path';
import util from 'util';
import winston from 'winston';
import { traceLogFields } from '../utils/trace.js';
import {
  baseMeta,
  consoleIsJson,
  jsonLine,
  normalizeErrors,
  prettyConsole,
  sanitizeInfo,
} from './log-format.js';

// Determine log level from environment variable or default to 'info'
const level = process.env.LOG_LEVEL || 'info';

/** Dossier des fichiers de journaux ; `combined.log` est celui que collecte Grafana. */
const LOG_DIR = process.env.LOG_DIR || 'logs';

/**
 * Injecte automatiquement les champs de corrélation (requestId, userId,
 * projectId) dans CHAQUE ligne de log. Le contexte est seedé par
 * middleware/requestTrace.ts (un par requête HTTP) et enrichi par
 * requireIdemUser (setTraceUserId). Une valeur passée explicitement prime.
 */
const traceEnrichment = winston.format((info) => {
  const record = info as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(traceLogFields())) {
    if (record[key] === undefined) record[key] = value;
  }
  return info;
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
  defaultMeta: baseMeta('appgen', process.env.npm_package_version),
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
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

/**
 * Un incident qui doit réveiller quelqu'un : la ligne porte `alert="critical"`,
 * et la règle Grafana « Événement critique » envoie un e-mail à la première
 * occurrence (infra/observability/grafana/provisioning/alerting).
 *
 * À réserver aux cas où l'on perd de l'argent, des données ou le service :
 * tous les fournisseurs de modèles en échec, API centrale injoignable (plus
 * personne ne peut générer), crash du processus. Une génération ratée sur un
 * prompt n'en est pas une.
 */
export function logCritical(event: string, meta: Record<string, unknown> = {}): void {
  logger.error(event, { event, alert: 'critical', ...meta });
}

/**
 * Redirige `console.*` vers le logger : ce qu'écrivent encore des dépendances
 * ou des scripts devient des lignes JSON corrélées au lieu de texte brut
 * invisible pour Grafana. Le transport Console de winston écrit directement sur stdout, sans
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
 * Le comportement d'avant est conservé : une exception non rattrapée arrête le
 * processus (le conteneur redémarre), une promesse rejetée sans gestionnaire
 * est journalisée et le serveur continue — un flux de génération interrompu ne
 * doit pas couper ceux des autres utilisateurs.
 */
export function installProcessHandlers(): void {
  const report = (event: string, err: unknown) =>
    logCritical(event, { error: err instanceof Error ? err : new Error(String(err)) });
  process.on('uncaughtException', (err) => {
    report('process.uncaught_exception', err);
    // Laisse aux transports fichiers le temps d'écrire la dernière ligne.
    setTimeout(() => process.exit(1), 500).unref();
  });
  process.on('unhandledRejection', (reason) => report('process.unhandled_rejection', reason));
  process.on('warning', (warning) => {
    logger.warn(warning.message, { event: 'process.warning', error: warning });
  });
}

export default logger;
