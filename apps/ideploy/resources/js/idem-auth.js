/**
 * IDEM Authentication Service - Client-Side
 *
 * Gère l'authentification côté navigateur en contactant directement l'API backend
 * avec les cookies de session (withCredentials: true)
 */

class IdemAuthService {
  constructor() {
    this.apiUrl = window.IDEM_API_URL || 'http://localhost:3001';
    this.user = null;
    this.isLoading = false;
    this.error = null;
  }

  /**
   * Vérifie l'authentification en appelant /auth/profile
   * @returns {Promise<Object>} User profile ou null
   */
  async checkAuth() {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`${this.apiUrl}/auth/profile`, {
        method: 'GET',
        credentials: 'include', // Équivalent de withCredentials: true
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.user = null;
          this.error = 'Non authentifié';
          return null;
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      // L'API retourne { user: UserModel }
      this.user = data.user || data;
      this.error = null;

      console.log('[IDEM Auth] Utilisateur authentifié:', this.user.email);
      return this.user;
    } catch (error) {
      console.error('[IDEM Auth] Erreur lors de la vérification:', error);
      this.error = error.message;
      this.user = null;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Synchronise l'utilisateur avec le backend Laravel
   * @param {Object} user - UserModel depuis l'API
   * @returns {Promise<Object>} Réponse du backend
   */
  async syncWithBackend(user) {
    try {
      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
        },
        body: JSON.stringify({ user }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur de synchronisation');
      }

      const data = await response.json();
      console.log('[IDEM Auth] Utilisateur synchronisé avec Laravel');
      return data;
    } catch (error) {
      console.error('[IDEM Auth] Erreur de synchronisation:', error);
      throw error;
    }
  }

  /**
   * Déconnexion
   */
  async logout() {
    try {
      await fetch(`${this.apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      this.user = null;
      console.log('[IDEM Auth] Déconnexion réussie');

      // Rediriger vers le dashboard pour se reconnecter
      window.location.href = window.IDEM_DASHBOARD_URL || 'http://localhost:4200';
    } catch (error) {
      console.error('[IDEM Auth] Erreur lors de la déconnexion:', error);
    }
  }

  /**
   * Obtenir l'utilisateur actuel
   */
  getUser() {
    return this.user;
  }

  /**
   * Vérifier si l'utilisateur est authentifié
   */
  isAuthenticated() {
    return this.user !== null;
  }

  /**
   * Obtenir l'erreur actuelle
   */
  getError() {
    return this.error;
  }

  /**
   * Vérifier si le chargement est en cours
   */
  isLoadingAuth() {
    return this.isLoading;
  }
}

// Instance globale
window.idemAuth = new IdemAuthService();
