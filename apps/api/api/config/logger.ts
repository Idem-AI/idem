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

// Define different logging formats
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
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
