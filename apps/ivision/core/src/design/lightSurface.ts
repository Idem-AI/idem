/**
 * Politique de surface claire.
 *
 * Une palette proposée par un modèle peut revenir avec un fond sombre — les
 * prompts l'autorisaient explicitement pour « la palette audacieuse ». Le fond
 * traverse ensuite toute la chaîne : le design system des livrables bascule en
 * thème sombre (`documentDesignSystem`), la forge de tokens du site généré
 * aligne sa polarité dessus (`tokenForge`), et une charte entière passe au noir
 * sans que l'utilisateur ne l'ait demandé nulle part.
 *
 * La règle est donc posée ici, en CODE, plutôt qu'en consigne dans un prompt :
 * un fond qui n'est pas clair est ramené sur un blanc cassé, et l'encre est
 * reposée dessus jusqu'à franchir le seuil AAA. La TEINTE de la marque est
 * conservée — on corrige la polarité, pas la couleur.
 */

import { ensureContrast, hexToOklch, hexToRgb, oklchToHex, relativeLuminance } from './color';

/**
 * Luminance minimale d'un fond considéré comme clair.
 *
 * Nettement au-dessus du seuil de 0,35 auquel les consommateurs aval basculent
 * en thème sombre : une palette passée par ici ne peut donc pas les faire
 * basculer, même à la marge.
 */
export const LIGHT_SURFACE_MIN_LUMINANCE = 0.6;

export interface SurfaceColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

/** Vrai si ce fond tient une page en thème clair. */
export function isLightSurface(hex: string | undefined | null): boolean {
  const rgb = hex ? hexToRgb(hex) : null;
  return !!rgb && relativeLuminance(rgb) >= LIGHT_SURFACE_MIN_LUMINANCE;
}

/**
 * Ramène une palette sur une surface claire lisible.
 *
 * Sans effet sur une palette déjà claire — c'est le cas courant, et une
 * palette conforme doit ressortir identique à ce que le modèle a proposé.
 */
export function enforceLightSurface<T extends SurfaceColors>(colors: T): T {
  if (!colors) return colors;

  const brandHue = hexToOklch(colors.primary || '')?.h ?? hexToOklch(colors.background || '')?.h;

  let background = colors.background;
  if (!isLightSurface(background)) {
    const proposed = background ? hexToOklch(background) : null;
    // Seule la CLARTÉ remonte. La teinte proposée (à défaut, celle de la
    // primaire) est conservée, et la chroma est bridée : un fond de page est
    // un blanc teinté, pas une couleur.
    background = oklchToHex({
      l: 0.975,
      c: Math.min(proposed?.c ?? 0.012, 0.02),
      h: proposed?.h ?? brandHue ?? 250,
    });
  }

  // Une encre claire accompagnait le fond sombre : sur le fond redressé, elle
  // deviendrait invisible. On repart d'un quasi-noir à la teinte de la marque.
  const inkSeed =
    colors.text && !isLightSurface(colors.text)
      ? colors.text
      : oklchToHex({ l: 0.22, c: 0.02, h: brandHue ?? 250 });

  return {
    ...colors,
    background,
    text: ensureContrast(inkSeed, background as string, 7),
  };
}

/**
 * Applique la politique à une liste de palettes nommées (`ColorModel[]`),
 * telle que rendue par les générations de charte.
 */
export function enforceLightSurfaceOnPalettes<T extends { colors?: SurfaceColors }>(
  palettes: T[]
): T[] {
  if (!Array.isArray(palettes)) return palettes;
  return palettes.map((palette) =>
    palette?.colors ? { ...palette, colors: enforceLightSurface(palette.colors) } : palette
  );
}
