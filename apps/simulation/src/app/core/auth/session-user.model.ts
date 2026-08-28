/**
 * The slice of the IDEM identity this app needs.
 *
 * Deliberately not Firebase's `User`: the rest of the app depends on this
 * shape, so the identity provider stays an implementation detail of
 * `core/auth`.
 */
export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export type AuthStatus = 'initialising' | 'authenticated' | 'anonymous';
