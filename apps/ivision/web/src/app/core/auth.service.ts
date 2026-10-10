import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IdemUser {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * L'identité est celle d'IDEM : le cookie httpOnly `session` posé par l'API IDEM, lu par
 * `GET /auth/profile` (qui le renouvelle au passage). iVision n'a pas d'écran de connexion :
 * il renvoie au tableau de bord (`/login?redirect=ivision`), qui ramène ici une fois connecté.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly user = signal<IdemUser | null>(null);
  private loaded: Promise<IdemUser | null> | null = null;
  /** Garde-fou contre une boucle de redirections (cookie non partagé). */
  private readonly attemptKey = 'ivision_auth_attempt';

  ensureLoaded(): Promise<IdemUser | null> {
    this.loaded ??= this.fetch();
    return this.loaded;
  }

  private async fetch(): Promise<IdemUser | null> {
    try {
      const body = await firstValueFrom(this.http.get<IdemUser & { user?: IdemUser }>(`${environment.services.api.url}/auth/profile`, { withCredentials: true }));
      const user = body?.user ?? body;
      this.user.set(user?.uid ? user : null);
      try {
        sessionStorage.removeItem(this.attemptKey);
      } catch {
        /* stockage indisponible : sans conséquence */
      }
      return this.user();
    } catch {
      this.user.set(null);
      return null;
    }
  }

  redirectToLogin(returnUrl = window.location.href): void {
    let attempted = false;
    try {
      attempted = sessionStorage.getItem(this.attemptKey) === '1';
      sessionStorage.setItem(this.attemptKey, attempted ? '0' : '1');
    } catch {
      /* stockage indisponible : on tente la redirection */
    }
    // Déjà renvoyé une fois sans succès : la page d'accueil publique plutôt qu'une boucle.
    if (attempted) {
      window.location.href = '/';
      return;
    }
    window.location.href = `${environment.services.dashboard.url}/login?redirect=ivision&returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.services.api.url}/auth/logout`, {}, { withCredentials: true }));
    } finally {
      this.user.set(null);
      this.loaded = null;
      window.location.href = '/';
    }
  }
}
