/**
 * Le format commun des journaux IDEM — une ligne JSON par événement, lue par
 * Grafana/Loki (voir infra/observability/README.md pour le contrat complet).
 *
 * Ce fichier existe en trois exemplaires IDENTIQUES :
 *   apps/api/api/config/log-format.ts
 *   apps/ideploy-api/api/config/log-format.ts
 *   apps/appgen/apps/we-dev-next/src/config/log-format.ts
 * Chaque service est compilé isolément (ts-node, tsc, ESM) : un paquet partagé
 * sortirait de leur rootDir. Toute modification se reporte dans les trois, sans
 * quoi les requêtes Grafana cessent de valoir pour tous les services à la fois.
 *
 * Ce que le format garantit, quel que soit l'appel (`logger.error('x', err)`,
 * `logger.error('x', { error })`, `console.error(err)`…) :
 *  - l'erreur est sérialisée dans `error` (type, message, code, stack, cause,
 *    statut HTTP amont) au lieu de disparaître en `{}` ;
 *  - les secrets (mots de passe, jetons, cookies, clés) sont masqués ;
 *  - les chaînes trop longues et les objets trop profonds sont tronqués, pour
 *    qu'une ligne ne dépasse jamais les limites de Loki ;
 *  - l'horodatage est en ISO 8601 UTC à la milliseconde.
 */
import os from 'os';
import winston from 'winston';

const SPLAT = Symbol.for('splat');

const REDACTED = '[REDACTED]';

/**
 * Clés dont la valeur n'apparaît jamais dans un journal. Les nombres sont
 * épargnés (`inputTokens`, `totalTokens` sont des compteurs, pas des secrets).
 */
const SENSITIVE_KEY =
  /pass(word|wd|phrase)?$|secret|authorization|^cookie$|^set-cookie$|api[-_]?key|private[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|^token$|^jwt$|session[-_]?(id|token)|^otp$|^pin$|card[-_]?number|^cvv$|^cvc$/i;

const MAX_STRING = Number(process.env.LOG_MAX_STRING) || 4000;
/** Taille max d'une ligne entière ; Loki refuse au-delà de 256 Ko. */
const MAX_LINE = Number(process.env.LOG_MAX_LINE) || 64_000;
/** Champs jamais réduits par le plafond de ligne : ce sont eux qu'on filtre. */
const CORE_FIELDS = new Set([
  'level', 'message', 'timestamp', 'service', 'environment', 'version', 'host', 'pid',
  'event', 'alert', 'requestId', 'userId', 'projectId',
]);
const MAX_STACK_LINES = 25;
const MAX_DEPTH = 6;
const MAX_ARRAY = 50;
const MAX_KEYS = 100;

/** Champs posés par winston lui-même : jamais réécrits. */
const RESERVED = new Set(['level', 'message', 'timestamp']);

function truncate(value: string, max = MAX_STRING): string {
  return value.length > max ? `${value.slice(0, max)}…(${value.length} caractères)` : value;
}

/**
 * Une Error, ou un objet qui en a toutes les marques (erreurs venues d'un autre
 * realm, de certains SDK). L'erreur déjà sérialisée par ce module porte `type`
 * et non `name` : elle n'est donc pas reprise une seconde fois.
 */
function isErrorLike(value: unknown): value is Error {
  if (value instanceof Error) return true;
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Error).name === 'string' &&
    typeof (value as Error).message === 'string' &&
    typeof (value as Error).stack === 'string'
  );
}

/**
 * Une erreur réduite à ce qui sert au diagnostic. Les erreurs HTTP d'axios et
 * de fetch gardent le statut, la méthode et l'URL de l'appel amont — c'est
 * souvent la seule piste quand un fournisseur (Gemini, pawaPay, Netlify) casse.
 */
export function serializeError(err: unknown, depth = 0): Record<string, unknown> {
  if (!isErrorLike(err)) {
    return { type: typeof err, message: truncate(String(err)) };
  }
  const e = err as Error & Record<string, unknown>;
  const out: Record<string, unknown> = {
    type: e.name || e.constructor?.name || 'Error',
    message: truncate(e.message || ''),
  };
  if (e.code !== undefined) out.code = e.code;
  const status = e.status ?? e.statusCode;
  if (status !== undefined) out.status = status;
  if (typeof e.stack === 'string') {
    out.stack = e.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n');
  }

  // axios
  const response = e.response as { status?: number; data?: unknown } | undefined;
  const config = e.config as { method?: string; url?: string; baseURL?: string } | undefined;
  if (response && typeof response === 'object') {
    out.upstream = {
      status: response.status,
      method: config?.method?.toUpperCase(),
      url: config ? stripQuery(`${config.baseURL ?? ''}${config.url ?? ''}`) : undefined,
      body: sanitize(response.data, 2),
    };
  }

  // Champs métier ajoutés sur l'erreur (AppError.details, etc.)
  for (const key of ['details', 'reason', 'errors', 'kind'] as const) {
    if (e[key] !== undefined) out[key] = sanitize(e[key], 2);
  }

  if (e.cause !== undefined && depth < 3) {
    out.cause = serializeError(e.cause, depth + 1);
  }
  return out;
}

function stripQuery(url: string): string {
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}

/** Copie sûre, bornée et expurgée d'une valeur quelconque. */
export function sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string') return truncate(value as string);
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'bigint') return (value as bigint).toString();
  if (t === 'function' || t === 'symbol') return undefined;

  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `<Buffer ${value.length} octets>`;
  if (isErrorLike(value)) return serializeError(value);

  const obj = value as Record<string, unknown>;
  // ObjectId Mongo, Decimal, URL… : leur forme texte est la seule utile.
  if (typeof (obj as { toHexString?: unknown }).toHexString === 'function') {
    return (obj as unknown as { toHexString(): string }).toHexString();
  }
  if (value instanceof URL) return stripQuery(value.toString());

  if (seen.has(obj)) return '[Circular]';
  if (depth >= MAX_DEPTH) return '[Object]';
  seen.add(obj);

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((v) => sanitize(v, depth + 1, seen));
    if (value.length > MAX_ARRAY) items.push(`…(${value.length - MAX_ARRAY} de plus)`);
    return items;
  }
  if (value instanceof Map) {
    return sanitize(Object.fromEntries(value), depth, seen);
  }
  if (value instanceof Set) {
    return sanitize([...value], depth, seen);
  }

  const out: Record<string, unknown> = {};
  let count = 0;
  for (const key of Object.keys(obj)) {
    if (++count > MAX_KEYS) {
      out['…'] = `${Object.keys(obj).length - MAX_KEYS} clés de plus`;
      break;
    }
    out[key] = redactField(key, obj[key], depth, seen);
  }
  return out;
}

/**
 * Numéros de téléphone (Mobile Money) : on garde les deux derniers chiffres —
 * assez pour qu'un agent de support confirme un numéro dicté, trop peu pour le
 * reconstituer. Un log part vers Loki, consultable par tout lecteur des tableaux.
 */
const PHONE_KEY = /^(phone(number)?|phone_number|msisdn|mobile(number)?)$/i;

function redactField(key: string, value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (PHONE_KEY.test(key) && (typeof value === 'string' || typeof value === 'number')) {
    const raw = String(value);
    return raw.length > 2 ? `***${raw.slice(-2)}` : '***';
  }
  if (SENSITIVE_KEY.test(key) && value !== null && value !== undefined && typeof value !== 'number' && typeof value !== 'boolean') {
    return REDACTED;
  }
  return sanitize(value, depth + 1, seen);
}

/**
 * Ramène toute erreur dans le champ `error`, quelle que soit la façon dont elle
 * a été passée au logger :
 *  - `logger.error('x', err)`   → winston a collé `err.message` au message et
 *    copié `stack` ; l'objet d'origine est retrouvé dans les arguments (SPLAT) ;
 *  - `logger.error('x', { error })` / `{ err }` → sans ce format, JSON.stringify
 *    d'une Error donne `{}` : l'erreur était perdue ;
 *  - `logger.error(err)`        → déjà transformé par `format.errors()`.
 */
export const normalizeErrors = winston.format((info) => {
  const record = info as unknown as Record<string | symbol, unknown>;

  const splat = record[SPLAT];
  const fromSplat = Array.isArray(splat) ? splat.find(isErrorLike) : undefined;

  let found: unknown = fromSplat;
  for (const key of ['error', 'err', 'e', 'exception', 'reason']) {
    if (isErrorLike(record[key])) {
      found = found ?? record[key];
      if (key !== 'error') delete record[key];
    }
  }

  if (found) {
    record.error = serializeError(found);
    // `logger.error('x', err)` : winston a recopié les propriétés propres de
    // l'erreur (code, cause, response…) à la racine — elles sont dans `error`.
    if (found === fromSplat) {
      for (const key of Object.keys(found as object)) {
        if (key !== 'error' && key !== 'message' && !RESERVED.has(key)) delete record[key];
      }
    }
  } else if (typeof record.stack === 'string' && !record.error) {
    record.error = {
      type: typeof record.name === 'string' ? record.name : 'Error',
      message: truncate(String(record.message ?? '')),
      stack: (record.stack as string).split('\n').slice(0, MAX_STACK_LINES).join('\n'),
    };
  }
  delete record.stack;
  return info;
});

/** Expurge et borne toutes les métadonnées, puis fixe l'horodatage ISO. */
export const sanitizeInfo = winston.format((info) => {
  const record = info as unknown as Record<string, unknown>;
  const seen = new WeakSet<object>();
  for (const key of Object.keys(record)) {
    if (RESERVED.has(key)) continue;
    record[key] = redactField(key, record[key], -1, seen);
  }
  if (typeof record.message !== 'string') {
    record.message = record.message === undefined ? '' : JSON.stringify(sanitize(record.message));
  }
  record.message = truncate(record.message as string);
  record.timestamp = new Date().toISOString();
  capLineSize(record);
  return info;
});

/**
 * Plafond de la ligne entière. Chaque champ est déjà borné, mais un objet
 * métier complet (un projet et son analyse) peut encore peser des centaines de
 * Ko — Loki rejetterait alors la ligne, et avec elle l'information utile. Les
 * champs les plus lourds sont remplacés un à un par un aperçu, jusqu'à passer.
 */
function capLineSize(record: Record<string, unknown>): void {
  const size = (v: unknown) => {
    try {
      return JSON.stringify(v)?.length ?? 0;
    } catch {
      return 0;
    }
  };
  if (size(record) <= MAX_LINE) return;

  const heavy = Object.keys(record)
    .filter((key) => !CORE_FIELDS.has(key))
    .map((key) => ({ key, bytes: size(record[key]) }))
    .sort((a, b) => b.bytes - a.bytes);

  for (const { key, bytes } of heavy) {
    const preview = JSON.stringify(record[key]) ?? '';
    record[key] = `${preview.slice(0, 1000)}…(réduit : ${bytes} caractères)`;
    if (size(record) <= MAX_LINE) return;
  }
}

/** Champs posés sur chaque ligne : de quel processus, de quelle version. */
export function baseMeta(service: string, version?: string): Record<string, string | number> {
  return {
    service,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || version || 'dev',
    host: process.env.HOSTNAME || os.hostname(),
    pid: process.pid,
  };
}

/** `LOG_FORMAT=json|pretty` ; JSON par défaut en production (stdout collecté). */
export function consoleIsJson(): boolean {
  const fmt = (process.env.LOG_FORMAT || '').toLowerCase();
  if (fmt === 'json') return true;
  if (fmt === 'pretty') return false;
  return process.env.NODE_ENV === 'production';
}

// Champs de structure non répétés en fin de ligne dans la console lisible.
const PRETTY_HIDDEN = new Set([
  'timestamp', 'level', 'message', 'service', 'environment', 'version', 'host', 'pid',
  'event', 'requestId', 'error',
]);

/**
 * Rendu console pour le développement :
 * `12:04:31.201 error [req=1a2b3c4d] ai.tool_call_end · tool=x durationMs=42`
 * puis la pile de l'erreur, indentée. Le fichier et la sortie JSON gardent tout.
 */
export const prettyConsole = winston.format.combine(
  winston.format.colorize({ level: true }),
  winston.format.printf((info) => {
    const r = info as unknown as Record<string, unknown>;
    const time = typeof r.timestamp === 'string' ? r.timestamp.slice(11, 23) : '';
    const req = typeof r.requestId === 'string' ? ` [req=${r.requestId.slice(0, 8)}]` : '';
    const parts: string[] = [];
    if (typeof r.event === 'string' && r.event !== r.message) parts.push(`event=${r.event}`);
    for (const key of Object.keys(r)) {
      if (PRETTY_HIDDEN.has(key)) continue;
      const v = r[key];
      if (v === undefined) continue;
      parts.push(`${key}=${v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    }
    let line = `${time} ${info.level}${req} ${r.message}${parts.length ? ` · ${parts.join(' ')}` : ''}`;
    const err = r.error as { type?: string; message?: string; stack?: string } | undefined;
    if (err) {
      const head = `${err.type ?? 'Error'}: ${err.message ?? ''}`;
      line += `\n    ${err.stack ? err.stack.replace(/\n/g, '\n    ') : head}`;
    }
    return line;
  })
);

/** Une ligne JSON par événement : ce que lit Alloy/Promtail puis Loki. */
export const jsonLine = winston.format.json();
