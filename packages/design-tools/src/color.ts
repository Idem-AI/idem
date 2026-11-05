/// <reference path="./vendor.d.ts" />
/**
 * LA COULEUR — palettes dérivées en OKLCH et contraste WCAG 2.
 *
 * Les harmonies sont calculées ici (rotation de teinte en OKLCH) : `pro-color-harmonies`, essayé d'abord, ne
 * s'exporte pas en CommonJS dans Node (son UMD rend un objet vide).
 *
 * Les couleurs de la MARQUE restent la source de vérité : l'outil ne propose que des DÉRIVÉES (nuances, harmonies,
 * fonds, encres) et corrige un contraste par le plus petit déplacement de clarté. Le contraste est celui de WCAG 2
 * (APCA est écarté : licence limitée, voir le registre des licences du plan).
 */
import { z } from 'zod';
import { converter, formatHex, parse, wcagContrast } from 'culori';
import type { DesignTool } from './tool';

export type Harmony = 'analogous' | 'complementary' | 'triadic' | 'tetradic' | 'splitComplementary';

/** Les rotations de teinte de chaque harmonie (degrés, en OKLCH : des écarts perçus réguliers). */
const HARMONY_HUES: Record<Harmony, number[]> = {
  analogous: [-30, 30],
  complementary: [180],
  triadic: [120, 240],
  tetradic: [90, 180, 270],
  splitComplementary: [150, 210],
};

const toOklch = converter('oklch');

export function hexToOklch(hex: string): { l: number; c: number; h: number } | undefined {
  const parsed = parse(hex);
  const o = parsed ? toOklch(parsed) : undefined;
  return o ? { l: o.l, c: o.c, h: o.h ?? 0 } : undefined;
}

export function oklchToHex(c: { l: number; c: number; h: number }): string {
  return formatHex({ mode: 'oklch', l: Math.min(1, Math.max(0, c.l)), c: Math.max(0, c.c), h: c.h }) ?? '#000000';
}

export function contrastRatio(foreground: string, background: string): number {
  try {
    return Math.round(wcagContrast(foreground, background) * 100) / 100;
  } catch {
    return 1;
  }
}

/** Le seuil WCAG 2 AA : 4,5 pour un texte courant, 3 pour un grand texte (≥ 24 px, ou ≥ 18,66 px gras). */
export const aaThreshold = (large: boolean) => (large ? 3 : 4.5);

/**
 * La plus petite correction : on déplace la CLARTÉ de la couleur du texte (teinte et saturation gardées) vers le
 * sombre ou le clair, jusqu'au seuil. `null` si aucune clarté n'y parvient.
 */
export function fixContrast(foreground: string, background: string, target = 4.5): string | null {
  if (contrastRatio(foreground, background) >= target) return foreground;
  const fg = hexToOklch(foreground);
  const bg = hexToOklch(background);
  if (!fg || !bg) return null;
  const direction = bg.l > 0.6 ? -1 : 1;
  for (let step = 1; step <= 100; step++) {
    const l = fg.l + direction * step * 0.01;
    if (l < 0 || l > 1) break;
    const candidate = oklchToHex({ ...fg, l });
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  return null;
}

export interface DerivedPalette {
  /** Les couleurs de la marque, inchangées. */
  brand: string[];
  /** Une harmonie calculée à partir de la couleur principale. */
  harmony: string[];
  /** Des nuances de chaque couleur de marque (claires → sombres). */
  tints: Record<string, string[]>;
  /** Un fond clair et une encre lisibles avec la couleur principale. */
  ground: string;
  ink: string;
}

const paletteInput = z.object({
  brand: z.array(z.string().regex(/^#[0-9a-fA-F]{3,8}$/)).min(1).max(8),
  harmony: z.enum(['analogous', 'complementary', 'triadic', 'tetradic', 'splitComplementary']).default('analogous'),
});

export function derivePalette(brand: string[], harmony: Harmony = 'analogous'): DerivedPalette {
  const base = hexToOklch(brand[0]) ?? { l: 0.6, c: 0.12, h: 30 };
  // La teinte tourne, clarté et saturation gardées (la saturation est ramenée dans le gamut sRGB par formatHex).
  const harmonyHex = [brand[0], ...HARMONY_HUES[harmony].map((d) => oklchToHex({ ...base, h: (base.h + d + 360) % 360 }))];
  const tints: Record<string, string[]> = {};
  for (const hex of brand) {
    const o = hexToOklch(hex);
    if (o) tints[hex] = [0.96, 0.88, 0.75, 0.6, 0.45, 0.3, 0.2].map((l) => oklchToHex({ l, c: Math.min(o.c, l > 0.85 ? 0.03 : o.c), h: o.h }));
  }
  // Le fond reste clair (politique de surface claire) ; l'encre, presque noire, teintée de la couleur principale.
  const ground = oklchToHex({ l: 0.985, c: Math.min(base.c, 0.012), h: base.h });
  const ink = fixContrast(oklchToHex({ l: 0.22, c: Math.min(base.c, 0.03), h: base.h }), ground, 7) ?? '#111111';
  return { brand, harmony: harmonyHex, tints, ground, ink };
}

export const paletteTool: DesignTool<z.infer<typeof paletteInput>, DerivedPalette> = {
  name: 'palette',
  description: 'Derived colours of the brand (harmony, tints, a light ground and a readable ink). The brand colours stay as given.',
  schema: paletteInput as unknown as z.ZodType<z.infer<typeof paletteInput>>,
  run: async (input) => derivePalette(input.brand, input.harmony),
};

const contrastInput = z.object({ foreground: z.string(), background: z.string(), large: z.boolean().default(false) });

export const contrastTool: DesignTool<z.infer<typeof contrastInput>, { ratio: number; passes: boolean; fixed?: string }> = {
  name: 'contrast',
  description: 'WCAG 2 contrast of a text colour on a background, and the smallest lightness change that makes it pass AA.',
  schema: contrastInput as unknown as z.ZodType<z.infer<typeof contrastInput>>,
  run: async ({ foreground, background, large }) => {
    const ratio = contrastRatio(foreground, background);
    const passes = ratio >= aaThreshold(large);
    const fixed = passes ? undefined : fixContrast(foreground, background, aaThreshold(large)) ?? undefined;
    return { ratio, passes, ...(fixed ? { fixed } : {}) };
  },
};
