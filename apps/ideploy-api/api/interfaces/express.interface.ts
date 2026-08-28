import { Request } from 'express';

/** The application user resolved from the Postgres `users` table. */
export interface AuthUser {
  id: number;
  idemUid: string | null;
  email: string;
  name: string;
  /** The team the request is acting on behalf of (current/selected team). */
  currentTeamId: number | null;
}

/** Express request augmented with the authenticated user (from the session). */
export interface CustomRequest extends Request {
  user?: AuthUser;
  /**
   * The body exactly as received.
   *
   * Webhook signatures are computed over the transmitted bytes, and
   * `express.json()` discards them once parsed — re-serialising the parsed object
   * changes key order and whitespace, so the HMAC would never match. Captured by
   * the `verify` hook in `app.ts`.
   */
  rawBody?: Buffer;
}
