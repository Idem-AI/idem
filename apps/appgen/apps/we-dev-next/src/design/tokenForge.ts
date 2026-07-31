/**
 * Design token forge.
 *
 * Computes a complete, contrast-verified design system in TypeScript and hands
 * it to the model as a fixed constraint. Two things follow from that:
 *
 * 1. Quality stops being probabilistic. A ratio that is calculated cannot come
 *    back at 3.1:1 because the model felt light grey was elegant.
 * 2. Cost drops. Roughly 450 tokens of computed tokens replace several thousand
 *    tokens of "build a design system" instructions plus the regeneration round
 *    that usually follows.
 *
 * The art direction is drawn from a stable per-project seed, so the same brief
 * generated for two different projects cannot converge on the same page.
 */

import { ProjectModel } from '../types/project.js';
import {
  buildNeutralRamp,
  buildRamp,
  contrastRatio,
  ensureContrast,
  hexToOklch,
  oklchToHex,
  rotateHue,
} from './color.js';
import {
  ART_DIRECTIONS,
  ArtDirection,
  FONT_PAIRINGS,
  FontPairing,
  MONO_FAMILY,
  Register,
} from './artDirections.js';

export interface DesignSystem {
  seed: number;
  register: Register;
  direction: ArtDirection;
  fonts: FontPairing & { mono: string };
  colors: {
    brand: Record<string, string>;
    neutral: Record<string, string>;
    accent: string;
    surface: string;
    surfaceRaised: string;
    ink: string;
    inkMuted: string;
  };
  contrast: {
    bodyOnSurface: number;
    mutedOnSurface: number;
    inkOnAccent: number;
  };
  typeScale: Record<string, string>;
  fontsHref: string;
}

/** xmur3: string to a well-distributed 32-bit seed. */
function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;

  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);

  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32: small deterministic PRNG, seeded above. */
function createRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length];
}

/**
 * Marketing surfaces are the product (design leads); app surfaces serve the
 * product (design supports). The two registers want different directions.
 */
export function resolveRegister(projectData?: ProjectModel): Register {
  const landingConfig =
    projectData?.analysisResultModel?.development?.configs?.landingPageConfig ?? 'NONE';

  return landingConfig === 'ONLY_LANDING' || landingConfig === 'INTEGRATED'
    ? 'marketing'
    : 'product';
}

const FALLBACK_HUES = [18, 42, 96, 152, 196, 232, 268, 318];

/** Brand colour from the project's branding, or a seeded one when absent. */
function resolveBrandColor(projectData: ProjectModel | undefined, random: () => number): string {
  const branding = projectData?.analysisResultModel?.branding;
  const explicit = branding?.colors?.colors?.primary || branding?.logo?.colors?.[0];

  if (explicit && hexToOklch(explicit)) {
    return explicit;
  }

  // No brand yet: commit to a saturated hue rather than defaulting to the
  // safe blue-violet band every generator lands on.
  return oklchToHex({ l: 0.55, c: 0.17, h: pick(FALLBACK_HUES, random) });
}

function resolveAccentColor(
  projectData: ProjectModel | undefined,
  brand: string,
  random: () => number
): string {
  const explicit = projectData?.analysisResultModel?.branding?.colors?.colors?.accent;

  if (explicit && hexToOklch(explicit) && contrastRatio(explicit, brand) > 1.2) {
    return explicit;
  }

  // A complementary-ish rotation reads as deliberate; a neighbouring hue reads
  // as an accident.
  return rotateHue(brand, random() > 0.5 ? 150 : -140);
}

function resolveFonts(projectData: ProjectModel | undefined, random: () => number): FontPairing {
  const typography = projectData?.analysisResultModel?.branding?.typography;
  const seeded = pick(FONT_PAIRINGS, random);

  if (!typography?.primaryFont) {
    return seeded;
  }

  return {
    display: typography.primaryFont,
    body: typography.secondaryFont || typography.primaryFont,
    displayWeights: '400;600;700',
    bodyWeights: '400;500;600;700',
  };
}

/**
 * Display steps follow the direction's ratio; the two steps below body use a
 * gentle 1.125 instead. Running a 1.414 ratio downward puts `xs` at 8px, which
 * is unreadable — small text is a legibility problem, not a rhythm problem.
 */
function buildTypeScale(ratio: number): Record<string, string> {
  const round = (value: number) => `${value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}rem`;
  const up = ['lg', 'xl', '2xl', '3xl', '4xl', '5xl'];

  const scale: Record<string, string> = {
    xs: round(1 / Math.pow(1.125, 2)),
    sm: round(1 / 1.125),
    base: '1rem',
  };

  up.forEach((name, index) => {
    scale[name] = round(Math.pow(ratio, index + 1));
  });

  return scale;
}

function googleFontsHref(fonts: FontPairing): string {
  const family = (name: string, weights: string) =>
    `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@${weights}`;

  return `https://fonts.googleapis.com/css2?${family(fonts.display, fonts.displayWeights)}&${family(
    fonts.body,
    fonts.bodyWeights
  )}&${family(MONO_FAMILY, '400;500')}&display=swap`;
}

export function forgeDesignSystem(projectData?: ProjectModel): DesignSystem {
  const seedSource = projectData?.id || projectData?.name || 'idem-appgen';
  const seed = hashSeed(seedSource);
  const random = createRandom(seed);

  const register = resolveRegister(projectData);
  const candidates = ART_DIRECTIONS.filter((direction) => direction.registers.includes(register));
  const direction = pick(candidates.length ? candidates : ART_DIRECTIONS, random);

  const fonts = resolveFonts(projectData, random);
  const brandColor = resolveBrandColor(projectData, random);
  const brandOklch = hexToOklch(brandColor) ?? { l: 0.55, c: 0.16, h: 250 };

  const brand = buildRamp(brandColor);
  const neutral = buildNeutralRamp(brandOklch.h, direction.surface === 'dark' ? 0.014 : 0.008);
  const accent = resolveAccentColor(projectData, brandColor, random);

  // Surfaces follow the direction, not the brief's adjectives. `drenched` puts
  // the brand hue on the surface itself; everything else uses the tinted
  // neutral ramp so the brand stays a signal rather than wallpaper.
  const isDark = direction.surface === 'dark';
  const drenched = direction.colorStrategy === 'drenched';

  const surface = drenched
    ? oklchToHex({ l: isDark ? 0.24 : 0.93, c: brandOklch.c * 0.55, h: brandOklch.h })
    : isDark
      ? neutral['950']
      : neutral['50'];

  const surfaceRaised = drenched
    ? oklchToHex({ l: isDark ? 0.32 : 0.97, c: brandOklch.c * 0.42, h: brandOklch.h })
    : isDark
      ? neutral['900']
      : '#ffffff';

  // Ink is derived then *verified*: this is the step model-authored palettes skip.
  const ink = ensureContrast(isDark ? neutral['100'] : neutral['950'], surface, 7);
  const inkMuted = ensureContrast(isDark ? neutral['300'] : neutral['700'], surface, 4.5);

  return {
    seed,
    register,
    direction,
    fonts: { ...fonts, mono: MONO_FAMILY },
    colors: { brand, neutral, accent, surface, surfaceRaised, ink, inkMuted },
    contrast: {
      bodyOnSurface: contrastRatio(ink, surface),
      mutedOnSurface: contrastRatio(inkMuted, surface),
      inkOnAccent: contrastRatio(ensureContrast(ink, accent, 4.5), accent),
    },
    typeScale: buildTypeScale(direction.typeRatio),
    fontsHref: googleFontsHref(fonts),
  };
}

const compactRamp = (ramp: Record<string, string>, stops: string[]) =>
  stops.map((stop) => `${stop}:'${ramp[stop]}'`).join(', ');

const BRAND_STOPS = ['50', '100', '300', '500', '600', '700', '900'];
const NEUTRAL_STOPS = ['50', '100', '200', '400', '600', '800', '950'];

/**
 * Renders the system as a compact prompt block (~450 tokens). Written as
 * copy-paste-ready config rather than prose: an instruction can be softened by
 * the model, a config object it is told to paste verbatim cannot.
 */
export function renderDesignBrief(system: DesignSystem): string {
  const { direction, fonts, colors, contrast, typeScale } = system;

  // Keys such as `2xl` must be quoted: an unquoted identifier cannot start with
  // a digit, and an invalid tailwind.config.js takes the whole build down.
  const scale = Object.entries(typeScale)
    .map(([name, size]) => `'${name}':'${size}'`)
    .join(', ');

  return `## DESIGN SYSTEM (pre-computed and contrast-verified — apply exactly, do not substitute)

### Art direction: ${direction.name}
- Surface: ${direction.surface} · Colour strategy: ${direction.colorStrategy}
- Borders: ${direction.borders}
- Shadows: ${direction.shadows}
- Page cadence: ${direction.cadence}
- Signature move (must be present): ${direction.signature}
- Wrong for this direction: ${direction.avoid}

### Fonts
Display "${fonts.display}", body "${fonts.body}", mono "${fonts.mono}".
Put this in index.html <head> (fonts must load, otherwise the whole system collapses to a system stack):
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${system.fontsHref}">

### tailwind.config.js → theme.extend (paste verbatim)
\`\`\`js
colors: {
  brand: { ${compactRamp(colors.brand, BRAND_STOPS)} },
  neutral: { ${compactRamp(colors.neutral, NEUTRAL_STOPS)} },
  accent: '${colors.accent}',
  surface: '${colors.surface}',
  'surface-raised': '${colors.surfaceRaised}',
  ink: '${colors.ink}',
  'ink-muted': '${colors.inkMuted}',
},
fontFamily: {
  display: ['${fonts.display}', ${direction.id === 'editorial-serif' ? "'Georgia', 'serif'" : "'system-ui', 'sans-serif'"}],
  sans: ['${fonts.body}', 'system-ui', 'sans-serif'],
  mono: ['${fonts.mono}', 'monospace'],
},
fontSize: { ${scale} },
borderRadius: { none: '0', sm: '${Math.max(0, Math.round(direction.radius / 2))}px', DEFAULT: '${direction.radius}px', lg: '${direction.radius * 2}px' },
spacing: { section: '${direction.spacingBase * 8}px', block: '${direction.spacingBase * 3}px', tight: '${direction.spacingBase}px' },
zIndex: { dropdown: '1000', sticky: '1100', backdrop: '1200', modal: '1300', toast: '1400', tooltip: '1500' },
\`\`\`

### Contrast (already verified, keep it that way)
- Body \`text-ink\` on \`bg-surface\`: ${contrast.bodyOnSurface.toFixed(1)}:1
- Secondary \`text-ink-muted\` on \`bg-surface\`: ${contrast.mutedOnSurface.toFixed(1)}:1
Use \`text-ink\` for body copy and \`text-ink-muted\` only for genuinely secondary text. Never a lighter grey than \`ink-muted\`, and never \`text-gray-400/500\` — those are not in this palette.

### Type rules
Scale ratio ${direction.typeRatio}. Hero display: \`clamp(${typeScale['3xl']}, 6vw, ${Math.min(6, parseFloat(typeScale['5xl']) * 1.4).toFixed(2)}rem)\`, tracking no tighter than -0.04em. Body measure capped at 68ch. \`text-wrap: balance\` on h1-h3.`;
}
