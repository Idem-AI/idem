import { cn } from '@/lib/utils';
import { currentLanguage, languageNames, languages, localePath, stripLanguage } from '@/i18n';

/**
 * Le choix de la langue — posé par IDEM. Rien ne s'affiche quand le site n'a qu'une langue. Chaque langue est un
 * lien vers la même page dans cette langue (pas de bascule en JavaScript : les moteurs de recherche suivent ces
 * liens et indexent chaque version).
 */
export default function LanguageSwitcher({ current, className }: { current?: string; className?: string }) {
  if (languages.length < 2) return null;
  const active = currentLanguage();
  const here = stripLanguage(current ?? (typeof window !== 'undefined' ? window.location.pathname : '/'));
  return (
    <nav aria-label="Langue / Language" className={cn('flex items-center gap-1 text-small', className)}>
      {languages.map((lang) => (
        <a
          key={lang}
          href={localePath(here, lang)}
          hrefLang={lang}
          lang={lang}
          title={languageNames[lang] ?? lang}
          aria-current={lang === active ? 'true' : undefined}
          className={cn(
            'rounded-button px-2 py-1 font-medium uppercase tracking-wide transition-colors',
            lang === active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {lang}
        </a>
      ))}
    </nav>
  );
}
