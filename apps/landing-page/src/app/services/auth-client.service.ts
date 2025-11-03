import { Injectable } from '@angular/core';
import { AuthClient } from '@idem/shared-auth-client';
import { getAuth } from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthClientService {
  private authClient: AuthClient;

  constructor() {
    this.authClient = new AuthClient({
      apiBaseUrl: 'http://localhost:3001',
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
      },
    });
  }

  getClient(): AuthClient {
    return this.authClient;
  }
}
