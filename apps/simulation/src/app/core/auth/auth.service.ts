import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';

import { environment } from '@env';

import { CookieService } from './cookie.service';
import { FIREBASE_AUTH } from './firebase.providers';
import { AuthStatus, SessionUser } from './session-user.model';
import { TokenService } from './token.service';

const CURRENT_USER_COOKIE = 'currentUser';
const SESSION_ACTIVE_COOKIE = 'idem_session_active';
/** How often the tab checks whether another IDEM app signed the user out. */
const GLOBAL_LOGOUT_POLL_MS = 3000;

export type SocialProvider = 'google' | 'github';

/**
 * The IDEM identity, as used by every app in the ecosystem: Firebase Auth for
 * the credential, the IDEM API for the server session, and shared cookies so
 * a sign-out in one app propagates to the others.
 *
 * This app never owns accounts — it only reads the identity IDEM already
 * issued.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly cookies = inject(CookieService);
  private readonly apiUrl = `${environment.services.api.url}/auth`;

  private readonly currentUser = signal<SessionUser | null>(null);
  private readonly authStatus = signal<AuthStatus>('initialising');

  readonly user = this.currentUser.asReadonly();
  readonly status = this.authStatus.asReadonly();
  readonly isAuthenticated = computed(() => this.authStatus() === 'authenticated');
  /** True while a `signInWithRedirect` round-trip is being completed. */
  readonly redirectInProgress = signal(false);

  /** Resolves once the initial auth state (including redirect results) is known. */
  readonly ready: Promise<SessionUser | null>;

  constructor() {
    if (!this.auth) {
      // No Firebase credentials: restore whatever the cookies hold so the
      // demo dataset stays browsable, and stop there.
      this.currentUser.set(this.readUserCookie());
      this.authStatus.set(this.currentUser() ? 'authenticated' : 'anonymous');
      this.ready = Promise.resolve(this.currentUser());
      return;
    }

    const auth = this.auth;
    onAuthStateChanged(auth, (user) => {
      this.currentUser.set(user ? toSessionUser(user) : null);
      this.authStatus.set(user ? 'authenticated' : 'anonymous');
    });

    this.ready = this.completeRedirectSignIn();

    if (typeof window !== 'undefined') {
      window.setInterval(() => this.syncGlobalLogout(), GLOBAL_LOGOUT_POLL_MS);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<SessionUser> {
    const auth = this.requireAuth();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await this.completeSignIn(credential.user);
    return toSessionUser(credential.user);
  }

  /**
   * Popup sign-in, falling back to a redirect on mobile browsers where popups
   * are blocked or silently dropped.
   */
  async signInWithProvider(provider: SocialProvider): Promise<SessionUser | null> {
    const auth = this.requireAuth();
    const authProvider = buildProvider(provider);

    try {
      const credential = await signInWithPopup(auth, authProvider);
      await this.completeSignIn(credential.user);
      return toSessionUser(credential.user);
    } catch (error) {
      if (!isMobile()) {
        throw error;
      }
      await signInWithRedirect(auth, authProvider);
      return null;
    }
  }

  /**
   * Consumes a Firebase custom token minted by the IDEM API, which is how the
   * "Simuler mon entreprise" button hands a dashboard session over to this app
   * without a second sign-in.
   */
  async signInWithHandoffToken(customToken: string): Promise<SessionUser> {
    const auth = this.requireAuth();
    const credential = await signInWithCustomToken(auth, customToken);
    await this.completeSignIn(credential.user);
    return toSessionUser(credential.user);
  }

  async signOut(): Promise<void> {
    try {
      if (this.auth) {
        await signOut(this.auth);
      }
    } catch (error) {
      console.error('[auth] Firebase sign-out failed; clearing the local session anyway', error);
    }

    this.tokens.clear();
    this.cookies.remove(CURRENT_USER_COOKIE);
    // Sentinel read by every IDEM app: tells the other tabs to sign out too.
    this.cookies.set(SESSION_ACTIVE_COOKIE, '0', 30);
    this.currentUser.set(null);
    this.authStatus.set('anonymous');

    try {
      sessionStorage.clear();
    } catch {
      // Storage can be unavailable in private browsing; nothing to clean up.
    }

    try {
      await firstValueFrom(
        this.http.post<void>(`${this.apiUrl}/logout`, {}, { withCredentials: true }),
      );
    } catch (error) {
      console.warn('[auth] Backend sign-out failed; the local session is cleared', error);
    }
  }

  private async completeRedirectSignIn(): Promise<SessionUser | null> {
    const auth = this.requireAuth();
    this.redirectInProgress.set(true);
    try {
      const result = await getRedirectResult(auth);
      if (!result?.user) {
        return null;
      }
      await this.completeSignIn(result.user);
      return toSessionUser(result.user);
    } catch (error) {
      console.error('[auth] Could not complete the redirect sign-in', error);
      return null;
    } finally {
      this.redirectInProgress.set(false);
    }
  }

  /**
   * Everything that has to happen once a credential is obtained: mint the ID
   * token, mirror the identity into the shared cookies, and open the server
   * session on the IDEM API.
   */
  private async completeSignIn(user: User): Promise<void> {
    const token = await this.tokens.refresh(user);
    const sessionUser = toSessionUser(user);

    this.currentUser.set(sessionUser);
    this.authStatus.set('authenticated');
    this.cookies.set(CURRENT_USER_COOKIE, JSON.stringify(sessionUser), 30);
    this.cookies.set(SESSION_ACTIVE_COOKIE, '1', 30);

    if (!token) {
      console.error('[auth] Signed in but no ID token was issued; skipping the session call');
      return;
    }

    try {
      await firstValueFrom(
        this.http.post<void>(
          `${this.apiUrl}/sessionLogin`,
          { token, user: sessionUser },
          { withCredentials: true },
        ),
      );
    } catch (error) {
      console.error('[auth] Could not open the IDEM API session', error);
    }
  }

  /** Signs this tab out when another IDEM app flipped the shared sentinel. */
  private syncGlobalLogout(): void {
    if (this.authStatus() !== 'authenticated') {
      return;
    }
    if (this.cookies.get(SESSION_ACTIVE_COOKIE) === '0') {
      void this.signOut();
    }
  }

  private readUserCookie(): SessionUser | null {
    const raw = this.cookies.get(CURRENT_USER_COOKIE);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<SessionUser>;
      return parsed.uid
        ? {
            uid: parsed.uid,
            email: parsed.email ?? null,
            displayName: parsed.displayName ?? null,
            photoURL: parsed.photoURL ?? null,
            emailVerified: parsed.emailVerified ?? false,
          }
        : null;
    } catch {
      this.cookies.remove(CURRENT_USER_COOKIE);
      return null;
    }
  }

  private requireAuth() {
    if (!this.auth) {
      throw new Error(
        'Firebase is not configured. Fill in the IDEM Firebase credentials in .env to sign in.',
      );
    }
    return this.auth;
  }
}

function buildProvider(provider: SocialProvider): AuthProvider {
  return provider === 'github' ? new GithubAuthProvider() : new GoogleAuthProvider();
}

function toSessionUser(user: User): SessionUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
