import type { User } from '@/stores/userSlice';
// Configuration de l'API - utiliser la variable d'environnement correcte
const API_BASE_URL =
  import.meta.env.VITE_IDEM_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3001';

export const authService = {
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        language: localStorage.getItem('language'),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  },
  async getUserInfo(token: string): Promise<User> {
    try {
      console.log(
        '🔍 Récupération des infos utilisateur avec token:',
        token ? 'EXISTS' : 'MISSING'
      );
      const res = await fetch(`${API_BASE_URL}/api/user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.warn('❌ Erreur API getUserInfo:', res.status, res.statusText);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const response = await res.json();
      console.log(
        '✅ Infos utilisateur récupérées:',
        response.username || response.email || 'Utilisateur'
      );
      return response;
    } catch (error) {
      console.error(' Erreur getUserInfo:', error);
      throw error; // Propager l'erreur au lieu de retourner undefined
    }
  },

  async register(username: string, email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email,
        password,
        language: localStorage.getItem('language'),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  },

  async updatePassword(email: string, oldPassword: string, newPassword: string) {
    const res = await fetch(`${API_BASE_URL}/api/auth/update-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        oldPassword,
        newPassword,
        language: localStorage.getItem('language'),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  },
};
