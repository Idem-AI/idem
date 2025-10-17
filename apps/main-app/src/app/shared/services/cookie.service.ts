import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class CookieService {
  private readonly document = inject(DOCUMENT);

  /**
   * Get cookie by name
   */
  get(name: string): string | null {
    const cookies = this.document.cookie.split(';');
    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split('=').map(c => c.trim());
      if (cookieName === name) {
        return cookieValue;
      }
    }
    return null;
  }

  /**
   * Set cookie with name, value and expiration time
   */
  set(name: string, value: string, expirationDays = 30): void {
    const date = new Date();
    date.setTime(date.getTime() + (expirationDays * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    this.document.cookie = `${name}=${value};${expires};path=/`;
  }

  /**
   * Remove cookie by name
   */
  remove(name: string): void {
    this.document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }
}
