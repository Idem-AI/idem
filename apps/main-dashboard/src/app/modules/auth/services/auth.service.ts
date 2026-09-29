import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthError, type Session } from '@supabase/auth-js';
import { Observable, ReplaySubject, firstValueFrom, from } from 'rxjs';
import { TokenService } from '../../../shared/services/token.service';
import { CookieService } from '../../../shared/services/cookie.service';
import {
  OAuthProvider,
  SupabaseAuthService,
} from '../../../shared/services/supabase-auth.service';
import { environment } from '../../../../environments/environment';
import { OnboardingSurveyService } from '../../../shared/services/onboarding-survey.service';

/**
 * Utilisateur IDEM connecté.
 *
 * `uid` est l'identifiant IDEM, pas celui du serveur d'authentification : les
 * comptes antérieurs à Supabase gardent leur identifiant d'origine, auquel
 * sont rattachés leurs projets.
 */
export interface IdemUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  /** Date de création du compte IDEM (ISO). */
  createdAt: string | null;
  /** Moyens de connexion utilisés : `email`, `google`, `apple`, `linkedin_oidc`. */
  providers: string[];
}

/** Erreur de connexion traduisible (clé i18n `auth.errors.<code>`). */
export class AuthFlowError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Résultat d'une inscription. */
export type SignUpOutcome = 'confirm-email' | 'already-registered' | 'signed-in';

/** Ce que l'URL de retour du serveur d'authentification a déclenché. */
export type CallbackOutcome =
  | { kind: 'none' }
  | { kind: 'signed-in' }
  | { kind: 'recovery' }
  | { kind: 'email-confirmed' }
  | { kind: 'error'; code: string };

interface SessionLoginResponse {
  success: boolean;
  user: IdemUser & Record<string, unknown>;
}

const LEGACY_TOKEN_COOKIES = ['authToken', 'authTokenExpiry'];

function toAuthFlowError(error: unknown): AuthFlowError {
  if (error instanceof AuthFlowError) return error;
  if (error instanceof AuthError) {
    const code = error.code ?? '';
    if (code === 'invalid_credentials') return new AuthFlowError('invalidCredentials');
    if (code === 'email_not_confirmed') return new AuthFlowError('emailNotConfirmed');
    if (code === 'weak_password') return new AuthFlowError('weakPassword');
    if (code === 'user_already_exists' || code === 'email_exists') {
      return new AuthFlowError('alreadyRegistered');
    }
    if (code.startsWith('over_') || error.status === 429) return new AuthFlowError('rateLimited');
    if (code === 'same_password') return new AuthFlowError('samePassword');
    if (code === 'signup_disabled') return new AuthFlowError('signupDisabled');
  }
  const status = (error as { status?: number })?.status;
  const apiCode = (error as { error?: { code?: string } })?.error?.code;
  if (apiCode === 'email_not_verified') return new AuthFlowError('emailNotConfirmed');
  if (apiCode === 'account_conflict') return new AuthFlowError('accountConflict');
  if (apiCode === 'email_required') return new AuthFlowError('emailRequired');
  if (status === 429) return new AuthFlowError('rateLimited');
  if (status === 0) return new AuthFlowError('network');
  return new AuthFlowError('generic');
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(SupabaseAuthService);
  private readonly tokenService = inject(TokenService);
  private readonly cookieService = inject(CookieService);
  private readonly onboardingSurvey = inject(OnboardingSurveyService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = `${environment.services.api.url}/auth`;
  private readonly CURRENT_USER_COOKIE = 'currentUser';
  private readonly SESSION_ACTIVE_COOKIE = 'idem_session_active';

  private readonly currentUser = signal<IdemUser | null>(null);
  private readonly userSubject = new ReplaySubject<IdemUser | null>(1);

  /** Utilisateur connecté ; n'émet qu'une fois l'état initial connu. */
  readonly user$: Observable<IdemUser | null> = this.userSubject.asObservable();

  /** Vrai pendant l'échange d'un code de retour (OAuth, lien e-mail). */
  readonly callbackInProgress = signal(false);

  /** Résultat du retour éventuel du serveur d'authentification sur cette page. */
  readonly callbackResult: Promise<CallbackOutcome>;

  constructor() {
    if (!this.isBrowser) {
      this.callbackResult = Promise.resolve({ kind: 'none' });
      this.userSubject.next(null);
      return;
    }

    LEGACY_TOKEN_COOKIES.forEach((name) => this.cookieService.remove(name));
    this.callbackResult = this.initialise();

    // Synchronisation de la déconnexion entre applications (sentinelle partagée).
    setInterval(() => this.checkGlobalLogout(), 3000);
  }

  // ── Démarrage ─────────────────────────────────────────────────────────────

  private async initialise(): Promise<CallbackOutcome> {
    let outcome: CallbackOutcome = { kind: 'none' };
    try {
      outcome = await this.handleCallbackUrl();
    } catch (error) {
      outcome = { kind: 'error', code: toAuthFlowError(error).code };
    }

    if (outcome.kind === 'recovery') {
      // La session de récupération ne sert qu'à changer le mot de passe :
      // elle n'ouvre la session IDEM qu'une fois le nouveau mot de passe choisi.
      this.publishUser(await this.fetchProfile());
    } else if (outcome.kind !== 'signed-in') {
      this.publishUser(await this.restoreUser());
    }
    return outcome;
  }

  /**
   * Retour du serveur d'authentification : `?code=` (PKCE) après OAuth, un lien
   * de confirmation ou de récupération ; `?error=` en cas de refus.
   */
  private async handleCallbackUrl(): Promise<CallbackOutcome> {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const code = url.searchParams.get('code');
    const flow = url.searchParams.get('auth_flow');
    const errorCode =
      url.searchParams.get('error_code') ?? hash.get('error_code') ?? url.searchParams.get('error');
    const errorDescription =
      url.searchParams.get('error_description') ?? hash.get('error_description') ?? '';

    if (!code && !errorCode) return { kind: 'none' };

    // Les paramètres du retour ne doivent survivre ni à un rechargement ni à
    // un partage de l'URL.
    ['code', 'auth_flow', 'error', 'error_code', 'error_description'].forEach((p) =>
      url.searchParams.delete(p),
    );
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);

    if (errorCode) {
      if (errorCode === 'otp_expired') return { kind: 'error', code: 'linkExpired' };
      // Compte sans adresse e-mail chez le fournisseur : le serveur refuse l'identité.
      if (/email/i.test(errorDescription)) return { kind: 'error', code: 'emailRequired' };
      return { kind: 'error', code: 'generic' };
    }

    this.callbackInProgress.set(true);
    try {
      const { data, error } = await this.supabase.client!.exchangeCodeForSession(code!);
      if (error || !data.session) {
        // Lien de confirmation ouvert dans un autre navigateur : l'adresse est
        // confirmée par le serveur, mais la session n'a pas pu s'ouvrir ici.
        if (flow === 'signup') return { kind: 'email-confirmed' };
        return { kind: 'error', code: 'linkExpired' };
      }
      if (flow === 'recovery') return { kind: 'recovery' };
      await this.openServerSession(data.session);
      return { kind: 'signed-in' };
    } finally {
      this.callbackInProgress.set(false);
    }
  }

  /** Session existante : cookie IDEM d'abord, session Supabase ensuite. */
  private async restoreUser(): Promise<IdemUser | null> {
    const profile = await this.fetchProfile();
    if (profile) return profile;

    await this.supabase.ready();
    const session = this.supabase.currentSession();
    if (!session) return null;
    try {
      return await this.openServerSession(session, false);
    } catch {
      return null;
    }
  }

  private async fetchProfile(): Promise<IdemUser | null> {
    try {
      const profile = await firstValueFrom(
        this.http.get<IdemUser>(`${this.apiUrl}/profile`, { withCredentials: true }),
      );
      return this.toIdemUser(profile);
    } catch {
      return null;
    }
  }

  // ── Connexion ─────────────────────────────────────────────────────────────

  login(email: string, password: string): Observable<IdemUser> {
    return from(
      (async () => {
        const { data, error } = await this.supabase.client!.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error || !data.session) throw toAuthFlowError(error);
        return this.openServerSession(data.session);
      })(),
    );
  }

  /** Redirige vers le fournisseur ; le retour est traité au chargement suivant. */
  async loginWithProvider(provider: OAuthProvider): Promise<void> {
    const { error } = await this.supabase.client!.signInWithOAuth({
      provider,
      options: {
        redirectTo: this.returnUrl(),
        ...(provider === 'apple' && { scopes: 'name email' }),
      },
    });
    if (error) throw toAuthFlowError(error);
  }

  async signUp(email: string, password: string, displayName: string): Promise<SignUpOutcome> {
    try {
      const { data, error } = await this.supabase.client!.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: this.returnUrl('signup'),
          data: displayName.trim() ? { full_name: displayName.trim() } : undefined,
        },
      });
      if (error) throw error;
      if (data.session) {
        await this.openServerSession(data.session);
        return 'signed-in';
      }
      // Adresse déjà inscrite : le serveur répond sans identité, pour ne pas
      // révéler l'existence du compte à un tiers.
      if (data.user && (data.user.identities?.length ?? 0) === 0) return 'already-registered';
      return 'confirm-email';
    } catch (error) {
      throw toAuthFlowError(error);
    }
  }

  /**
   * Lien de choix du mot de passe. Sert aussi aux comptes repris de l'ancien
   * système, qui n'ont pas encore de mot de passe.
   */
  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.supabase.client!.resetPasswordForEmail(email.trim(), {
      redirectTo: this.returnUrl('recovery'),
    });
    if (error) throw toAuthFlowError(error);
  }

  /** Nouveau mot de passe, après un lien de récupération. */
  async completePasswordRecovery(password: string): Promise<IdemUser> {
    const { error } = await this.supabase.client!.updateUser({ password });
    if (error) throw toAuthFlowError(error);
    const session = this.supabase.currentSession() ?? (await this.currentSupabaseSession());
    if (!session) throw new AuthFlowError('linkExpired');
    return this.openServerSession(session);
  }

  private async currentSupabaseSession(): Promise<Session | null> {
    const { data } = await this.supabase.client!.getSession();
    return data.session;
  }

  /**
   * URL de retour : la page de login avec ses paramètres (`redirect`,
   * `returnUrl`, `from`), pour que la redirection vers l'application appelante
   * survive à l'aller-retour chez le fournisseur.
   */
  private returnUrl(flow?: 'signup' | 'recovery'): string {
    const url = new URL('/login', window.location.origin);
    const current = new URLSearchParams(window.location.search);
    for (const key of ['redirect', 'returnUrl', 'from']) {
      const value = current.get(key);
      if (value) url.searchParams.set(key, value);
    }
    if (flow) url.searchParams.set('auth_flow', flow);
    return url.toString();
  }

  // ── Session serveur (cookies httpOnly partagés) ──────────────────────────

  /**
   * Échange le jeton Supabase contre les cookies `session` / `refreshToken`
   * de l'API IDEM, lus par toutes les applications du domaine.
   */
  private async openServerSession(session: Session, publish = true): Promise<IdemUser> {
    try {
      const response = await firstValueFrom(
        this.http.post<SessionLoginResponse>(
          `${this.apiUrl}/sessionLogin`,
          { token: session.access_token },
          { withCredentials: true, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      const user = this.toIdemUser(response.user);
      this.saveUserToCookies(user);
      this.cookieService.set(this.SESSION_ACTIVE_COOKIE, '1', 30);
      this.serverSessionSync = Promise.resolve(true);
      if (publish) this.publishUser(user);
      return user;
    } catch (error) {
      // Compte refusé par l'API (adresse non vérifiée, conflit) : la session
      // Supabase ne doit pas rester ouverte à moitié.
      await this.supabase.client?.signOut({ scope: 'local' });
      throw toAuthFlowError(error);
    }
  }

  private serverSessionSync: Promise<boolean> | null = null;

  /**
   * Garantit que le cookie `session` httpOnly partagé (`.idem.africa`) est
   * valide. C'est lui qu'AppGen, iDeploy et le simulateur lisent via
   * `/auth/profile`. Un seul contrôle en vol à la fois ; un échec autorise un
   * nouvel essai.
   */
  ensureServerSession(): Promise<boolean> {
    this.serverSessionSync ??= this.syncServerSession().then((ok) => {
      if (!ok) this.serverSessionSync = null;
      return ok;
    });
    return this.serverSessionSync;
  }

  private async syncServerSession(): Promise<boolean> {
    if (await this.fetchProfile()) return true;
    const session = this.supabase.currentSession() ?? (await this.currentSupabaseSession());
    if (!session) return false;
    try {
      await this.openServerSession(session);
      return true;
    } catch {
      return false;
    }
  }

  // ── Déconnexion ───────────────────────────────────────────────────────────

  private checkGlobalLogout(): void {
    const isActive = this.cookieService.get(this.SESSION_ACTIVE_COOKIE);
    if (this.currentUser() && isActive === '0') {
      this.logout().subscribe();
    }
  }

  logout(): Observable<void> {
    this.serverSessionSync = null;
    return from(
      (async () => {
        try {
          // withCredentials : sans lui, le navigateur n'envoie pas le cookie
          // `session` partagé et ignore le Set-Cookie qui l'efface — les
          // autres applications resteraient connectées.
          await firstValueFrom(
            this.http.post<void>(`${this.apiUrl}/logout`, {}, { withCredentials: true }),
          );
        } catch (error) {
          console.warn('Backend logout failed, local logout continues:', error);
        }
        try {
          await this.supabase.client?.signOut({ scope: 'local' });
        } catch {
          // Session déjà close côté serveur d'authentification.
        }
        this.tokenService.clearToken();
        this.cookieService.remove(this.CURRENT_USER_COOKIE);
        this.cookieService.set(this.SESSION_ACTIVE_COOKIE, '0', 30);
        // Le profil d'accueil est propre au compte : il ne doit pas survivre
        // à une déconnexion et fausser le sondage du compte suivant.
        this.onboardingSurvey.reset();
        sessionStorage.clear();
        this.publishUser(null);
      })(),
    );
  }

  // ── Utilisateur courant ───────────────────────────────────────────────────

  getCurrentUser(): IdemUser | null {
    return this.currentUser() ?? this.getUserFromCookies();
  }

  private publishUser(user: IdemUser | null): void {
    this.currentUser.set(user);
    this.userSubject.next(user);
  }

  private toIdemUser(
    profile: Partial<IdemUser> & { uid: string; authProviders?: string[] },
  ): IdemUser {
    return {
      uid: profile.uid,
      email: profile.email ?? null,
      displayName: profile.displayName || null,
      photoURL: profile.photoURL || null,
      emailVerified: profile.emailVerified === true,
      createdAt: profile.createdAt ? String(profile.createdAt) : null,
      providers: profile.providers ?? profile.authProviders ?? [],
    };
  }

  private saveUserToCookies(user: IdemUser): void {
    this.cookieService.set(this.CURRENT_USER_COOKIE, JSON.stringify(user), 30);
  }

  private getUserFromCookies(): IdemUser | null {
    try {
      const raw = this.cookieService.get(this.CURRENT_USER_COOKIE)?.trim();
      if (!raw) return null;
      if (!raw.startsWith('{') || !raw.endsWith('}')) {
        this.cookieService.remove(this.CURRENT_USER_COOKIE);
        return null;
      }
      const data = JSON.parse(raw);
      return typeof data?.uid === 'string' ? this.toIdemUser(data) : null;
    } catch {
      return null;
    }
  }
}
