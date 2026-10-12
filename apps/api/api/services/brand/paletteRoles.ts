/**
 * Distinction des rôles d'une palette.
 *
 * Une palette porte cinq rôles — primaire, secondaire, accent, fond, texte — et
 * son intérêt tient à ce qu'ils soient DISTINCTS : la secondaire tient les
 * surfaces, les filets et les actions de second plan, l'accent tient l'appel à
 * l'action. Deux rôles sur la même couleur, et la hiérarchie disparaît.
 *
 * Le cas qui l'a fait apparaître : un logo d'une seule couleur. La primaire et
 * la secondaire étaient toutes deux alimentées par cette unique couleur, puis
 * le prompt exigeait de les reproduire « exactement » — le modèle obéissait, et
 * les trois palettes proposées ne portaient que deux couleurs libres au lieu de
 * trois.
 *
 * Le prompt le demande désormais (`buildColorsFromLogoPrompt`), mais une
 * consigne est respectée la plupart du temps, pas toujours. Ce module pose la
 * garantie : une secondaire trop proche de la primaire est RECONSTRUITE, en
 * gardant la parenté avec la marque.
 */

import { hexToOklch, oklchToHex, rotateHue } from './color';

export interface PaletteRoles {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

/**
 * Écart minimal entre deux rôles chromatiques, en OKLCH.
 *
 * Deux couleurs sont jugées distinctes dès qu'elles s'écartent franchement sur
 * UN des axes : la teinte (25°), la clarté (0,10) ou le chroma (0,05). Une
 * secondaire « même teinte, nettement plus sombre » est un choix légitime ;
 * « même teinte, à peine plus sombre » n'en est pas un.
 */
const MIN_HUE_DISTANCE = 25;
const MIN_LIGHTNESS_DISTANCE = 0.1;
const MIN_CHROMA_DISTANCE = 0.05;

/** Écart circulaire entre deux teintes, en degrés (0-180). */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Vrai quand les deux couleurs se lisent comme deux couleurs différentes. */
export function areRolesDistinct(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return true;
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return false;

  const first = hexToOklch(a);
  const second = hexToOklch(b);
  if (!first || !second) return true; // illisible : on ne tranche pas

  // Un gris n'a pas de teinte exploitable : seules la clarté et le chroma comptent.
  const bothChromatic = first.c > 0.03 && second.c > 0.03;

  return (
    (bothChromatic && hueDistance(first.h, second.h) >= MIN_HUE_DISTANCE) ||
    Math.abs(first.l - second.l) >= MIN_LIGHTNESS_DISTANCE ||
    Math.abs(first.c - second.c) >= MIN_CHROMA_DISTANCE
  );
}

/**
 * Secondaire construite à partir de la primaire.
 *
 * `variant` échelonne les palettes d'un même lot pour qu'elles ne reçoivent pas
 * trois fois la même réparation : analogue plus profonde, neutre chromatique,
 * puis complémentaire partagée — les trois constructions que le prompt demande.
 */
export function deriveSecondary(primary: string, variant = 0): string {
  const base = hexToOklch(primary);
  if (!base) return primary;

  switch (variant % 3) {
    case 1:
      // Neutre chromatique : la teinte de la marque tenue très bas en chroma.
      return oklchToHex({ l: 0.32, c: Math.min(base.c, 0.04), h: base.h });
    case 2:
      // Complémentaire partagée, à clarté légèrement décalée.
      return rotateHue(
        oklchToHex({ l: Math.min(0.72, base.l + 0.12), c: base.c * 0.75, h: base.h }),
        150
      );
    default:
      // Analogue plus profonde et moins saturée.
      return oklchToHex({
        l: Math.max(0.28, base.l - 0.18),
        c: base.c * 0.7,
        h: (base.h + 32) % 360,
      });
  }
}

/**
 * Accent construit à partir de la primaire.
 *
 * Une simple rotation de teinte reconduit la clarté et le chroma de la
 * primaire : sur une primaire claire et peu saturée, elle rendait un accent
 * délavé, incapable de porter un appel à l'action. On repose donc l'accent à
 * une clarté et un chroma tenus, et on ne lui emprunte que sa teinte tournée.
 */
export function deriveAccent(primary: string, variant = 0): string {
  const base = hexToOklch(primary);
  if (!base) return rotateHue(primary, 165);

  return oklchToHex({
    l: 0.6,
    c: Math.max(base.c, 0.15),
    h: (base.h + (variant % 2 === 0 ? 165 : 205)) % 360,
  });
}

/**
 * Garantit que la secondaire et l'accent ne doublonnent pas la primaire.
 *
 * Ne touche à rien quand la palette est déjà correcte — c'est le cas courant,
 * et une palette conforme doit ressortir telle que le modèle l'a proposée.
 */
export function ensureDistinctRoles<T extends PaletteRoles>(colors: T, variant = 0): T {
  if (!colors?.primary) return colors;

  let secondary = colors.secondary;
  if (!areRolesDistinct(colors.primary, secondary)) {
    secondary = deriveSecondary(colors.primary, variant);
  }

  let accent = colors.accent;
  // L'accent doit se détacher des DEUX : il ne sert à rien s'il répète l'une.
  if (!areRolesDistinct(colors.primary, accent) || !areRolesDistinct(secondary, accent)) {
    accent = deriveAccent(colors.primary, variant);
  }

  return { ...colors, secondary, accent };
}

/**
 * Applique la règle à une liste de palettes nommées (`ColorModel[]`).
 * L'index sert de `variant` : trois palettes réparées restent trois offres
 * différentes plutôt que trois fois la même.
 */
export function ensureDistinctRolesOnPalettes<T extends { colors?: PaletteRoles }>(
  palettes: T[]
): T[] {
  if (!Array.isArray(palettes)) return palettes;
  return palettes.map((palette, index) =>
    palette?.colors ? { ...palette, colors: ensureDistinctRoles(palette.colors, index) } : palette
  );
}
