import winston from 'winston';
import { traceLogFields } from '../utils/trace.util';

// Determine log level from environment variable or default to 'info'
const level = process.env.LOG_LEVEL || 'info';

/**
 * Injecte automatiquement les champs de corrélation (requestId, userId,
 * projectId) dans CHAQUE ligne de log, sans toucher aux ~200 call sites
 * `logger.info/warn/error(...)` existants dans la codebase. Le contexte est
 * seedé par request-trace.middleware.ts (un par requête HTTP) et enrichi en
 * cours de route (authenticate() appelle setTraceUserId, les
 * controllers/tools appellent setTraceProjectId).
 */
const traceEnrichment = winston.format((info) => {
  Object.assign(info, traceLogFields());
  return info;
});

/** Isole les événements de traçage IA/Chronicle/Coherence/HTTP dans un fichier dédié. */
const AI_TRACE_PREFIXES = ['http.', 'ai.', 'chronicle.', 'coherence.', 'advisor.'];
const aiTraceFilter = winston.format((info) => {
  const event = typeof info.event === 'string' ? info.event : '';
  return AI_TRACE_PREFIXES.some((p) => event.startsWith(p)) ? info : false;
});

// Champs "de structure" à ne PAS répéter comme métadonnées inline en console.
const CONSOLE_HIDDEN_FIELDS = new Set([
  'timestamp',
  'level',
  'message',
  'service',
  'environment',
  'stack',
  'event',
]);

/**
 * Rendu compact des métadonnées d'une ligne de log pour la console: transforme
 * `{ tool: 'project_get_map', ok: true, durationMs: 42 }` en
 * `tool=project_get_map ok=true durationMs=42`. Sans cela la console
 * n'afficherait que le nom de l'événement (`ai.tool_call_end`) sans aucun
 * détail — inutilisable pour suivre ce que fait l'IA en temps réel.
 */
function formatConsoleMeta(info: Record<string, unknown>): string {
  const parts: string[] = [];
  // requestId d'abord (corrélation), raccourci à 8 caractères pour la lisibilité.
  if (typeof info.requestId === 'string') {
    parts.push(`req=${info.requestId.slice(0, 8)}`);
  }
  for (const key of Object.keys(info)) {
    if (CONSOLE_HIDDEN_FIELDS.has(key) || key === 'requestId') continue;
    const value = info[key];
    if (value === undefined) continue;
    const rendered =
      value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
    parts.push(`${key}=${rendered}`);
  }
  return parts.join(' ');
}

// Define different logging formats
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const base = `${info.timestamp} ${info.level}: ${info.message}`;
    // Pour les événements de traçage (logAIEvent), afficher les métadonnées
    // inline afin de suivre en temps réel dans le terminal. Les logs texte
    // classiques (qui portent déjà tout dans leur message) restent inchangés.
    if (typeof info.event === 'string') {
      const meta = formatConsoleMeta(info as Record<string, unknown>);
      return meta ? `${base} · ${meta}` : base;
    }
    return base;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json() // Log in JSON format to files
);

const logger = winston.createLogger({
  level: level,
  format: winston.format.combine(
    winston.format.errors({ stack: true }), // Log stack traces for errors
    winston.format.splat(),
    traceEnrichment(), // requestId/userId/projectId on every line
    winston.format.json()
  ),
  defaultMeta: {
    service: 'idem-api',         // Service label for Loki/Promtail
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport - for development or general output
    // Also collected by Promtail via Docker log driver
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true, // Log unhandled exceptions
    }),
    // File transport for errors — scraped by Promtail
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    // File transport for all logs — scraped by Promtail
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    // Dedicated trace channel: HTTP requests + AI decisions (tool calls, tours
    // agentiques, requêtes Chronicle, vérifications de cohérence). Isolé pour
    // pouvoir suivre "tout ce qui se passe" avec un simple `tail -f`.
    new winston.transports.File({
      filename: 'logs/ai-trace.log',
      format: winston.format.combine(aiTraceFilter(), fileFormat),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// Stream for Morgan (HTTP request logger)
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
