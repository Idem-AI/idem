import { Injectable, inject } from '@angular/core';
import { Auth, User } from '@angular/fire/auth';
import { Router } from '@angular/router';

interface AuthSyncData {
  timestamp: number;
  userId: string;
  email: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthSyncService {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly STORAGE_KEY = 'idem_auth_sync';
  private readonly SYNC_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if user is authenticated via sync from landing page
   */
  checkAuthSync(): void {
    const currentUser = this.auth.currentUser;

    // If already authenticated in dashboard, no need to check sync
    if (currentUser) {
      return;
    }

    // Check if there's a recent auth sync from landing page
    const syncData = this.getAuthSyncData();

    if (syncData && this.isValidSync(syncData)) {
      // User was recently authenticated in landing page
      // Firebase auth should already be synced via shared auth domain
      console.log('Auth sync detected from landing page');

      // Wait a bit for Firebase to sync, then check again
      setTimeout(() => {
        if (!this.auth.currentUser) {
          console.warn('Auth sync found but Firebase user not available');
          // Optionally redirect to login
          // this.router.navigate(['/login']);
        }
      }, 1000);
    }
  }

  /**
   * Get auth sync data from localStorage
   */
  private getAuthSyncData(): AuthSyncData | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('Error parsing auth sync data:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Check if sync data is still valid (not expired)
   */
  private isValidSync(syncData: AuthSyncData): boolean {
    const now = Date.now();
    const age = now - syncData.timestamp;
    return age < this.SYNC_TIMEOUT;
  }

  /**
   * Clear auth sync data
   */
  clearAuthSync(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}
