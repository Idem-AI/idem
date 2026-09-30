import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseAuthService } from './supabase-auth.service';

/**
 * Jeton Bearer des requêtes d'API.
 *
 * C'est le jeton d'accès du serveur d'authentification (Supabase), rafraîchi
 * automatiquement. Il double le cookie `session` httpOnly posé par l'API : les
 * appels restent authentifiés même quand un service ne reçoit pas le cookie.
 * Utilisé par `AuthService` et par l'intercepteur, sans dépendance circulaire.
 */
@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private readonly supabase = inject(SupabaseAuthService);
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private readonly authReadySubject = new BehaviorSubject<boolean>(false);

  /** Jeton courant. */
  public readonly token$ = this.tokenSubject.asObservable();

  /** Passe à `true` une fois la session relue au démarrage. */
  public readonly authReady$ = this.authReadySubject.asObservable();

  constructor() {
    this.supabase.session$.subscribe((session) =>
      this.tokenSubject.next(session?.access_token ?? null),
    );
    void this.supabase.ready().then(() => this.authReadySubject.next(true));
  }

  /** Jeton en cache, synchrone. */
  public getToken(): string | null {
    return this.tokenSubject.value;
  }

  /** Jeton valide, rafraîchi au besoin. */
  public async getTokenAsync(): Promise<string | null> {
    const token = await this.supabase.accessToken();
    this.tokenSubject.next(token);
    return token;
  }

  /** Force un nouveau jeton (après un 401/403). */
  public async refreshToken(): Promise<string | null> {
    const token = await this.supabase.refreshAccessToken();
    this.tokenSubject.next(token);
    return token;
  }

  public clearToken(): void {
    this.tokenSubject.next(null);
  }

  /** Résolu quand la session a été relue au démarrage. */
  public waitForAuthReady(): Promise<void> {
    return this.supabase.ready();
  }
}
