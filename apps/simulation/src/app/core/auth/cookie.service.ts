import { DOCUMENT, Injectable, inject } from '@angular/core';

/**
 * Cookie access shared with the other IDEM front-ends.
 *
 * Names and expiry semantics match the dashboard implementation so a session
 * written by one app is readable by the other on the same host.
 */
@Injectable({ providedIn: 'root' })
export class CookieService {
  private readonly document = inject(DOCUMENT);

  get(name: string): string | null {
    const cookies = this.document.cookie.split(';');
    for (const cookie of cookies) {
      const separator = cookie.indexOf('=');
      if (separator === -1) {
        continue;
      }
      const cookieName = cookie.slice(0, separator).trim();
      if (cookieName === name) {
        return cookie.slice(separator + 1).trim();
      }
    }
    return null;
  }

  set(name: string, value: string, expirationDays = 30): void {
    const date = new Date();
    date.setTime(date.getTime() + expirationDays * 24 * 60 * 60 * 1000);
    this.document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/;SameSite=Lax`;
  }

  remove(name: string): void {
    this.document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }
}
