import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CasdoorUser {
  id: string;
  owner: string;
  name: string;
  email: string;
  displayName: string;
  avatar?: string;
  type?: string;
  createdTime?: string;
  updatedTime?: string;
}

export interface CasdoorAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

@Injectable({
  providedIn: 'root',
})
export class CasdoorService {
  private http = inject(HttpClient);
  private apiUrl = environment.services.api.url;
  private casdoorEndpoint = environment.casdoor.endpoint;
  private clientId = environment.casdoor.clientId;
  private redirectUri = environment.casdoor.redirectUri;
  private organization = environment.casdoor.organization;
  private application = environment.casdoor.application;

  private currentUserSubject = new BehaviorSubject<CasdoorUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  /**
   * Obtenir l'URL de connexion Casdoor (interface web standard)
   */
  getLoginUrl(): string {
    const state = this.generateState();
    sessionStorage.setItem('casdoor_state', state);

    return (
      `${this.casdoorEndpoint}/login/oauth/authorize?` +
      `client_id=${this.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&scope=read` +
      `&state=${state}`
    );
  }

  /**
   * Obtenir l'URL de connexion Casdoor pour Google (alias)
   */
  getGoogleLoginUrl(): string {
    return this.getLoginUrl();
  }

  /**
   * Obtenir l'URL de connexion Casdoor pour GitHub (alias)
   */
  getGithubLoginUrl(): string {
    return this.getLoginUrl();
  }

  /**
   * Générer un state aléatoire pour la sécurité OAuth
   */
  private generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Échanger le code d'autorisation contre un token
   */
  exchangeCodeForToken(code: string, state: string): Observable<CasdoorAuthResponse> {
    const savedState = sessionStorage.getItem('casdoor_state');

    if (savedState !== state) {
      throw new Error('Invalid state parameter');
    }

    sessionStorage.removeItem('casdoor_state');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: environment.casdoor.clientSecret,
      code: code,
      redirect_uri: this.redirectUri,
    });

    return this.http
      .post<CasdoorAuthResponse>(
        `${this.casdoorEndpoint}/api/login/oauth/access_token`,
        params.toString(),
        {
          headers: new HttpHeaders({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        },
      )
      .pipe(
        tap((response) => {
          // Stocker les tokens
          this.storeTokens(response);
        }),
      );
  }

  /**
   * Obtenir le profil utilisateur depuis Casdoor
   */
  getUserProfile(): Observable<CasdoorUser> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    return this.http
      .get<any>(`${this.casdoorEndpoint}/api/get-account`, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
      })
      .pipe(
        map((response) => {
          const userData = response.data;
          return {
            id: userData.id,
            owner: userData.owner,
            name: userData.name,
            email: userData.email,
            displayName: userData.displayName,
            avatar: userData.avatar,
            type: userData.type,
            createdTime: userData.createdTime,
            updatedTime: userData.updatedTime,
          } as CasdoorUser;
        }),
        tap((user) => {
          this.currentUserSubject.next(user);
        }),
        catchError((error) => {
          console.error('Error fetching user profile:', error);
          this.currentUserSubject.next(null);
          throw error;
        }),
      );
  }

  /**
   * Rafraîchir le token d'accès
   */
  refreshToken(): Observable<CasdoorAuthResponse> {
    return this.http
      .post<CasdoorAuthResponse>(`${this.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((response) => {
          this.storeTokens(response);
        }),
      );
  }

  /**
   * Déconnexion
   */
  logout(): Observable<void> {
    this.clearTokens();
    this.currentUserSubject.next(null);
    return of(void 0);
  }

  /**
   * Vérifier si l'utilisateur est connecté
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    // Vérifier si le token n'est pas expiré
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convertir en millisecondes
      return Date.now() < exp;
    } catch {
      return false;
    }
  }

  /**
   * Obtenir le token d'accès
   */
  getAccessToken(): string | null {
    return localStorage.getItem('casdoor_access_token');
  }

  /**
   * Stocker les tokens
   */
  private storeTokens(response: CasdoorAuthResponse): void {
    localStorage.setItem('casdoor_access_token', response.access_token);
    localStorage.setItem('casdoor_refresh_token', response.refresh_token);
    localStorage.setItem(
      'casdoor_token_expires_at',
      (Date.now() + response.expires_in * 1000).toString(),
    );
  }

  /**
   * Effacer les tokens
   */
  private clearTokens(): void {
    localStorage.removeItem('casdoor_access_token');
    localStorage.removeItem('casdoor_refresh_token');
    localStorage.removeItem('casdoor_token_expires_at');
  }

  /**
   * Obtenir l'utilisateur actuel
   */
  getCurrentUser(): CasdoorUser | null {
    return this.currentUserSubject.value;
  }
}
