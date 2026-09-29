import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GoTrueClient, type Session } from '@supabase/auth-js';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Fournisseurs de connexion proposés sur l'écran de login. */
export type OAuthProvider = 'google' | 'linkedin_oidc';

/**
 * Client du serveur d'authentification Supabase auto-hébergé.
 *
 * On parle directement à GoTrue (pas de passerelle Kong) : l'URL configurée
 * est la racine du service, sans `/auth/v1`. Flux PKCE pour OAuth, confirmation
 * d'adresse et mot de passe oublié : le code revient dans l'URL et s'échange
 * ici contre une session.
 *
 * La session Supabase ne sert qu'à prouver l'identité auprès de l'API IDEM,
 * qui pose ensuite ses propres cookies `session` / `refreshToken`. Son jeton
 * d'accès sert aussi de Bearer, comme le faisait l'ancien fournisseur.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly session = new BehaviorSubject<Session | null>(null);
  private readonly readyPromise: Promise<void>;

  /** `null` côté serveur (SSR) : aucune session n'y existe. */
  readonly client: GoTrueClient | null;

  /** Session courante (ou `null`), mise à jour à chaque rafraîchissement. */
  readonly session$ = this.session.asObservable();

  constructor() {
    if (!this.isBrowser) {
      this.client = null;
      this.readyPromise = Promise.resolve();
      return;
    }

    this.client = new GoTrueClient({
      url: environment.auth.url,
      storageKey: 'idem-auth',
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // Le code est échangé explicitement par `AuthService`, qui décide s'il
      // s'agit d'une connexion ou d'une récupération de mot de passe.
      detectSessionInUrl: false,
    });

    this.client.onAuthStateChange((_event, session) => this.session.next(session));
    this.readyPromise = this.client
      .getSession()
      .then(({ data }) => this.session.next(data.session))
      .catch(() => this.session.next(null));
  }

  private providersPromise: Promise<OAuthProvider[]> | null = null;

  /**
   * Fournisseurs OAuth activés sur le serveur (`GET /settings`). Un bouton
   * vers un fournisseur désactivé enverrait l'utilisateur sur une page
   * d'erreur brute du serveur d'authentification.
   */
  enabledProviders(): Promise<OAuthProvider[]> {
    const all: OAuthProvider[] = ['google', 'linkedin_oidc'];
    if (!this.isBrowser) return Promise.resolve([]);
    this.providersPromise ??= fetch(`${environment.auth.url}/settings`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((settings: { external?: Record<string, boolean> }) =>
        all.filter((provider) => settings.external?.[provider] === true),
      )
      .catch(() => {
        // Serveur injoignable : on ne masque rien, l'erreur s'affichera au clic.
        this.providersPromise = null;
        return all;
      });
    return this.providersPromise;
  }

  /** Résolu une fois la session éventuelle relue depuis le stockage. */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  currentSession(): Session | null {
    return this.session.value;
  }

  /** Jeton d'accès valide, rafraîchi au besoin. */
  async accessToken(): Promise<string | null> {
    if (!this.client) return null;
    await this.readyPromise;
    const { data } = await this.client.getSession();
    return data.session?.access_token ?? null;
  }

  /** Force un nouveau jeton d'accès (après un 401). */
  async refreshAccessToken(): Promise<string | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.refreshSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  }
}
