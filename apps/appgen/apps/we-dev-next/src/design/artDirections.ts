/**
 * Art directions: the anti-monoculture mechanism.
 *
 * Left to itself a model returns the average of its training data, which is why
 * every generated site converges on the same purple gradient, the same Inter,
 * the same three-card grid. The fix is not to ask for "something original" —
 * that request has no anchor. It is to hand the model a *different set of
 * constraints per project*, drawn deterministically from a project seed.
 *
 * Each direction is mutually exclusive with the others on at least three axes
 * (surface, radius personality, layout cadence), so two projects cannot land on
 * the same page even when their briefs are similar.
 */

export type Register = 'marketing' | 'product';

export interface ArtDirection {
  id: string;
  name: string;
  /** Registers this direction is allowed to serve. */
  registers: Register[];
  surface: 'light' | 'dark';
  /** How much of the surface the brand colour is allowed to own. */
  colorStrategy: 'restrained' | 'committed' | 'full-palette' | 'drenched';
  /** Tailwind `borderRadius.DEFAULT` in px. */
  radius: number;
  /** Base spacing rhythm in px; drives section padding and stack gaps. */
  spacingBase: number;
  /** Type scale ratio between steps. Never below 1.25 (flat scales read as unfinished). */
  typeRatio: number;
  borders: string;
  shadows: string;
  /** How sections follow one another down the page. */
  cadence: string;
  /** The one move that makes this direction recognisable. */
  signature: string;
  /** Direction-specific traps, on top of the global bans in the anti-slop skill. */
  avoid: string;
}

export const ART_DIRECTIONS: ArtDirection[] = [
  {
    id: 'editorial-serif',
    name: 'Editorial typographic',
    registers: ['marketing'],
    surface: 'light',
    colorStrategy: 'restrained',
    radius: 2,
    spacingBase: 8,
    typeRatio: 1.333,
    borders: 'Hairline 1px rules in neutral-200 as section separators. No card borders.',
    shadows: 'None. Depth comes from type scale and whitespace, not elevation.',
    cadence:
      'Asymmetric two-column: a wide text column paired with a narrow marginal column holding captions, figures or pull quotes. Alternate which side is narrow between sections.',
    signature:
      'A single oversized serif display line, set at a large measure with -0.02em tracking, carrying each section instead of a heading + subheading pair.',
    avoid:
      'Cards of any kind. Centred hero text. Equal-width columns. Icons next to headings.',
  },
  {
    id: 'swiss-grid',
    name: 'Swiss grid',
    registers: ['marketing', 'product'],
    surface: 'light',
    colorStrategy: 'restrained',
    radius: 0,
    spacingBase: 8,
    typeRatio: 1.25,
    borders: '1px solid neutral-900 grid lines, visible and structural.',
    shadows: 'None. Ever.',
    cadence:
      'A visible 12-column grid. Content snaps to it and deliberately spans uneven counts (7 + 5, 4 + 8) so the rhythm is felt. Full-bleed horizontal rules between sections.',
    signature:
      'Flush-left everything, one signal colour used only for the single most important element on each screen, and generous top padding that pushes content down the page.',
    avoid:
      'Centred layouts. Rounded corners. Gradients. More than one accent colour.',
  },
  {
    id: 'terminal-dark',
    name: 'Terminal native',
    registers: ['product'],
    surface: 'dark',
    colorStrategy: 'restrained',
    radius: 4,
    spacingBase: 6,
    typeRatio: 1.25,
    borders: '1px solid at 8% white opacity. Borders do the separating, not shadows.',
    shadows: 'Only on floating layers (menus, dialogs), and tinted with the brand hue.',
    cadence:
      'Dense information rows over a near-black surface. Fixed side rail, content region with its own scroll, sticky table headers. Vertical space is expensive.',
    signature:
      'Monospace for every number, id, timestamp and status token, with tabular-nums so columns align. Status carried by a small solid dot plus a word, never by colour alone.',
    avoid:
      'Hero sections. Large illustrations. Airy padding. Decorative gradients on cards.',
  },
  {
    id: 'earth-committed',
    name: 'Committed earth',
    registers: ['marketing'],
    surface: 'light',
    colorStrategy: 'committed',
    radius: 16,
    spacingBase: 10,
    typeRatio: 1.414,
    borders: 'None. Surfaces are separated by colour blocks, not lines.',
    shadows: 'Large, soft, tinted with the brand hue at low opacity. Never pure black.',
    cadence:
      'Alternating full-bleed colour bands: a saturated brand band, then a quiet band, then an image band that runs edge to edge. No section sits on the same background as the one before it.',
    signature:
      'A saturated earth surface (terracotta, clay, deep ochre) owning 40 to 60 percent of the page, with type set in a light tint of that same hue rather than white.',
    avoid:
      'Cream, sand, beige or parchment backgrounds. Those are the saturated AI default. Warmth is carried by the saturated band, not by a tinted near-white.',
  },
  {
    id: 'brutalist-block',
    name: 'Brutalist block',
    registers: ['marketing'],
    surface: 'light',
    colorStrategy: 'full-palette',
    radius: 0,
    spacingBase: 8,
    typeRatio: 1.5,
    borders: '2px solid neutral-900 on all four sides. Full borders only, never a single edge.',
    shadows: 'Hard offset shadow, 4px 4px 0 with no blur, in neutral-900.',
    cadence:
      'Flat colour blocks butted directly against each other with no gutter. Section widths vary deliberately: one full-bleed, one inset, one offset past the container edge.',
    signature:
      'Display type large enough to be clipped by its container on purpose, with three named palette roles each used at full saturation.',
    avoid:
      'Soft shadows. Any rounding. Muted tints. Symmetrical three-across layouts.',
  },
  {
    id: 'drenched-mono',
    name: 'Drenched monochrome',
    registers: ['marketing'],
    surface: 'dark',
    colorStrategy: 'drenched',
    radius: 8,
    spacingBase: 12,
    typeRatio: 1.414,
    borders: 'None. Separation comes from lightness steps within the single hue.',
    shadows: 'None. Depth is lightness, not elevation.',
    cadence:
      'One hue for the entire page, sections distinguished only by moving up or down its lightness ramp. Long vertical rhythm, one idea per viewport.',
    signature:
      'Imagery duotoned into the brand hue so photographs belong to the surface instead of sitting on it.',
    avoid:
      'A second accent hue. White cards on the coloured surface. Grey text (use a lighter step of the hue itself).',
  },
  {
    id: 'precision-product',
    name: 'Precision product',
    registers: ['product'],
    surface: 'light',
    colorStrategy: 'restrained',
    radius: 6,
    spacingBase: 4,
    typeRatio: 1.25,
    borders: '1px solid neutral-200. The accent appears on focus rings and the primary action only.',
    shadows: 'One level, very subtle, for popovers and dropdowns. Nothing else is elevated.',
    cadence:
      'Content-first: page header with a single primary action, then the working surface. Filters and secondary controls live in a toolbar, not scattered.',
    signature:
      'Tight 4px spacing rhythm, tabular numbers, and empty states that state what is missing and offer the action that fixes it.',
    avoid:
      'Marketing language. Decorative illustration. Nested cards. An accent used on more than 10 percent of the surface.',
  },
  {
    id: 'layered-depth',
    name: 'Layered depth',
    registers: ['marketing', 'product'],
    surface: 'light',
    colorStrategy: 'committed',
    radius: 12,
    spacingBase: 8,
    typeRatio: 1.333,
    borders: '1px solid at 6% of the brand hue, on raised surfaces only.',
    shadows:
      'Two-step elevation with shadows tinted toward the brand hue. Offset downward, never symmetric glows.',
    cadence:
      'Sections overlap: a raised surface pulls up over the boundary of the section above it with a negative margin, so the page reads as stacked planes rather than stacked bands.',
    signature:
      'A base surface in a mid-tone brand tint with raised panels stepping lighter, so elevation is legible without heavy shadows.',
    avoid:
      'Glassmorphism. Uniform card grids where every panel sits at the same elevation. Symmetric glow shadows.',
  },
];

/**
 * Font pairings on a real contrast axis (serif + sans, or geometric + humanist).
 * Inter is deliberately absent: it is the default that makes generated sites
 * recognisable at a glance. All families are on Google Fonts.
 */
export interface FontPairing {
  display: string;
  body: string;
  /** Google Fonts weight query for the display family. */
  displayWeights: string;
  bodyWeights: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  { display: 'Fraunces', body: 'Public Sans', displayWeights: '400;700', bodyWeights: '400;500;700' },
  { display: 'Instrument Serif', body: 'Geist', displayWeights: '400', bodyWeights: '400;500;600' },
  { display: 'Space Grotesk', body: 'IBM Plex Sans', displayWeights: '500;700', bodyWeights: '400;500;600' },
  { display: 'Bricolage Grotesque', body: 'Work Sans', displayWeights: '600;800', bodyWeights: '400;500;600' },
  { display: 'DM Serif Display', body: 'DM Sans', displayWeights: '400', bodyWeights: '400;500;700' },
  { display: 'Archivo Black', body: 'Karla', displayWeights: '400', bodyWeights: '400;500;700' },
  { display: 'Playfair Display', body: 'Source Sans 3', displayWeights: '500;700', bodyWeights: '400;600' },
  { display: 'Chivo', body: 'Lora', displayWeights: '700;900', bodyWeights: '400;500;600' },
  { display: 'Outfit', body: 'Newsreader', displayWeights: '500;700', bodyWeights: '400;500' },
  { display: 'Libre Baskerville', body: 'Manrope', displayWeights: '400;700', bodyWeights: '400;500;700' },
];

export const MONO_FAMILY = 'JetBrains Mono';
