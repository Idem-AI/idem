import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Identity returned by the global Idem API /auth/profile. */
export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * Authentication via the global Idem API + session cookie — same pattern as
 * apps/landing. The frontend calls {globalApi}/auth/profile (withCredentials);
 * login/logout are owned by the central app. iDeploy itself never manages
 * tokens or a separate auth system.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly globalApi = environment.services.api.url;

  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  readonly user$: Observable<AuthUser | null> = this.currentUserSubject.asObservable();

  private loaded = false;

  /** Fetch the current user once; subsequent calls return the cached value. */
  async ensureLoaded(): Promise<AuthUser | null> {
    if (this.loaded) return this.currentUserSubject.value;
    await this.fetchCurrentUser();
    this.loaded = true;
    return this.currentUserSubject.value;
  }

  async fetchCurrentUser(): Promise<AuthUser | null> {
    try {
      const user = await firstValueFrom(
        this.http.get<AuthUser>(`${this.globalApi}/auth/profile`, { withCredentials: true })
      );
      this.currentUserSubject.next(user);
      return user;
    } catch {
      this.currentUserSubject.next(null);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.globalApi}/auth/logout`, {}, { withCredentials: true })
      );
    } finally {
      this.currentUserSubject.next(null);
      this.loaded = false;
      // Login lives on the central console.
      window.location.href = `${environment.services.console.url}/login`;
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Redirect to the central app login. We pass `redirect=ideploy`, the exact
   * flag the central login honors: after authenticating it generates an iDeploy
   * SSO token and redirects to {ideploy}/auth/idem?token=... .
   */
  redirectToLogin(): void {
    window.location.href = `${environment.services.console.url}/login?redirect=ideploy`;
  }
}
