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
  buildAnchoredRamp,
  CharterStyle,
  isLightSurface,
  readableOn,
  readFonts,
  readPalette,
  resolveCharterStyle,
} from './charter.js';
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
    /** Encre lisible posée SUR la couleur de marque (boutons, bandeaux). */
    onBrand: string;
    /** Encre lisible posée sur l'accent. */
    onAccent: string;
  };
  /** Style de direction artistique de la charte, quand le projet en a une. */
  charterStyleId?: string;
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
  const charter = readFonts(projectData?.analysisResultModel?.branding);
  const seeded = pick(FONT_PAIRINGS, random);

  if (!charter.display) {
    return { ...seeded, fromBrand: false };
  }

  // The brand's typography wins outright. The art direction governs composition
  // and rhythm, never the typefaces a project has already committed to.
  // Lu comme brand-kit le lit : `primary.family` avant `primaryFont`.
  return {
    display: charter.display,
    body: charter.body || charter.display,
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

  // Light by default, and a brand's own background is the only thing that can
  // ask for dark. Without this, a seeded pick landing on a dark direction
  // turned a perfectly light brand's site black — nobody had asked for it, and
  // there was no way to tell why one project came out dark and the next did
  // not. A brand that genuinely wants dark says so through its background.
  const targetPolarity = brandPolarity ?? 'light';

  const candidates = ART_DIRECTIONS.filter(
    (direction) =>
      direction.registers.includes(register) &&
      // Keep only directions whose surface polarity matches the brand's.
      direction.surface === targetPolarity
  );

  const usable = candidates.length
    ? candidates
    : ART_DIRECTIONS.filter((direction) => direction.registers.includes(register));

  const forcedDirection = overrides?.directionId
    ? ART_DIRECTIONS.find((candidate) => candidate.id === overrides.directionId)
    : undefined;

  // La direction artistique de la CHARTE passe avant le tirage au sort : c'est
  // elle que la charte, le business plan et le deck appliquent déjà. Le site
  // tirait la sienne dans un catalogue à part, et ne ressemblait donc à aucun
  // des autres livrables du même projet.
  const branding = projectData?.analysisResultModel?.branding as any;
  const charterStyle = resolveCharterStyle(branding?.artDirection?.styleId);
  const seeded = pick(usable.length ? usable : ART_DIRECTIONS, random);
  const direction =
    forcedDirection ??
    (charterStyle ? directionFromCharter(charterStyle, branding?.artDirection, seeded) : seeded);

  const forcedPairing = overrides?.fontPairingDisplay
    ? FONT_PAIRINGS.find((pairing) => pairing.display === overrides.fontPairingDisplay)
    : undefined;
  const charterFonts = readFonts(branding);
  const fonts = forcedPairing
    ? { ...forcedPairing, fromBrand: false }
    : resolveFonts(projectData, random);

  const overriddenBrand =
    overrides?.brandColor && hexToOklch(overrides.brandColor) ? overrides.brandColor : null;
  const brandColor = overriddenBrand ?? resolveBrandColor(projectData, random);
  const brandOklch = hexToOklch(brandColor) ?? { l: 0.55, c: 0.16, h: 250 };

  // Rampe ancrée quand la couleur vient de la charte : `brand-600` — le cran
  // des boutons — est alors EXACTEMENT la primaire. L'ancienne rampe, calculée
  // à luminosité fixe, n'en gardait que la teinte.
  const charterPalette = readPalette(branding);
  const anchored = !overriddenBrand && charterPalette.primary === normalizeHexSafe(brandColor);
  const brand = anchored ? buildAnchoredRamp(brandColor) : buildRamp(brandColor);
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
  // Le fond de la charte quand il est clair. Un fond sombre n'est retenu que si
  // la charte le porte expressément ET qu'il reste lisible ; la politique IDEM
  // veut des sites clairs, et une direction tirée au sort ne peut plus imposer
  // le noir à une marque qui ne l'a pas choisi.
  const charterSurface =
    brandBackground && isLightSurface(brandBackground) ? brandBackground : null;

  const surface =
    charterSurface ??
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

  // Le texte posé sur la marque se choisit, il ne se suppose pas : une primaire
  // claire (jaune, ocre, vert d'eau) rendait le libellé blanc des boutons
  // illisible. Même règle pour l'accent.
  const onBrand = readableOn(brand['600'] ?? brandColor, ink);
  const onAccent = readableOn(accent, ink);

  return {
    seed,
    register,
    direction,
    brandDriven: Boolean(brandColors || fonts.fromBrand),
    fonts: { ...fonts, mono: MONO_FAMILY, fromBrand: fonts.fromBrand },
    colors: { brand, neutral, accent, secondary, surface, surfaceRaised, ink, inkMuted, onBrand, onAccent },
    charterStyleId: charterStyle?.id,
    contrast: {
      bodyOnSurface: contrastRatio(ink, surface),
      mutedOnSurface: contrastRatio(inkMuted, surface),
      inkOnAccent: contrastRatio(ensureContrast(ink, accent, 4.5), accent),
    },
    typeScale: buildTypeScale(direction.typeRatio),
    fontsHrefs: charterFontHrefs(fonts, charterFonts),
  };
}

/**
 * Les feuilles de police à charger.
 *
 * La charte stocke la feuille RÉELLE de chaque famille (`cssUrl`) : Google,
 * Fontshare, Fontsource, ou police importée servie depuis notre bucket. Elle
 * passe avant tout. Une famille sans feuille déclarée retombe sur Google par
 * son nom — ce qui reste le cas des projets plus anciens.
 */
function charterFontHrefs(fonts: FontPairing & { fromBrand?: boolean }, charter: ReturnType<typeof readFonts>): string[] {
  const hrefs: string[] = [];
  const add = (href?: string) => {
    if (href && !hrefs.includes(href)) hrefs.push(href);
  };

  const sameFamily = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  // Une seule feuille historique pour les deux familles (`typography.url`).
  add(charter.sheetUrl);

  if (charter.displayCss && sameFamily(charter.display, fonts.display)) add(charter.displayCss);
  if (charter.bodyCss && sameFamily(charter.body, fonts.body)) add(charter.bodyCss);

  // Ce que la charte ne couvre pas passe par Google, par le nom de la famille.
  const covered = (family: string) =>
    (charter.displayCss && sameFamily(charter.display, family)) ||
    (charter.bodyCss && sameFamily(charter.body, family)) ||
    Boolean(charter.sheetUrl && (sameFamily(charter.display, family) || sameFamily(charter.body, family)));

  for (const href of googleFontsHrefs({
    ...fonts,
    display: covered(fonts.display) ? '' : fonts.display,
    body: covered(fonts.body) ? '' : fonts.body,
  })) {
    add(href);
  }

  return hrefs;
}

const normalizeHexSafe = (value: string): string => {
  const hex = String(value ?? '').trim().toLowerCase().replace(/^#/, '');
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : '';
};

/**
 * Une direction artistique tirée de la CHARTE (son `styleId`), dans la forme
 * attendue par le reste de la forge.
 *
 * Les grandeurs structurelles — rayon, raison de l'échelle, densité — sont
 * celles du moteur graphique pour ce style. Les textes (signature, cadence,
 * interdits) viennent de la direction écrite dans la charte quand elle existe.
 * Le fond, lui, reste clair : c'est la politique des livrables IDEM.
 */
function directionFromCharter(
  style: CharterStyle,
  written: any,
  fallback: ArtDirection
): ArtDirection {
  const spacing = style.density === 'airy' ? 12 : style.density === 'dense' ? 8 : 10;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).join(' · ') : '';

  return {
    ...fallback,
    id: `charter-${style.id}`,
    name: text(written?.styleName) || style.name,
    registers: ['marketing', 'product'],
    surface: 'light',
    radius: style.radius,
    spacingBase: spacing,
    typeRatio: style.typeRatio,
    cadence: text(written?.layout?.grid) || fallback.cadence,
    signature: text(written?.layout?.signatureMove) || fallback.signature,
    avoid: list(written?.donts) || fallback.avoid,
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
export interface RenderBriefOptions {
  /**
   * Vrai quand le starter préconfiguré est déjà monté dans l'espace de
   * travail : `tailwind.config.js`, `index.html` et la feuille de base portent
   * alors déjà ces jetons. Le brief passe donc de « recopiez ceci » à « voici
   * les noms disponibles », ce qui retire ~700 jetons de l'entrée et, surtout,
   * retire au modèle l'occasion de réécrire la palette de travers.
   */
  scaffolded?: boolean;
}

export function renderDesignBrief(
  system: DesignSystem,
  options: RenderBriefOptions = {}
): string {
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

  const pasteBlock = `### Fonts${fonts.fromBrand ? ' (from the project brand guidelines — use these exact families)' : ''}
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
\`\`\``;

  // Le starter porte déjà tout cela : le brief n'a plus qu'à nommer ce qui est
  // disponible. Recopier la configuration serait payer deux fois — en entrée
  // ici, en sortie dans la réponse — un fichier déjà posé par le code.
  const usageBlock = `### Fonts — already linked in index.html, already set on body and headings
Display "${fonts.display}" → \`font-display\` (headings have it by default), body "${fonts.body}" → \`font-sans\`, mono "${fonts.mono}" → \`font-mono\`.

### Tokens available (already in tailwind.config.js — use these names, never a hex value)
- Colours: \`brand-50\` … \`brand-950\`, \`neutral-50\` … \`neutral-950\`, \`accent\`, \`secondary\`, \`surface\`, \`surface-raised\`, \`ink\`, \`ink-muted\`. As \`bg-\`, \`text-\`, \`border-\`.
- Type: \`text-xs\` … \`text-5xl\` (${scale}).
- Rhythm: \`py-section\` (${direction.spacingBase * 8}px), \`gap-block\` / \`p-block\` (${direction.spacingBase * 3}px), \`gap-tight\` (${direction.spacingBase}px), \`max-w-measure\` (68ch).
- Radius: \`rounded-sm\` ${Math.max(0, Math.round(direction.radius / 2))}px, \`rounded\` ${direction.radius}px, \`rounded-lg\` ${direction.radius * 2}px, \`rounded-xl\` ${direction.radius * 3}px, \`rounded-full\`.
- Layers: \`z-dropdown\`, \`z-sticky\`, \`z-backdrop\`, \`z-modal\`, \`z-toast\`, \`z-tooltip\`.`;

  const tokensBlock = options.scaffolded ? usageBlock : pasteBlock;

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

${tokensBlock}

### Contrast (already verified, keep it that way)
- Body \`text-ink\` on \`bg-surface\`: ${contrast.bodyOnSurface.toFixed(1)}:1
- Secondary \`text-ink-muted\` on \`bg-surface\`: ${contrast.mutedOnSurface.toFixed(1)}:1
Use \`text-ink\` for body copy and \`text-ink-muted\` only for genuinely secondary text. Never a lighter grey than \`ink-muted\`, and never \`text-gray-400/500\` — those are not in this palette.

### Type rules
Scale ratio ${direction.typeRatio}. Hero display: \`clamp(${typeScale['3xl']}, 6vw, ${Math.min(6, parseFloat(typeScale['5xl']) * 1.4).toFixed(2)}rem)\`, tracking no tighter than -0.04em. Body measure capped at 68ch. \`text-wrap: balance\` on h1-h3.

### Font classes — only these three exist
\`font-display\`, \`font-sans\`, \`font-mono\`. A class named after a family (\`font-${fonts.body.toLowerCase().replace(/\s+/g, '-')}\`, \`font-${fonts.display.toLowerCase().replace(/\s+/g, '-')}\`) does not exist: used in a className it silently does nothing, and inside \`@apply\` it stops the whole build with "The \`font-…\` class does not exist".`;
}
