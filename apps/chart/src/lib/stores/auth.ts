import { AuthClient, createAuthStore } from '@idem/shared-auth-client';

// L'identité voyage par le cookie `session` httpOnly posé par l'API IDEM sur
// le domaine partagé : aucun jeton à fournir.
const authClient = new AuthClient({
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001'
});

export const authStore = createAuthStore(authClient);
export { authClient };
