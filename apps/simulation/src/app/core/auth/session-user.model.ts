/**
 * The slice of the IDEM identity this app needs, as returned by
 * `GET {api}/auth/profile`.
 *
 * Deliberately not the API's full `UserModel`: the rest of the app depends on
 * this shape, so the identity provider stays an implementation detail of
 * `core/auth`.
 */
export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  subscription?: string | null;
  roles?: string[];
}

export type AuthStatus = 'initialising' | 'authenticated' | 'anonymous';
