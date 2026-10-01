import { Router } from '@angular/router';

/**
 * "Come back here afterwards" — how a flow sends someone to add a missing
 * prerequisite (a server) and lands them back where they were, with their
 * answers so far carried in the query string.
 */

/**
 * Only an in-app path is accepted: a `returnTo` is read from the URL, so
 * anything else — `https://…`, `//evil.example` — would make this an open
 * redirect.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

/** `url` with `params` merged into its query string; a null value removes that key. */
export function withQueryParams(router: Router, url: string, params: Record<string, string | null>): string {
  const tree = router.parseUrl(url);
  const query = { ...tree.queryParams };
  for (const [key, value] of Object.entries(params)) {
    if (value === null) delete query[key];
    else query[key] = value;
  }
  tree.queryParams = query;
  return router.serializeUrl(tree);
}

/** Split an in-app URL into what `[routerLink]` and `[queryParams]` expect. */
export function returnLink(url: string): { path: string; query: Record<string, string> } {
  const [path, search = ''] = url.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(search)) };
}
