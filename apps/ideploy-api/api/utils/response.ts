import { Response } from 'express';
import logger from '../config/logger';
import { isDomainError } from './errors';

/** Standard success envelope (matches apps/api convention). */
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

/** Standard error envelope. */
export function fail(res: Response, message: string, status = 500, code?: string): void {
  res.status(status).json({ success: false, error: { code: code ?? null, message } });
}

/** One rejected input field: where it was and what is wrong with it. */
export interface FieldError {
  path: string;
  message: string;
}

/**
 * Validation failure. Same envelope as `fail`, plus per-field detail so the
 * frontend can mark the offending inputs instead of showing one opaque banner.
 */
export function failValidation(res: Response, details: FieldError[], message?: string): void {
  res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION',
      message: message ?? 'The submitted data is invalid.',
      details,
    },
  });
}

/**
 * Single place that turns a thrown error into a response.
 *
 * A `DomainError` carries its own code and status and is safe to show the user.
 * Anything else is a bug or an infrastructure failure: log it with context, and
 * return the caller a generic message rather than leaking internals.
 */
export function respondWithError(res: Response, error: unknown, context: string): void {
  if (isDomainError(error)) {
    fail(res, error.message, error.status, error.code);
    return;
  }

  logger.error(`${context} failed`, {
    message: (error as Error)?.message,
    stack: (error as Error)?.stack,
  });
  fail(res, `${context} failed. Please try again.`, 500, 'INTERNAL');
}
