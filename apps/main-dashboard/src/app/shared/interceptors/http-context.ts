import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Marks a request as "third-party": the auth interceptor must not attach the
 * Firebase bearer token to it. Use it for every call that leaves our own
 * infrastructure (Google Fonts, CDNs…) so no credential leaks to a host that
 * has no business seeing it.
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** Convenience builder: `this.http.get(url, { context: skipAuth() })`. */
export function skipAuth(): HttpContext {
  return new HttpContext().set(SKIP_AUTH, true);
}
