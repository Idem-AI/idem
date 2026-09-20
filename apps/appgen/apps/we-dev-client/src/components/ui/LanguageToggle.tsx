import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

const LOCALES = ['fr', 'en'] as const;

/**
 * Bascule de langue.
 *
 * Comme le thème, la langue est un réglage de compte : `i18n.changeLanguage`
 * déclenche l'écriture du cookie partagé `idem_lang` (voir `utils/i18.ts`), de
 * sorte que le choix fait ici tient aussi dans le builder et dans les autres
 * applications Idem.
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const next = current === 'fr' ? 'en' : 'fr';

  const toggle = useCallback(() => {
    i18n.changeLanguage(next);
  }, [i18n, next]);

  return (
    <button
      type="button"
      onClick={toggle}
      title={next.toUpperCase()}
      aria-label={next.toUpperCase()}
      className={`h-9 px-2.5 flex items-center gap-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors ${className}`}
    >
      <Languages className="w-4 h-4" />
      <span className="text-xs font-medium uppercase">{current}</span>
    </button>
  );
}

export default LanguageToggle;
