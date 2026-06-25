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
}
