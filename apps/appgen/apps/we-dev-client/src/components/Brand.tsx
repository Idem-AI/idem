import useThemeStore from '@/stores/themeSlice';

/**
 * Identité iCode — point unique de vérité.
 *
 * Le logotype existe en deux versions : lettrage blanc pour les fonds sombres,
 * lettrage bleu pour les fonds clairs. Avant, chaque écran choisissait son
 * image à la main (`logo_white.png` ici, `idem-logo.png` là, `idev-logo.png`
 * sur la landing), et la marque affichée divergeait d'un écran à l'autre.
 * Tout passe désormais par ce composant.
 */

const WORDMARK = {
  dark: '/assets/icode-logo-dark.png',
  light: '/assets/icode-logo-light.png',
} as const;

/** Ratio natif du logotype (1780 × 520). Sert à réserver la place et éviter le
 *  décalage de mise en page pendant le chargement de l'image. */
const WORDMARK_RATIO = 1780 / 520;

const SIZES = {
  sm: 22,
  md: 28,
  lg: 40,
  xl: 64,
} as const;

export type BrandSize = keyof typeof SIZES;

interface BrandProps {
  /** Hauteur du logotype. */
  size?: BrandSize;
  /** Force un thème ; par défaut, suit le thème de l'application. */
  variant?: 'dark' | 'light';
  className?: string;
}

/** Le logotype complet : symbole + mot « iCode ». */
export function Brand({ size = 'md', variant, className = '' }: BrandProps) {
  const { isDarkMode } = useThemeStore();
  const resolved = variant ?? (isDarkMode ? 'dark' : 'light');
  const height = SIZES[size];

  return (
    <img
      src={WORDMARK[resolved]}
      alt="iCode"
      height={height}
      width={Math.round(height * WORDMARK_RATIO)}
      style={{ height, width: 'auto' }}
      className={`select-none ${className}`}
      draggable={false}
    />
  );
}

/** Le symbole seul (carré bleu), pour les emplacements étroits : favicon dans
 *  l'app, avatar, écran de chargement. Lisible sur les deux thèmes. */
export function BrandMark({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/assets/icons/icode-icon.png"
      alt="iCode"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`select-none rounded-[22%] ${className}`}
      draggable={false}
    />
  );
}

export default Brand;
