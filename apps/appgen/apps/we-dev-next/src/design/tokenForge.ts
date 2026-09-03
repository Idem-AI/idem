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
  hexToRgb,
  oklchToHex,
  relativeLuminance,
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
  /** True when the project's own brand guidelines drove the palette or the fonts. */
  brandDriven: boolean;
  fonts: FontPairing & { mono: string; fromBrand?: boolean };
  colors: {
    brand: Record<string, string>;
    neutral: Record<string, string>;
    accent: string;
    secondary: string;
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
  /** One stylesheet URL per family; see googleFontsHrefs for why they are split. */
  fontsHrefs: string[];
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

interface ResolvedFonts extends FontPairing {
  /** True when the families come from the project's brand guidelines. */
  fromBrand: boolean;
}

function resolveFonts(projectData: ProjectModel | undefined, random: () => number): ResolvedFonts {
  const typography = projectData?.analysisResultModel?.branding?.typography;
  const seeded = pick(FONT_PAIRINGS, random);

  if (!typography?.primaryFont) {
    return { ...seeded, fromBrand: false };
  }

  // The brand's typography wins outright. The art direction governs composition
  // and rhythm, never the typefaces a project has already committed to.
  return {
    display: typography.primaryFont,
    body: typography.secondaryFont || typography.primaryFont,
    displayWeights: '400;600;700',
    bodyWeights: '400;500;600;700',
    fromBrand: true,
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

/**
 * One stylesheet URL per family, deliberately.
 *
 * The css2 endpoint answers 400 for a family it does not host, and it answers
 * for the *whole* request: a single brand font that is not on Google Fonts
 * would take the entire stylesheet down and silently drop the site to a system
 * stack. That is very likely why brand typography was not showing up. Split
 * across links, an unknown family costs only itself.
 */
function googleFontsHrefs(fonts: FontPairing): string[] {
  const href = (name: string, weights: string) =>
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name.trim()).replace(/%20/g, '+')}:wght@${weights}&display=swap`;

  const families: Array<[string, string]> = [
    [fonts.display, fonts.displayWeights],
    [fonts.body, fonts.bodyWeights],
    [MONO_FAMILY, '400;500'],
  ];

  const seen = new Set<string>();

  return families
    .filter(([name]) => {
      const key = name.trim().toLowerCase();
      if (!name.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(([name, weights]) => href(name, weights));
}

/**
 * Réglages imposés par l'utilisateur depuis le panneau Thème.
 *
 * La forge reste déterministe : sans surcharge, une même graine de projet
 * redonne exactement le même système. Une surcharge remplace *une* décision et
 * laisse le reste de la chaîne se recalculer — les contrastes sont donc
 * revérifiés, et l'utilisateur ne peut pas produire un thème illisible.
 */
export interface ForgeOverrides {
  /** Couleur de marque, en hexadécimal. Ignorée si elle n'est pas analysable. */
  brandColor?: string;
  /** `id` d'une direction artistique du catalogue. */
  directionId?: string;
  /** Police d'affichage d'un appariement du catalogue. */
  fontPairingDisplay?: string;
}

export function forgeDesignSystem(
  projectData?: ProjectModel,
  overrides?: ForgeOverrides
): DesignSystem {
  const seedSource = projectData?.id || projectData?.name || 'idem-appgen';
  const seed = hashSeed(seedSource);
  const random = createRandom(seed);

  const register = resolveRegister(projectData);
  const brandColors = projectData?.analysisResultModel?.branding?.colors?.colors;

  // A project that already has brand guidelines has already made these choices.
  // The art direction governs composition, rhythm and personality; it must not
  // repaint a committed palette, and in particular it must not flip a brand's
  // light background to a dark surface because the direction happens to be dark.
  const brandBackground =
    brandColors?.background && hexToOklch(brandColors.background) ? brandColors.background : null;
  const brandText = brandColors?.text && hexToOklch(brandColors.text) ? brandColors.text : null;
  const brandSecondary =
    brandColors?.secondary && hexToOklch(brandColors.secondary) ? brandColors.secondary : null;

  const brandPolarity = brandBackground
    ? relativeLuminance(hexToRgb(brandBackground)!) < 0.35
      ? 'dark'
      : 'light'
    : null;

  const candidates = ART_DIRECTIONS.filter(
    (direction) =>
      direction.registers.includes(register) &&
      // Keep only directions whose surface polarity matches the brand's.
      (!brandPolarity || direction.surface === brandPolarity)
  );

  const usable = candidates.length
    ? candidates
    : ART_DIRECTIONS.filter((direction) => direction.registers.includes(register));

  const forcedDirection = overrides?.directionId
    ? ART_DIRECTIONS.find((candidate) => candidate.id === overrides.directionId)
    : undefined;
  const direction = forcedDirection ?? pick(usable.length ? usable : ART_DIRECTIONS, random);

  const forcedPairing = overrides?.fontPairingDisplay
    ? FONT_PAIRINGS.find((pairing) => pairing.display === overrides.fontPairingDisplay)
    : undefined;
  const fonts = forcedPairing
    ? { ...forcedPairing, fromBrand: false }
    : resolveFonts(projectData, random);

  const overriddenBrand =
    overrides?.brandColor && hexToOklch(overrides.brandColor) ? overrides.brandColor : null;
  const brandColor = overriddenBrand ?? resolveBrandColor(projectData, random);
  const brandOklch = hexToOklch(brandColor) ?? { l: 0.55, c: 0.16, h: 250 };

  const brand = buildRamp(brandColor);
  const neutral = buildNeutralRamp(brandOklch.h, direction.surface === 'dark' ? 0.014 : 0.008);
  const accent = overriddenBrand
    ? rotateHue(brandColor, random() > 0.5 ? 150 : -140)
    : resolveAccentColor(projectData, brandColor, random);
  const secondary = brandSecondary ?? rotateHue(brandColor, 28);

  const isDark = direction.surface === 'dark';
  const drenched = direction.colorStrategy === 'drenched';

  // Brand background wins. Only when the project has none does the direction
  // get to choose the surface: `drenched` puts the brand hue on the surface
  // itself, everything else sits on the tinted neutral ramp.
  const surface =
    brandBackground ??
    (drenched
      ? oklchToHex({ l: isDark ? 0.24 : 0.93, c: brandOklch.c * 0.55, h: brandOklch.h })
      : isDark
        ? neutral['950']
        : neutral['50']);

  const surfaceOklch = hexToOklch(surface) ?? { l: isDark ? 0.2 : 0.97, c: 0, h: brandOklch.h };

  const surfaceRaised = brandBackground
    ? // Step away from the brand surface rather than inventing a second colour.
      oklchToHex({
        ...surfaceOklch,
        l: clamp01(surfaceOklch.l + (brandPolarity === 'dark' ? 0.07 : -0.035)),
      })
    : drenched
      ? oklchToHex({ l: isDark ? 0.32 : 0.97, c: brandOklch.c * 0.42, h: brandOklch.h })
      : isDark
        ? neutral['900']
        : '#ffffff';

  // Ink starts from the brand's own text colour when there is one, then gets
  // verified. Verification only ever moves lightness, so the hue stays on brand.
  const inkSeed = brandText ?? (isDark ? neutral['100'] : neutral['950']);
  const ink = ensureContrast(inkSeed, surface, 7);
  const inkMuted = ensureContrast(
    brandText ? mixToward(brandText, surface, 0.38) : isDark ? neutral['300'] : neutral['700'],
    surface,
    4.5
  );

  return {
    seed,
    register,
    direction,
    brandDriven: Boolean(brandColors || fonts.fromBrand),
    fonts: { ...fonts, mono: MONO_FAMILY },
    colors: { brand, neutral, accent, secondary, surface, surfaceRaised, ink, inkMuted },
    contrast: {
      bodyOnSurface: contrastRatio(ink, surface),
      mutedOnSurface: contrastRatio(inkMuted, surface),
      inkOnAccent: contrastRatio(ensureContrast(ink, accent, 4.5), accent),
    },
    typeScale: buildTypeScale(direction.typeRatio),
    fontsHrefs: googleFontsHrefs(fonts),
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Moves a colour toward another in OKLCH, keeping it on the same family. */
function mixToward(from: string, toward: string, amount: number): string {
  const a = hexToOklch(from);
  const b = hexToOklch(toward);

  if (!a || !b) {
    return from;
  }

  return oklchToHex({
    l: a.l + (b.l - a.l) * amount,
    c: a.c + (b.c - a.c) * amount,
    h: a.h,
  });
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

  const fontLinks = [
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    ...system.fontsHrefs.map((href) => `<link rel="stylesheet" href="${href}">`),
  ].join('\n');

  const brandNote = system.brandDriven
    ? `\n**This project has committed brand guidelines.** The palette and typefaces below come from them and are not negotiable. The art direction shapes layout, rhythm and personality only — it never repaints the brand.\n`
    : '';

  return `## DESIGN SYSTEM (pre-computed and contrast-verified — apply exactly, do not substitute)
${brandNote}
### Art direction: ${direction.name}
- Surface: ${direction.surface} · Colour strategy: ${direction.colorStrategy}
- Borders: ${direction.borders}
- Shadows: ${direction.shadows}
- Page cadence: ${direction.cadence}
- Signature move (must be present): ${direction.signature}
- Wrong for this direction: ${direction.avoid}

### Fonts${fonts.fromBrand ? ' (from the project brand guidelines — use these exact families)' : ''}
Display "${fonts.display}", body "${fonts.body}", mono "${fonts.mono}".

Put these in index.html <head>. One link per family on purpose: the Google Fonts endpoint rejects the whole request if any single family is unknown, which would silently drop every font.
${fontLinks}

Then set the body family in \`src/styles/index.css\` so nothing falls back silently:
\`\`\`css
@layer base {
  body { font-family: '${fonts.body}', system-ui, sans-serif; }
  h1, h2, h3 { font-family: '${fonts.display}', ${direction.id === 'editorial-serif' ? "Georgia, serif" : 'system-ui, sans-serif'}; }
}
\`\`\`

### tailwind.config.js → theme.extend (paste verbatim)
\`\`\`js
colors: {
  brand: { ${compactRamp(colors.brand, BRAND_STOPS)} },
  neutral: { ${compactRamp(colors.neutral, NEUTRAL_STOPS)} },
  accent: '${colors.accent}',
  secondary: '${colors.secondary}',
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
