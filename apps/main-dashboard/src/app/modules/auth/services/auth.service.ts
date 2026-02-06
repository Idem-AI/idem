import { HttpClient } from '@angular/common/http';
import { inject, Injectable, forwardRef } from '@angular/core';
import { Router } from '@angular/router';
import { TokenService } from '../../../shared/services/token.service';
import { CookieService } from '../../../shared/services/cookie.service';
import {
  Auth,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  user,
  User,
} from '@angular/fire/auth';
import { from, Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);
  user$: Observable<User | null>;
  private http = inject(HttpClient);
  private tokenService = inject(forwardRef(() => TokenService));
  private cookieService = inject(CookieService);
  private apiUrl = `${environment.services.api.url}/auth`;
  private readonly CURRENT_USER_COOKIE = 'currentUser';

  constructor() {
    this.user$ = user(this.auth);
    this.handleRedirectResult();
  }

  /**
   * Détecte si l'appareil est mobile
   */
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  }

  /**
   * Gère le résultat de la redirection OAuth
   */
  private async handleRedirectResult(): Promise<void> {
    try {
      const result = await getRedirectResult(this.auth);
      if (result?.user) {
        console.log('Utilisateur authentifié via redirect, traitement du login...');
        await this.postLogin(result.user);
        // Rediriger vers le dashboard après une authentification réussie
        console.log('Navigation vers /console après authentification mobile réussie');
        await this.router.navigate(['/console']);
      }
    } catch (error) {
      console.error('Erreur lors de la gestion du résultat de redirection:', error);
    }
  }

  login(email: string, password: string): Observable<void> {
    const promise = signInWithEmailAndPassword(this.auth, email, password).then(async (cred) => {
      await this.postLogin(cred.user);
    });
    return from(promise);
  }

  async loginWithGithub() {
    const provider = new GithubAuthProvider();

    if (this.isMobileDevice()) {
      // Sur mobile, utiliser redirect pour éviter les problèmes de sessionStorage
      await signInWithRedirect(this.auth, provider);
      // Le résultat sera géré par handleRedirectResult() au prochain chargement
    } else {
      // Sur desktop, utiliser popup
      const result = await signInWithPopup(this.auth, provider);
      await this.postLogin(result.user);
    }
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();

    if (this.isMobileDevice()) {
      // Sur mobile, utiliser redirect pour éviter les problèmes de sessionStorage
      await signInWithRedirect(this.auth, provider);
      // Le résultat sera géré par handleRedirectResult() au prochain chargement
    } else {
      // Sur desktop, utiliser popup
      const result = await signInWithPopup(this.auth, provider);
      await this.postLogin(result.user);
    }
  }

  private async postLogin(user: User) {
    if (!user) return;
    const currentUser = this.auth.currentUser;

    // Le TokenService va automatiquement sauvegarder le token dans les cookies
    const token = currentUser ? await this.tokenService.refreshToken(currentUser) : null;

    if (!token) {
      console.error('Aucun token disponible');
      return;
    }

    console.log('Token obtenu et sauvegardé automatiquement lors du login');

    // Sauvegarder l'utilisateur dans les cookies
    this.saveUserToCookies(user);

    try {
      await firstValueFrom(
        this.http.post<void>(
          `${this.apiUrl}/sessionLogin`,
          { token, user },
          {
            withCredentials: true,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    } catch (error) {
      console.error("Erreur lors de l'envoi du token au backend:", error);
    }

    try {
      console.log('Utilisateur ajouté à Firestore avec succès');
    } catch (error) {
      console.error('Erreur lors de l’ajout de l’utilisateur à Firestore :', error);
    }
  }

  logout(): Observable<void> {
    const promise = signOut(this.auth)
      .then(() => {
        // Effacer le token dans TokenService
        this.tokenService.clearToken();
        // Effacer l'utilisateur des cookies
        this.cookieService.remove(this.CURRENT_USER_COOKIE);
        sessionStorage.clear();
        return this.http.post<void>(`${this.apiUrl}/logout`, {}).toPromise();
      })
      .catch((error) => {
        console.error('Erreur lors de la déconnexion:', error);
      });

    return from(promise);
  }

  getCurrentUser(): User | null {
    // D'abord essayer de récupérer depuis Firebase Auth
    const firebaseUser = this.auth.currentUser;
    if (firebaseUser) {
      return firebaseUser;
    }

    // Si pas d'utilisateur Firebase, récupérer depuis les cookies
    return this.getUserFromCookies();
  }

  /**
   * Sauvegarde l'utilisateur dans les cookies
   */
  private saveUserToCookies(user: User): void {
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      providerId: user.providerId,
    };

    this.cookieService.set(this.CURRENT_USER_COOKIE, JSON.stringify(userData), 30);
  }

  /**
   * Récupère l'utilisateur depuis les cookies
   */
  private getUserFromCookies(): User | null {
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

      // Créer un objet User-like depuis les données des cookies
      return {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        emailVerified: userData.emailVerified,
        phoneNumber: userData.phoneNumber,
        providerId: userData.providerId,
        // Propriétés requises par l'interface User mais non stockées
        isAnonymous: false,
        metadata: {} as any,
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => '',
        getIdTokenResult: async () => ({}) as any,
        reload: async () => {},
        toJSON: () => ({}),
      } as User;
    } catch (error) {
      console.error("Erreur lors de la récupération de l'utilisateur depuis les cookies:", error);
      return null;
    }
  }
}
