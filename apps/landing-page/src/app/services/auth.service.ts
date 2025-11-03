import { Injectable, inject } from '@angular/core';
import { Auth, User, user, signOut } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);

  // Observable of the current user
  public readonly user$: Observable<User | null> = user(this.auth);

  /**
   * Log out the current user
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      // Clear auth sync data
      localStorage.removeItem('idem_auth_sync');
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  /**
   * Get the current user
   */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }
}
