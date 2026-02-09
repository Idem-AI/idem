import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../modules/auth/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

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
export const publicGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    // Attendre que Firebase Auth soit initialisé
    const user = await firstValueFrom(authService.user$.pipe(map((user) => user)));

    if (user) {
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
