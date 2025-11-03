import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { UserModel } from '@idem/shared-models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private initialized = false;

  // BehaviorSubject pour gérer l'état de l'utilisateur
  private readonly currentUserSubject = new BehaviorSubject<UserModel | null>(null);
  public readonly user$: Observable<UserModel | null>;

  constructor() {
    // Assigner user$ une seule fois
    if (!isPlatformBrowser(this.platformId)) {
      this.user$ = of(null);
    } else {
      this.user$ = this.currentUserSubject.asObservable();
    }
  }

  /**
   * Initialiser le service et récupérer l'utilisateur courant
   */
  async initialize(): Promise<void> {
    if (this.initialized || !isPlatformBrowser(this.platformId)) return;
    this.initialized = true;
    await this.fetchCurrentUser();
  }

  /**
   * Récupérer l'utilisateur courant depuis l'API
   */
  async fetchCurrentUser(): Promise<void> {
    try {
      const user = await firstValueFrom(
        this.http.get<UserModel>(`${environment.services.api.url}/auth/profile`, {
          withCredentials: true,
        }),
      );
      console.log('CurrentUser', user);
      this.currentUserSubject.next(user);
    } catch (error: any) {
      if (error.status === 401 || error.status === 403) {
        // Utilisateur non authentifié
        this.currentUserSubject.next(null);
      } else {
        console.error('Error fetching current user:', error);
        this.currentUserSubject.next(null);
      }
    }
  }

  /**
   * Déconnecter l'utilisateur
   */
  async logout(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.services.api.url}/auth/logout`,
          {},
          {
            withCredentials: true,
          },
        ),
      );
      this.currentUserSubject.next(null);
      localStorage.removeItem('idem_auth_sync');
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'utilisateur courant (valeur synchrone)
   */
  getCurrentUser(): UserModel | null {
    return this.currentUserSubject.value;
  }

  /**
   * Vérifier si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }
}
