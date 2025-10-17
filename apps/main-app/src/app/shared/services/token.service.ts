import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { filter, take } from 'rxjs/operators';
import { CookieService } from './cookie.service';

/**
 * Service responsible for managing authentication tokens.
 * This service is used by both AuthService and AuthInterceptor to avoid circular dependencies.
 */
@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private auth = inject(Auth);
  private cookieService = inject(CookieService);
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private authReadySubject = new BehaviorSubject<boolean>(false);
  
  private readonly TOKEN_COOKIE = 'authToken';
  private readonly TOKEN_EXPIRY_COOKIE = 'authTokenExpiry';

  // Observable that emits the current token
  public token$ = this.tokenSubject.asObservable();
  
  // Observable that emits when auth is ready (true when initialized)
  public authReady$ = this.authReadySubject.asObservable();

  constructor() {
    // Initialize token from cookies first
    this.loadTokenFromCookies();
    
    // Listen for auth state changes and update token accordingly
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        console.log('Auth state changed: User authenticated');
        // Only refresh if we don't have a valid cached token
        if (!this.hasValidCachedToken()) {
          console.log('No valid cached token, refreshing from Firebase');
          this.refreshToken(user);
        } else {
          console.log('Using valid cached token');
        }
      } else {
        console.log(
          'Auth state changed: User not authenticated, clearing token'
        );
        this.clearToken();
      }
      
      // Mark auth as ready after first state change
      if (!this.authReadySubject.value) {
        console.log('Auth initialization complete');
        this.authReadySubject.next(true);
      }
    });

    // Initialize token immediately if user is already authenticated
    this.initializeToken();
  }

  /**
   * Initialize token on service startup
   */
  private async initializeToken(): Promise<void> {
    try {
      if (this.auth.currentUser) {
        console.log('Initializing token for existing user');
        // Check if we have a valid cached token first
        if (!this.hasValidCachedToken()) {
          console.log('No valid cached token, refreshing from Firebase');
          await this.refreshToken(this.auth.currentUser);
        } else {
          console.log('Using valid cached token for initialization');
        }
      } else {
        console.log('No user found during token initialization');
      }
    } catch (error) {
      console.error('Error during token initialization:', error);
    }
  }

  /**
   * Manually refresh token for current user
   */
  public async refreshToken(user?: User): Promise<string | null> {
    try {
      const currentUser = user || this.auth.currentUser;
      if (!currentUser) {
        this.clearToken();
        console.log('User not found');
        return null;
      }
      console.log('Refreshing token from Firebase');

      const token = await currentUser.getIdToken(true);
      this.setToken(token);
      this.saveTokenToCookies(token);
      return token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  /**
   * Get the current token value synchronously
   * Returns the cached token from BehaviorSubject for immediate access
   */
  public getToken(): string | null {
    return this.tokenSubject.value;
  }

  /**
   * Get the current token value asynchronously
   * Returns cached token if valid, otherwise refreshes from Firebase
   */
  public async getTokenAsync(): Promise<string | null> {
    try {
      // First check if we have a valid cached token
      const cachedToken = this.getToken();
      if (cachedToken && this.hasValidCachedToken()) {
        console.log('TokenService: Using valid cached token');
        return cachedToken;
      }
      
      if (!this.auth.currentUser) {
        console.log('TokenService: No current user available');
        return null;
      }
      
      // Only refresh from Firebase if cached token is invalid/expired
      console.log('TokenService: Cached token invalid, refreshing from Firebase');
      const token = await this.auth.currentUser.getIdToken(true);
      if (token) {
        this.setToken(token);
        this.saveTokenToCookies(token);
        console.log('TokenService: Fresh token obtained and cached, length:', token.length);
      }
      return token || null;
    } catch (error) {
      console.error('Error getting token async:', error);
      return null;
    }
  }

  /**
   * Set a new token
   */
  private setToken(token: string): void {
    this.tokenSubject.next(token);
  }

  /**
   * Clear the token when user logs out
   */
  public clearToken(): void {
    this.tokenSubject.next(null);
    this.cookieService.remove(this.TOKEN_COOKIE);
    this.cookieService.remove(this.TOKEN_EXPIRY_COOKIE);
  }

  /**
   * Wait for auth to be ready
   * Returns a Promise that resolves when Firebase Auth has initialized
   */
  public waitForAuthReady(): Promise<void> {
    return this.authReady$.pipe(
      filter(ready => ready === true),
      take(1)
    ).toPromise().then(() => void 0);
  }

  /**
   * Load token from cookies on service initialization
   */
  private loadTokenFromCookies(): void {
    try {
      const token = this.cookieService.get(this.TOKEN_COOKIE);
      if (token && this.hasValidCachedToken()) {
        console.log('TokenService: Loaded valid token from cookies');
        this.setToken(token);
      } else if (token) {
        console.log('TokenService: Token in cookies is expired, clearing');
        this.clearToken();
      }
    } catch (error) {
      console.error('Error loading token from cookies:', error);
    }
  }

  /**
   * Save token to cookies with expiration
   */
  private saveTokenToCookies(token: string): void {
    try {
      // JWT tokens are typically valid for 1 hour
      const expirationTime = Date.now() + (55 * 60 * 1000); // 55 minutes to be safe
      
      this.cookieService.set(this.TOKEN_COOKIE, token, 1); // 1 day cookie expiry
      this.cookieService.set(this.TOKEN_EXPIRY_COOKIE, expirationTime.toString(), 1);
      
      console.log('TokenService: Token saved to cookies with expiration');
    } catch (error) {
      console.error('Error saving token to cookies:', error);
    }
  }

  /**
   * Check if the cached token is still valid (not expired)
   */
  private hasValidCachedToken(): boolean {
    try {
      const token = this.cookieService.get(this.TOKEN_COOKIE);
      const expiryStr = this.cookieService.get(this.TOKEN_EXPIRY_COOKIE);
      
      if (!token || !expiryStr) {
        return false;
      }
      
      const expiry = parseInt(expiryStr, 10);
      const now = Date.now();
      
      return now < expiry;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }
}
