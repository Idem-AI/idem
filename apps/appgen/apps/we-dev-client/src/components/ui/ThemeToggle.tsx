import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import useThemeStore from '@/stores/themeSlice';
import { writeThemeCookie } from '@/utils/themeCookie';

/**
 * Bascule clair / sombre.
 *
 * Le thème est un réglage de compte, pas d'écran : il vit dans le cookie
 * `idem_theme`, partagé par toutes les applications Idem. Écrire uniquement
 * dans le store React laisserait la page d'accueil et le builder diverger,
 * exactement le symptôme observé — le clair choisi dans l'application, la page
 * d'accueil toujours sombre.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { isDarkMode, setTheme } = useThemeStore();

  const toggle = useCallback(() => {
    const next = !isDarkMode;
    setTheme(next);
    // `useInit` reflète le store sur les classes de <html> ; le cookie et le
    // stockage local gardent le choix d'un chargement à l'autre et d'une
    // application à l'autre.
    writeThemeCookie(next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }, [isDarkMode, setTheme]);

  const label = isDarkMode ? t('theme.switchToLight') : t('theme.switchToDark');

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`w-9 h-9 grid place-items-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors ${className}`}
    >
      {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export default ThemeToggle;
