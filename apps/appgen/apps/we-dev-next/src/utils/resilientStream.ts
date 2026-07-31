import type { Response } from 'express';
import { Messages } from '../types/project.js';
import { streamTextFn, StreamingOptions } from '../services/aiService.js';
import { getFallbackModelKeys } from '../config/modelConfig.js';
import { ChatLogger } from './logger.js';

/**
 * Repli automatique entre modèles Gemini.
 *
 * Google renvoie 503 « This model is currently experiencing high demand » dès
 * qu'un modèle est saturé : la requête est valide, c'est la capacité qui manque,
 * et les pools sont PAR MODÈLE. Rejouer le même modèle ne sert donc à rien — on
 * bascule sur le suivant de la chaîne (voir `getFallbackModelKeys`).
 */

/** Prefix of an error part in the Vercel AI data stream protocol (`3:"..."`). */
const ERROR_PART_PREFIX = '3:';

/** Breather between two models so we do not hammer a provider that is spiking. */
const DELAY_BETWEEN_MODELS_MS = 750;

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const TRANSIENT_MESSAGE_PATTERNS = [
  'high demand',
  'overloaded',
  'unavailable',
  'try again later',
  'rate limit',
  'resource_exhausted',
  'resource exhausted',
  'too many requests',
  'internal error',
  'deadline exceeded',
  'timeout',
  'timed out',
  'socket hang up',
  'econnreset',
  'etimedout',
  'fetch failed',
];

/** Walks the error graph the AI SDK builds (cause / errors[] / lastError). */
function flattenErrors(error: unknown, out: any[] = [], depth = 0): any[] {
  if (error == null || depth > 5) {
    return out;
  }

  out.push(error);

  if (typeof error !== 'object') {
    return out;
  }

  const node = error as any;

  flattenErrors(node.cause, out, depth + 1);
  flattenErrors(node.error, out, depth + 1);
  flattenErrors(node.lastError, out, depth + 1);

  if (Array.isArray(node.errors)) {
    for (const nested of node.errors) {
      flattenErrors(nested, out, depth + 1);
    }
  }

  return out;
}

function errorText(error: unknown): string {
  return flattenErrors(error)
    .map((node) => {
      if (typeof node === 'string') return node;
      if (typeof node !== 'object') return String(node);
      return [node.message, node.reason, node.responseBody].filter(Boolean).join(' ');
    })
    .join(' | ')
    .toLowerCase();
}

/**
 * Échecs propres à un modèle donné (retiré, restreint pour cette clé, non
 * supporté) : un autre modèle de la chaîne peut très bien répondre.
 */
const MODEL_UNAVAILABLE_PATTERNS = [
  'not found',
  'does not exist',
  'is not supported',
  'unsupported model',
  'model configuration not found',
];

function isModelUnavailableError(error: unknown): boolean {
  const nodes = flattenErrors(error);

  for (const node of nodes) {
    if (node && typeof node === 'object' && (node as any).statusCode === 404) {
      return true;
    }
  }

  const text = errorText(error);
  return MODEL_UNAVAILABLE_PATTERNS.some((pattern) => text.includes(pattern));
}

/** Faut-il tenter le modèle suivant de la chaîne ? */
export function shouldTryNextModel(error: unknown): boolean {
  return isTransientModelError(error) || isModelUnavailableError(error);
}

/**
 * True when retrying (on another model) has a real chance of succeeding:
 * provider saturation, rate limits, gateway hiccups, network blips.
 */
export function isTransientModelError(error: unknown): boolean {
  const nodes = flattenErrors(error);

  for (const node of nodes) {
    if (node && typeof node === 'object') {
      const { statusCode, isRetryable } = node as any;
      if (typeof statusCode === 'number' && TRANSIENT_STATUS_CODES.has(statusCode)) {
        return true;
      }
      if (isRetryable === true) {
        return true;
      }
    }
  }

  const text = errorText(error);
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => text.includes(pattern));
}

function rawErrorMessage(error: unknown): string {
  for (const node of flattenErrors(error)) {
    if (typeof node === 'string' && node.trim()) return node.trim();
    if (node && typeof node === 'object') {
      const message = (node as any).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }
  return 'Unknown error';
}

function overloadedMessage(models: string[], language?: string): string {
  const list = models.join(', ');

  return language === 'fr'
    ? `Le fournisseur IA est momentanément saturé (modèles essayés : ${list}). Aucun jeton n'a été consommé, relancez la génération dans quelques instants.`
    : `The AI provider is temporarily overloaded (models tried: ${list}). No tokens were spent — please start the generation again in a moment.`;
}

function midStreamMessage(model: string, error: unknown, language?: string): string {
  if (isTransientModelError(error)) {
    return language === 'fr'
      ? `La génération a été interrompue : le modèle ${model} est momentanément saturé. Relancez la génération.`
      : `Generation was interrupted: model ${model} is temporarily overloaded. Please try again.`;
  }

  return rawErrorMessage(error);
}

function startsWithErrorPart(chunk: Uint8Array): boolean {
  return new TextDecoder().decode(chunk.slice(0, ERROR_PART_PREFIX.length)) === ERROR_PART_PREFIX;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ResilientStream {
  /** Same shape as the AI SDK result so callers/routes stay unchanged. */
  pipeDataStreamToResponse(res: Response): Promise<void>;
}

/**
 * Streams the model answer to the Express response, transparently falling back
 * to the next configured model when the requested one fails *before* emitting
 * any output (typically Gemini's 503 "high demand").
 *
 * Once the first byte is on the wire we can no longer switch, so a mid-stream
 * failure is forwarded to the client as a readable error part instead of the
 * SDK's masked "An error occurred.".
 */
export function createResilientStream(
  messages: Messages,
  options: StreamingOptions,
  modelKey: string,
  language?: string
): ResilientStream {
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const candidates = getFallbackModelKeys(modelKey);
      const tried: string[] = [];
      let lastError: unknown;

      for (let index = 0; index < candidates.length; index++) {
        const candidate = candidates[index];
        const isLastCandidate = index === candidates.length - 1;
        tried.push(candidate);

        let capturedError: unknown;
        let stream: ReadableStream<Uint8Array>;

        try {
          const result = streamTextFn(
            messages,
            {
              ...options,
              onError: (error: unknown) => {
                capturedError = error;
                ChatLogger.error('MODEL_STREAM_ERROR', `Model ${candidate} failed`, error);
                // Never rethrow here: the AI SDK calls this inside a stream
                // transform, so throwing surfaces as an unhandled rejection.
              },
            },
            candidate
          );

          stream = result.toDataStream({
            getErrorMessage: (error: unknown) => {
              capturedError = error ?? capturedError;
              return midStreamMessage(candidate, capturedError, language);
            },
          }) as ReadableStream<Uint8Array>;
        } catch (error) {
          // Synchronous failures: unknown model key, missing API key, ...
          lastError = error;
          ChatLogger.error('MODEL_INIT_FAILED', `Cannot start stream on ${candidate}`, error);

          if (shouldTryNextModel(error) && !isLastCandidate) {
            await delay(DELAY_BETWEEN_MODELS_MS);
            continue;
          }
          break;
        }

        const reader = stream.getReader();
        let first: { done: boolean; value?: Uint8Array };

        try {
          first = await reader.read();
        } catch (error) {
          capturedError = error;
          first = { done: true, value: undefined };
        }

        // An error before the first content chunk means the provider call never
        // got off the ground: safe to try another model, nothing is written yet.
        if (first.done || !first.value || startsWithErrorPart(first.value)) {
          lastError = capturedError ?? lastError;
          reader.cancel().catch(() => undefined);

          const recoverable = capturedError == null || shouldTryNextModel(capturedError);

          if (recoverable && !isLastCandidate) {
            ChatLogger.warn('MODEL_FALLBACK', `Switching from ${candidate} to next model`, {
              nextModel: candidates[index + 1],
              reason: capturedError ? rawErrorMessage(capturedError) : 'empty stream',
            });
            await delay(DELAY_BETWEEN_MODELS_MS);
            continue;
          }
          break;
        }

        ChatLogger.success('MODEL_SELECTED', `Streaming with ${candidate}`, {
          requestedModel: modelKey,
          fellBack: candidate !== modelKey,
        });

        res.writeHead(200, {
          'content-type': 'text/plain; charset=utf-8',
          'x-vercel-ai-data-stream': 'v1',
          'x-idem-model': candidate,
        });

        res.on('close', () => {
          reader.cancel().catch(() => undefined);
        });

        try {
          res.write(first.value);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } catch (error) {
          ChatLogger.error('STREAM_PIPE_FAILED', 'Error while piping stream to client', error);
        } finally {
          res.end();
        }

        return;
      }

      // Nothing was written yet: answer with a real HTTP error so the client
      // can display something actionable instead of "An error occurred.".
      const transient = lastError == null || isTransientModelError(lastError);
      const message = transient ? overloadedMessage(tried, language) : rawErrorMessage(lastError);
      const status = transient ? 503 : /api key/i.test(message) ? 401 : 500;

      ChatLogger.error('ALL_MODELS_FAILED', 'Every candidate model failed', {
        tried,
        status,
        message,
      });

      if (!res.headersSent) {
        res.status(status).send(message);
      } else {
        res.end();
      }
    },
  };
}
