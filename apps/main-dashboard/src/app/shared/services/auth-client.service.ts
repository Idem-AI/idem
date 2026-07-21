import { Injectable, Injector, inject } from '@angular/core';
import { AuthClient } from '@idem/shared-auth-client';
import { Auth } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthClientService {
  private readonly injector = inject(Injector);
  private authClient: AuthClient;

  constructor() {
    this.authClient = new AuthClient({
      apiBaseUrl: environment.services.api.url,
      getAuthToken: async () => {
        const auth = this.injector.get(Auth);
        const user = auth.currentUser;
        if (user) {
          return await user.getIdToken();
        }
        return null;
      },
    });
  }

  getClient(): AuthClient {
    return this.authClient;
  }
}
