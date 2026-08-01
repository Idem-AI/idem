/**
 * Typed domain errors.
 *
 * Replaces the `throw new Error('NO_DESTINATION: …')` / string-matching pattern
 * the codebase started with: the code was embedded in the message, so a reworded
 * message silently broke the controller's `startsWith()` check, and every caller
 * reimplemented the mapping to an HTTP status.
 *
 * Services raise a `DomainError` with a stable machine code; controllers map it
 * once, in `respondWithError`.
 */
export class DomainError extends Error {
  constructor(
    /** Stable, screaming-snake identifier the frontend can branch on. */
    readonly code: string,
    /** Message intended for the user — actionable, no internals. */
    message: string,
    /** HTTP status this maps to. */
    readonly status = 400
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** The requested resource does not exist, or is not visible to this team. */
export function notFound(what: string): DomainError {
  return new DomainError('NOT_FOUND', `${what} not found.`, 404);
}

/** The request conflicts with existing state (duplicate, already in use, …). */
export function conflict(code: string, message: string): DomainError {
  return new DomainError(code, message, 409);
}

/** The request is well-formed but cannot be satisfied in the current state. */
export function unprocessable(code: string, message: string): DomainError {
  return new DomainError(code, message, 422);
}

/**
 * Authenticated, but not entitled — a plan limitation rather than a mistake.
 * Distinct from 401: retrying with different credentials will not help.
 */
export function forbidden(code: string, message: string): DomainError {
  return new DomainError(code, message, 403);
}

/**
 * The route exists but the capability behind it does not yet.
 *
 * Reserved for the case where answering "done" would be a lie the caller acts
 * on — a security control reported as active while nothing enforces it, for
 * instance. Failing loudly is the safe answer; a cheerful 200 is not.
 */
export function notImplemented(code: string, message: string): DomainError {
  return new DomainError(code, message, 501);
}
