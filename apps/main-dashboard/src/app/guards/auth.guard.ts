import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../modules/auth/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Guard pour protéger les routes qui nécessitent une authentification.
 * Redirige vers /login si l'utilisateur n'est pas authentifié.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    // Attendre que Firebase Auth soit initialisé
    const user = await firstValueFrom(authService.user$.pipe(map((user) => user)));

    if (user) {
      // Utilisateur authentifié, autoriser l'accès
      return true;
    }

    // Utilisateur non authentifié, rediriger vers login
    console.log('User not authenticated, redirecting to /login');
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  } catch (error) {
    console.error('Error in authGuard:', error);
    return router.createUrlTree(['/login']);
  }
};

/**
 * Guard pour les routes publiques (login, etc.).
 * Redirige vers /console si l'utilisateur est déjà authentifié.
 */
export const publicGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const http = inject(HttpClient);

  try {
    // Attendre que Firebase Auth soit initialisé
    const user = await firstValueFrom(authService.user$.pipe(map((user) => user)));

    if (user) {
      // Check if there's a redirect parameter (e.g., redirect=ideploy)
      const redirectParam = route.queryParamMap.get('redirect');

      if (redirectParam === 'ideploy') {
        // User is already authenticated and wants to go to iDeploy
        // Generate token and redirect directly
        console.log('User already authenticated, generating iDeploy token and redirecting...');

        try {
          const apiUrl = environment.services.api.url;
          const ideployUrl = environment.services.ideploy.url;

          // Call API to generate one-time token
          const response = await firstValueFrom(
            http.post<{ success: boolean; token: string }>(
              `${apiUrl}/auth/ideploy-token`,
              {},
              { withCredentials: true },
            ),
          );

          if (response.success && response.token) {
            console.log('iDeploy SSO token generated, redirecting...');
            // Redirect to iDeploy with token
            window.location.href = `${ideployUrl}/auth/idem?token=${response.token}`;
            // Return false to prevent further navigation
            return false;
          } else {
            console.error('Failed to generate iDeploy token, redirecting to console');
            return router.createUrlTree(['/console']);
          }
        } catch (error) {
          console.error('Error generating iDeploy SSO token:', error);
          return router.createUrlTree(['/console']);
        }
      }

      // Utilisateur déjà authentifié, rediriger vers le dashboard
      console.log('User already authenticated, redirecting to /console');
      return router.createUrlTree(['/console']);
    }

    // Utilisateur non authentifié, autoriser l'accès à la page publique
    return true;
  } catch (error) {
    console.error('Error in publicGuard:', error);
    return true;
  }
};
