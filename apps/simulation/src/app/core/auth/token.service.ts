import { Injectable, inject, signal } from '@angular/core';
import { User, onAuthStateChanged } from 'firebase/auth';

import { CookieService } from './cookie.service';
import { FIREBASE_AUTH } from './firebase.providers';

const TOKEN_COOKIE = 'authToken';
const TOKEN_EXPIRY_COOKIE = 'authTokenExpiry';
/** Firebase ID tokens live an hour; refresh a little before that. */
const TOKEN_TTL_MS = 55 * 60 * 1000;

/**
 * Owns the Firebase ID token.
 *
 * Split out from `AuthService` for the same reason as in the dashboard: the
 * HTTP interceptor needs a token without pulling in the whole auth surface,
 * which would create a cycle through `HttpClient`.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly cookies = inject(CookieService);

  private readonly token = signal<string | null>(null);
  /** Resolves once Firebase has reported its initial auth state. */
  readonly ready: Promise<void>;

  constructor() {
    this.loadFromCookies();

    if (!this.auth) {
      this.ready = Promise.resolve();
      return;
    }

    const auth = this.auth;
    this.ready = new Promise<void>((resolve) => {
      let settled = false;
      onAuthStateChanged(auth, (user) => {
        if (user) {
          if (!this.hasFreshCookieToken()) {
            void this.refresh(user);
          }
        } else {
          this.clear();
        }
        if (!settled) {
          settled = true;
          resolve();
        }
      });
    });
  }

  /** Cached token. Never triggers a network call. */
  getToken(): string | null {
    return this.token();
  }

  /** Cached token when still fresh, otherwise a newly minted one. */
  async getValidToken(): Promise<string | null> {
    const cached = this.token();
    if (cached && this.hasFreshCookieToken()) {
      return cached;
    }
    return this.refresh();
  }

  async refresh(user?: User): Promise<string | null> {
    const currentUser = user ?? this.auth?.currentUser ?? null;
    if (!currentUser) {
      this.clear();
      return null;
    }

    try {
      const token = await currentUser.getIdToken(true);
      this.token.set(token);
      this.cookies.set(TOKEN_COOKIE, token, 1);
      this.cookies.set(TOKEN_EXPIRY_COOKIE, String(Date.now() + TOKEN_TTL_MS), 1);
      return token;
    } catch (error) {
      console.error('[auth] Could not refresh the Firebase ID token', error);
      return null;
    }
  }

  clear(): void {
    this.token.set(null);
    this.cookies.remove(TOKEN_COOKIE);
    this.cookies.remove(TOKEN_EXPIRY_COOKIE);
  }

  private loadFromCookies(): void {
    const token = this.cookies.get(TOKEN_COOKIE);
    if (!token) {
      return;
    }
    if (this.hasFreshCookieToken()) {
      this.token.set(token);
    } else {
      this.clear();
    }
  }

  private hasFreshCookieToken(): boolean {
    const token = this.cookies.get(TOKEN_COOKIE);
    const expiry = this.cookies.get(TOKEN_EXPIRY_COOKIE);
    if (!token || !expiry) {
      return false;
    }
    const expiresAt = Number.parseInt(expiry, 10);
    return Number.isFinite(expiresAt) && Date.now() < expiresAt;
  }
}
