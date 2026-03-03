import { HttpClient } from '@angular/common/http';
import { inject, Injectable, forwardRef, signal } from '@angular/core';
import { CookieService } from '../../../shared/services/cookie.service';
import { CasdoorService, CasdoorUser } from '../../../shared/services/casdoor.service';
import { from, Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private casdoorService = inject(CasdoorService);
  private http = inject(HttpClient);
  private cookieService = inject(CookieService);
  private apiUrl = `${environment.services.api.url}/auth`;
  private readonly CURRENT_USER_COOKIE = 'currentUser';

  private currentUserSubject = new BehaviorSubject<CasdoorUser | null>(null);
  user$ = this.currentUserSubject.asObservable();

  /** True while we're waiting for a redirect login result (mobile flow) */
  readonly redirectLoginInProgress = signal(false);

  /** Resolves when redirect result has been checked on app init */
  readonly redirectResultReady: Promise<CasdoorUser | null>;

  constructor() {
    this.redirectResultReady = this.checkAuthStatus();
  }

  /**
   * Check authentication status on app init
   */
  private async checkAuthStatus(): Promise<CasdoorUser | null> {
    try {
      if (this.casdoorService.isAuthenticated()) {
        const user = await this.casdoorService.getUserProfile().toPromise();
        this.currentUserSubject.next(user || null);
        return user || null;
      }
      return null;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return null;
    }
  }

  login(email: string, password: string): Observable<void> {
    // Email/password login not supported with Casdoor OAuth
    // Users must use Google or GitHub login
    throw new Error('Email/password login not supported. Please use Google or GitHub.');
  }

  loginWithGithub(): void {
    const url = this.casdoorService.getGithubLoginUrl();
    window.location.href = url;
  }

  loginWithGoogle(): void {
    const url = this.casdoorService.getGoogleLoginUrl();
    window.location.href = url;
  }

  async postLogin(user: CasdoorUser): Promise<void> {
    if (!user) return;

    console.log('User logged in successfully:', user.email);

    // Sauvegarder l'utilisateur dans les cookies
    this.saveUserToCookies(user);
    this.currentUserSubject.next(user);
  }

  logout(): Observable<void> {
    return this.casdoorService.logout().pipe(
      tap(() => {
        this.cookieService.remove(this.CURRENT_USER_COOKIE);
        sessionStorage.clear();
        this.currentUserSubject.next(null);
      }),
    );
  }

  getCurrentUser(): CasdoorUser | null {
    // Récupérer depuis Casdoor service
    const casdoorUser = this.casdoorService.getCurrentUser();
    if (casdoorUser) {
      return casdoorUser;
    }

    // Sinon récupérer depuis les cookies
    return this.getUserFromCookies();
  }

  /**
   * Sauvegarde l'utilisateur dans les cookies
   */
  private saveUserToCookies(user: CasdoorUser): void {
    const userData = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      name: user.name,
    };

    this.cookieService.set(this.CURRENT_USER_COOKIE, JSON.stringify(userData), 30);
  }

  /**
   * Récupère l'utilisateur depuis les cookies
   */
  private getUserFromCookies(): CasdoorUser | null {
    try {
      const userCookie = this.cookieService.get(this.CURRENT_USER_COOKIE);
      if (!userCookie) {
        return null;
      }

      // Validate JSON string before parsing
      const trimmedCookie = userCookie.trim();
      if (!trimmedCookie.startsWith('{') || !trimmedCookie.endsWith('}')) {
        console.warn('Invalid JSON format in user cookie, clearing cookie');
        this.cookieService.remove(this.CURRENT_USER_COOKIE);
        return null;
      }

      const userData = JSON.parse(trimmedCookie);

      return {
        id: userData.id,
        owner: userData.owner || '',
        name: userData.name,
        email: userData.email,
        displayName: userData.displayName,
        avatar: userData.avatar,
      } as CasdoorUser;
    } catch (error) {
      console.error("Erreur lors de la récupération de l'utilisateur depuis les cookies:", error);
      return null;
    }
  }
}
