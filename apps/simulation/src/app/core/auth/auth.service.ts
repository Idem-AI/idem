import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '@env';

import { AuthStatus, SessionUser } from './session-user.model';

/**
 * Identifie cette application auprès du login central : le dashboard lit ce
 * paramètre pour savoir vers quelle application renvoyer l'utilisateur.
 */
const APP_ID = 'simulation';

/** Anti-boucle : on ne rebondit qu'une fois par onglet vers le login central. */
const LOGIN_ATTEMPT_KEY = 'idem_simulation_login_attempt';

/**
 * L'identité IDEM, telle que la partagent toutes les applications de
 * l'écosystème.
 *
 * Aucune application n'a de login séparé : le dashboard IDEM est le seul écran
 * de connexion, l'API IDEM pose un cookie de session `httpOnly` sur le domaine
 * partagé, et chaque front se contente de le faire vérifier via
 * `GET /auth/profile`. Ce service ne gère donc aucun jeton côté client — il lit
 * une identité déjà émise, et renvoie au login central quand il n'y en a pas.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authApi = `${environment.services.api.url}/auth`;

  private readonly currentUser = signal<SessionUser | null>(null);
  private readonly authStatus = signal<AuthStatus>('initialising');

  readonly user = this.currentUser.asReadonly();
  readonly status = this.authStatus.asReadonly();
  readonly isAuthenticated = computed(() => this.authStatus() === 'authenticated');

  /** Requête de profil en vol : les gardes concurrentes la partagent. */
  private pending: Promise<SessionUser | null> | null = null;
  private loaded = false;

  /** Lit le profil une seule fois ; les appels suivants rendent le cache. */
  async ensureLoaded(): Promise<SessionUser | null> {
    if (this.loaded) {
      return this.currentUser();
    }
    return this.fetchProfile();
  }

  /** Force une relecture de la session auprès de l'API IDEM. */
  async fetchProfile(): Promise<SessionUser | null> {
    this.pending ??= this.requestProfile();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${this.authApi}/logout`, {}, { withCredentials: true }),
      );
    } catch (error) {
      console.warn('[auth] Déconnexion serveur impossible ; la session locale est vidée', error);
    }

    this.currentUser.set(null);
    this.authStatus.set('anonymous');
    this.loaded = false;
    clearLoginAttempt();

    // La déconnexion vaut pour tout IDEM : on repart du login central.
    window.location.href = `${environment.services.dashboard.url}/login`;
  }

  /**
   * Envoie l'utilisateur au login du dashboard IDEM, le seul de l'écosystème.
   *
   * `redirect=simulation` dit au dashboard vers quelle application revenir, et
   * `returnUrl` l'écran exact à rouvrir une fois la session ouverte — c'est le
   * pendant du `redirect=ideploy` d'iDeploy.
   *
   * Anti-boucle : si on a déjà rebondi une fois dans cet onglet sans obtenir de
   * session (cookie non partagé entre domaines, par exemple), on s'arrête sur
   * la landing publique plutôt que de faire l'aller-retour indéfiniment. Un
   * clic explicite de l'utilisateur (`force`) n'est jamais une boucle.
   */
  redirectToLogin(returnUrl?: string, options: { force?: boolean } = {}): void {
    if (!options.force && hasAttemptedLogin()) {
      clearLoginAttempt();
      window.location.href = environment.services.landing.url;
      return;
    }
    markLoginAttempt();

    const params = new URLSearchParams({
      redirect: APP_ID,
      from: APP_ID,
      returnUrl: ssoCallbackUrl(returnUrl),
    });
    window.location.href = `${environment.services.dashboard.url}/login?${params.toString()}`;
  }

  private async requestProfile(): Promise<SessionUser | null> {
    try {
      const profile = await firstValueFrom(
        this.http.get<SessionUser>(`${this.authApi}/profile`, { withCredentials: true }),
      );
      this.currentUser.set(profile ?? null);
      this.authStatus.set(profile ? 'authenticated' : 'anonymous');
      // Session valide : l'anti-boucle est réarmé pour la prochaine expiration.
      clearLoginAttempt();
      return this.currentUser();
    } catch (error) {
      // 401 attendu tant que l'utilisateur n'est pas connecté : ce n'est pas
      // une erreur, seulement l'absence de session.
      this.currentUser.set(null);
      this.authStatus.set('anonymous');
      logProfileFailure(error);
      return null;
    } finally {
      this.loaded = true;
    }
  }
}

/**
 * Le login central nous ramène par `/auth/idem`, jamais directement sur la page
 * demandée : le cookie de session met parfois un instant à devenir lisible
 * après la chaîne de redirections, et c'est ce callback qui absorbe l'attente
 * au lieu de laisser la garde conclure à une absence de session.
 */
function ssoCallbackUrl(returnUrl?: string): string {
  const callback = new URL('/auth/idem', window.location.origin);
  callback.searchParams.set('returnUrl', internalPath(returnUrl));
  return callback.toString();
}

/** Ne garde d'une cible que sa partie interne, chemin + requête + ancre. */
function internalPath(returnUrl?: string): string {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!returnUrl) {
    return current;
  }
  try {
    const url = new URL(returnUrl, window.location.origin);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : current;
  } catch {
    return current;
  }
}

function hasAttemptedLogin(): boolean {
  try {
    return sessionStorage.getItem(LOGIN_ATTEMPT_KEY) === '1';
  } catch {
    // Navigation privée : sans mémoire, on laisse passer la tentative.
    return false;
  }
}

function markLoginAttempt(): void {
  try {
    sessionStorage.setItem(LOGIN_ATTEMPT_KEY, '1');
  } catch {
    // Rien à mémoriser : l'anti-boucle sera simplement inopérant.
  }
}

function clearLoginAttempt(): void {
  try {
    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
  } catch {
    // Rien à nettoyer.
  }
}

function logProfileFailure(error: unknown): void {
  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) {
    return;
  }
  console.warn('[auth] Lecture du profil IDEM impossible', error);
}
