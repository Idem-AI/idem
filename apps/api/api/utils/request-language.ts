import { AsyncLocalStorage } from 'async_hooks';

export type SupportedLanguage = 'en' | 'fr';

interface LanguageStore {
  language: SupportedLanguage;
}

/**
 * Request-scoped language store. The language middleware seeds this per request so
 * that any service (notably PromptService) can read the user's language without it
 * being threaded through every function signature.
 */
const storage = new AsyncLocalStorage<LanguageStore>();

export function runWithLanguage<T>(language: SupportedLanguage, fn: () => T): T {
  return storage.run({ language }, fn);
}

/** Current request's language, or undefined outside a request context. */
export function getRequestLanguage(): SupportedLanguage | undefined {
  return storage.getStore()?.language;
}

/** Normalize an arbitrary language hint to a supported language (defaults to 'en'). */
export function normalizeLanguage(value: unknown): SupportedLanguage {
  return String(value ?? '')
    .toLowerCase()
    .startsWith('fr')
    ? 'fr'
    : 'en';
}
