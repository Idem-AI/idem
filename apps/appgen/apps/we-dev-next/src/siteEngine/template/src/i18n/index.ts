/**
 * Les langues du site — posé par IDEM, NE PAS MODIFIER.
 *
 * Chaque texte affiché passe par `t("texte d'origine")` : dans la langue principale il ressort tel quel, dans une
 * autre il est lu dans `messages/<langue>.json` (le texte d'origine est la clé, une traduction absente laisse
 * l'original). Chaque langue a ses propres pages (`/en/`, `/en/a-propos/`) : la langue est celle du document
 * (`<html lang>`), connue avant le premier rendu, si bien qu'un texte écrit hors d'un composant se traduit aussi.
 *
 *   t(texte, valeurs?)      le texte dans la langue de la page (`{nom}` remplacé par `valeurs.nom`)
 *   localePath(lien)        un lien interne vers la même page dans la langue courante (`/contact/` → `/en/contact/`)
 *   localize(objet)         l'objet, ses textes traduits à la lecture (les faits de `@/site/data`)
 *   languages               les langues du site, la principale en tête
 */
import config from './config.json';
import { messages } from './messages';

declare global {
  // Posé par le pré-rendu, une langue après l'autre.
  // eslint-disable-next-line no-var
  var __IDEM_LANG__: string | undefined;
}

export const defaultLanguage: string = config.defaultLanguage;
export const languages: string[] = config.languages.length ? config.languages : [config.defaultLanguage];

/** Le nom de chaque langue dans cette langue : ce que montre le sélecteur. */
export const languageNames: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  it: 'Italiano',
  nl: 'Nederlands',
  ar: 'العربية',
  sw: 'Kiswahili',
  zh: '中文',
  ru: 'Русский',
  tr: 'Türkçe',
  wo: 'Wolof',
  ln: 'Lingála',
  ha: 'Hausa',
  yo: 'Yorùbá',
  am: 'አማርኛ',
};

export function currentLanguage(): string {
  const forced = globalThis.__IDEM_LANG__;
  if (forced && languages.includes(forced)) return forced;
  if (typeof document !== 'undefined') {
    const lang = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
    if (languages.includes(lang)) return lang;
  }
  return defaultLanguage;
}

export function t(text: string, values?: Record<string, string | number>): string {
  const lang = currentLanguage();
  let out = text;
  if (lang !== defaultLanguage) out = messages[lang]?.[text] ?? text;
  if (values) for (const [key, value] of Object.entries(values)) out = out.split(`{${key}}`).join(String(value));
  return out;
}

/** Le chemin sans son préfixe de langue (`/en/contact/` → `/contact/`). */
export function stripLanguage(path: string): string {
  const match = path.match(/^\/([a-z]{2})(\/.*)?$/);
  return match && match[1] !== defaultLanguage && languages.includes(match[1]) ? match[2] || '/' : path;
}

/** Un lien interne vers la même page dans `lang` ; un lien externe, un fichier ou une ancre restent tels quels. */
export function localePath<T>(href: T, lang: string = currentLanguage()): T {
  if (typeof href !== 'string' || !/^\/(?!\/)/.test(href)) return href;
  if (/\.[a-z0-9]{2,5}$/i.test(href.split(/[?#]/)[0])) return href;
  const bare = stripLanguage(href);
  return (lang === defaultLanguage ? bare : `/${lang}${bare}`) as T;
}

const proxies = new WeakMap<object, unknown>();

/** L'objet tel quel, mais chaque texte lu dedans passe par `t()` (au moment de la lecture, donc dans la bonne langue). */
export function localize<T>(value: T): T {
  if (languages.length < 2 || !value || typeof value !== 'object') return value;
  const cached = proxies.get(value as object);
  if (cached) return cached as T;
  const proxy = new Proxy(value as object, {
    get(target, key, receiver) {
      const read = Reflect.get(target, key, receiver);
      if (typeof read === 'string') return t(read);
      if (read && typeof read === 'object') return localize(read);
      return read;
    },
  });
  proxies.set(value as object, proxy);
  return proxy as T;
}
