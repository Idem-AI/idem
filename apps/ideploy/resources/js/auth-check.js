/**
 * Auth Check - Vérification d'authentification côté client
 * Utilisé sur toutes les pages protégées pour vérifier la session
 */

(function () {
  'use strict';

  const AuthCheck = {
    /**
     * Vérifier si l'utilisateur est authentifié
     */
    async checkAuthentication() {
      console.log("[Auth Check] Vérification de l'authentification...");

      try {
        const response = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        console.log('[Auth Check] Statut de la réponse:', response.status);

        if (response.status === 200) {
          const data = await response.json();
          console.log('[Auth Check] ✅ Utilisateur authentifié:', data.user);
          return true;
        } else {
          console.log('[Auth Check] ❌ Non authentifié, redirection vers welcome');
          window.location.href = '/';
          return false;
        }
      } catch (error) {
        console.error('[Auth Check] ❌ Erreur lors de la vérification:', error);
        window.location.href = '/';
        return false;
      }
    },

    /**
     * Initialiser la vérification au chargement de la page
     */
    init() {
      // Vérifier uniquement si on n'est pas déjà sur la page welcome
      if (window.location.pathname !== '/' && window.location.pathname !== '') {
        console.log(
          '[Auth Check] Initialisation de la vérification pour:',
          window.location.pathname
        );
        this.checkAuthentication();
      }
    },
  };

  // Initialiser au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuthCheck.init());
  } else {
    AuthCheck.init();
  }

  // Exposer globalement pour utilisation manuelle si nécessaire
  window.AuthCheck = AuthCheck;
})();
