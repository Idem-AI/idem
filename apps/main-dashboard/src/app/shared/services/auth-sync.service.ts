import { Injectable } from '@angular/core';
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
  private readonly STORAGE_KEY = 'idem_auth_sync';
  private readonly SYNC_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor(private router: Router) {}

  /**
   * Check if user is authenticated via sync from landing page
   * Note: With Casdoor migration, this service may no longer be needed
   */
  checkAuthSync(): void {
    // Check if there's a recent auth sync from landing page
    const syncData = this.getAuthSyncData();

    if (syncData && this.isValidSync(syncData)) {
      console.log('Auth sync detected from landing page');
      // With Casdoor, authentication is handled via OAuth redirect
      // This sync mechanism is deprecated
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
