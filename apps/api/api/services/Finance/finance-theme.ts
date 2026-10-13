/**
 * Le THÈME du rapport financier : la charte réelle du projet, lue par le moteur graphique
 * (@idem/graphic-engine) — encres garanties lisibles, surface claire, rampes de la marque, polices
 * chargées — et rendue sous la forme qu'attend le gabarit du rapport.
 *
 * Le rapport garde sa propre mise en page (tableaux et graphiques du module Finance) ; il emprunte au
 * moteur ce qui fait l'identité d'un document IDEM, pour que le rapport et le business plan d'un même
 * projet portent exactement les mêmes couleurs et les mêmes polices.
 */
import { brandFromIdem, buildTokens, IdemBrandingLike, resolveStyle } from '@idem/graphic-engine';

export interface ReportTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    /** Fond de page. */
    surface: string;
    surfaceRaised: string;
    ink: string;
    inkMuted: string;
    rule: string;
    /** Rampe de la couleur de marque (50 → 950). */
    brand: Record<string, string>;
    neutral: Record<string, string>;
  };
  fonts: { display: string; body: string };
  /** Échelle typographique du rapport (px), calculée sur le ratio du style. */
  typeScale: Record<'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl', number>;
  /** Pas d'espacement (px). */
  spacing: number;
  radius: number;
  /** Fond sombre (seulement si la charte l'impose explicitement : politique de surface claire). */
  dark: boolean;
}

/**
 * Une échelle typographique se CALCULE : chaque niveau est le précédent multiplié par le ratio du style,
 * les extrémités bornées pour rester lisibles à l'impression (10 px au plus petit, 96 px au plus grand).
 */
function typeScale(ratio: number, base = 16): ReportTheme['typeScale'] {
  const clamp = (value: number) => Math.min(96, Math.max(10, Math.round(value)));
  const up = (steps: number) => clamp(base * Math.pow(ratio, steps));
  const down = (steps: number) => clamp(base / Math.pow(ratio, steps));
  return { xs: down(2), sm: down(1), base, lg: up(1), xl: up(2), '2xl': up(3), '3xl': up(4), '4xl': up(5) };
}

export function reportThemeOf(name: string, branding?: IdemBrandingLike | null): ReportTheme {
  const { brand, direction } = brandFromIdem({ name, branding: branding ?? undefined });
  const tokens = buildTokens({ brand: { ...brand, patterns: undefined }, direction, format: 'a4-portrait' });
  const style = resolveStyle(direction.styleId);
  const c = tokens.color;
  return {
    colors: {
      primary: c.primary,
      secondary: c.secondary,
      accent: c.accent,
      surface: c.ground,
      surfaceRaised: c.raised,
      ink: c.ink,
      inkMuted: c.muted,
      rule: c.rule,
      brand: c.brandRamp,
      neutral: c.neutral,
    },
    fonts: { display: tokens.font.display, body: tokens.font.body },
    typeScale: typeScale(Math.max(1.25, style.typeRatio)),
    spacing: 8,
    radius: style.radius,
    dark: c.dark,
  };
}
