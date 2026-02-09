import { AuthClient } from '@idem/shared-auth-client';
import { createAuthStore } from '@idem/shared-auth-client';
import { getAuth } from 'firebase/auth';

const authClient = new AuthClient({
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  getAuthToken: async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        return await user.getIdToken();
      }
      return null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }
});

export const authStore = createAuthStore(authClient);
export { authClient };
