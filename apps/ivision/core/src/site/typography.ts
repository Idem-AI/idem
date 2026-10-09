/**
 * Les polices d'un site, devenues une typographie de marque — et trois propositions.
 *
 * Une police relevée sur un site n'est pas toujours disponible pour nos rendus : une police
 * commerciale ou auto-hébergée ne se charge pas depuis Google Fonts. On la garde si elle y est ;
 * sinon on propose la plus proche de sa catégorie (serif, sans, géométrique, affichage, mono),
 * et on le dit. Les accords viennent d'un catalogue écrit à la main, pas d'un modèle.
 */
import { buildGoogleFontsHref } from '../design/google-fonts';

export type FontCategory = 'serif' | 'sans' | 'geometric' | 'display' | 'mono' | 'handwriting';

/** Familles Google Fonts connues, par catégorie (les plus utilisées, toutes à graisses variables). */
export const GOOGLE_FONTS: Record<FontCategory, string[]> = {
  serif: ['Fraunces', 'Playfair Display', 'DM Serif Display', 'Lora', 'Libre Baskerville', 'Merriweather', 'Cormorant Garamond', 'EB Garamond', 'Source Serif 4', 'Crimson Pro'],
  sans: ['Inter', 'Manrope', 'IBM Plex Sans', 'Source Sans 3', 'Work Sans', 'Nunito Sans', 'Open Sans', 'Roboto', 'Lato', 'Noto Sans', 'Public Sans', 'Karla', 'Mulish', 'Figtree', 'Instrument Sans'],
  geometric: ['Poppins', 'Montserrat', 'Outfit', 'Plus Jakarta Sans', 'Urbanist', 'Space Grotesk', 'Sora', 'Lexend', 'Raleway', 'Archivo', 'DM Sans', 'Red Hat Display', 'Syne'],
  display: ['Bebas Neue', 'Anton', 'Archivo Black', 'Oswald', 'Unbounded', 'Righteous', 'Abril Fatface', 'Bricolage Grotesque'],
  mono: ['JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'DM Mono'],
  handwriting: ['Caveat', 'Kalam', 'Dancing Script', 'Pacifico', 'Shadows Into Light'],
};

const ALL_GOOGLE = new Map(Object.values(GOOGLE_FONTS).flat().map((f) => [f.toLowerCase(), f]));

/** Accords éprouvés : titre → texte courant. */
const PAIRINGS: Record<FontCategory, [string, string][]> = {
  serif: [['Fraunces', 'Inter'], ['Playfair Display', 'Source Sans 3'], ['DM Serif Display', 'DM Sans'], ['Cormorant Garamond', 'Manrope']],
  sans: [['Manrope', 'Inter'], ['Instrument Sans', 'Inter'], ['Work Sans', 'Source Serif 4'], ['IBM Plex Sans', 'IBM Plex Sans']],
  geometric: [['Poppins', 'Inter'], ['Space Grotesk', 'Inter'], ['Outfit', 'Manrope'], ['Sora', 'Inter'], ['Plus Jakarta Sans', 'Figtree']],
  display: [['Bebas Neue', 'Work Sans'], ['Anton', 'Inter'], ['Archivo Black', 'Archivo'], ['Unbounded', 'Manrope']],
  mono: [['Space Grotesk', 'JetBrains Mono'], ['IBM Plex Sans', 'IBM Plex Mono']],
  handwriting: [['Caveat', 'Nunito Sans'], ['Kalam', 'Karla']],
};

export interface SeenFont {
  family: string;
  /** Où elle est vue : titres, texte courant, boutons. */
  usage: 'heading' | 'body' | 'button';
  weight: number;
  /** Surface de texte (px²) qu'elle couvre. */
  area: number;
}

export interface TypographyProposal {
  id: 'site' | 'pairing' | 'alternative';
  label: string;
  rationale: string;
  display: string;
  body: string;
  displayCss: string;
  bodyCss: string;
}

/** Le nom de famille propre (« "Helvetica Neue", Arial, sans-serif » → « Helvetica Neue »). */
export function firstFamily(stack: string): string {
  return (stack || '').split(',')[0].replace(/["']/g, '').trim();
}

export function categoryOf(family: string, stack = ''): FontCategory {
  const f = `${family} ${stack}`.toLowerCase();
  for (const [cat, list] of Object.entries(GOOGLE_FONTS) as [FontCategory, string[]][]) if (list.some((x) => x.toLowerCase() === family.toLowerCase())) return cat;
  if (/mono|code|courier|consol/.test(f)) return 'mono';
  if (/script|hand|brush|marker|caveat|cursive/.test(f)) return 'handwriting';
  if (/display|black|condensed|compressed|impact|bebas|anton|oswald|poster|heavy/.test(f)) return 'display';
  if (/serif/.test(f) && !/sans-serif|sans serif/.test(f)) return 'serif';
  if (/garamond|times|georgia|baskerville|didot|bodoni|caslon|playfair|merriweather|lora|tiempos|canela|freight|minion|tobias|recoleta/.test(f)) return 'serif';
  if (/futura|avenir|circular|gilroy|geomanist|poppins|montserrat|gotham|proxima|sofia|cera|euclid|brandon|graphik|neue machina|aeonik|satoshi|general sans/.test(f)) return 'geometric';
  return 'sans';
}

/** La famille Google la plus proche : elle-même si elle existe, sinon la première de sa catégorie. */
export function googleEquivalent(family: string, stack = ''): { family: string; exact: boolean } {
  const exact = ALL_GOOGLE.get(family.toLowerCase());
  if (exact) return { family: exact, exact: true };
  return { family: GOOGLE_FONTS[categoryOf(family, stack)][0], exact: false };
}

const css = (family: string) => buildGoogleFontsHref([family]);

/** Les polices du site (titres, texte), et trois propositions. */
export function typographyProposals(seen: SeenFont[], stacks: Record<string, string> = {}): { site: { display: string; body: string; exactDisplay: boolean; exactBody: boolean; original: { display?: string; body?: string } }; proposals: TypographyProposal[] } {
  const score = (usage: SeenFont['usage']) => {
    const by = new Map<string, number>();
    for (const f of seen) if (f.usage === usage && f.family) by.set(f.family, (by.get(f.family) || 0) + f.area + (usage === 'heading' ? f.weight * 10 : 0));
    return [...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const headingRaw = score('heading') || score('button') || score('body') || 'Inter';
  const bodyRaw = score('body') || headingRaw;
  const display = googleEquivalent(headingRaw, stacks[headingRaw]);
  const body = googleEquivalent(bodyRaw, stacks[bodyRaw]);
  const cat = categoryOf(display.family, stacks[headingRaw]);
  const pairs = PAIRINGS[cat].filter(([d, b]) => !(d === display.family && b === body.family));
  const pairing = pairs.find(([d]) => d === display.family) || [display.family, pairs[0]?.[1] || 'Inter'];
  const alternative = pairs.find(([d]) => d !== display.family) || PAIRINGS.sans[0];
  const siteNote = display.exact && body.exact ? 'Les polices de votre site, disponibles telles quelles.' : `Les polices de votre site${display.exact ? '' : ` (« ${headingRaw} » n’est pas libre : remplacée par ${display.family}, de la même famille)`}${body.exact ? '' : `${display.exact ? ' (' : ', '}« ${bodyRaw} » remplacée par ${body.family}${display.exact ? ')' : ''}`}.`;
  const proposal = (id: TypographyProposal['id'], label: string, rationale: string, d: string, b: string): TypographyProposal => ({ id, label, rationale, display: d, body: b, displayCss: css(d), bodyCss: css(b) });
  return {
    site: { display: display.family, body: body.family, exactDisplay: display.exact, exactBody: body.exact, original: { display: headingRaw, body: bodyRaw } },
    proposals: [
      proposal('site', 'Votre site', siteNote, display.family, body.family),
      proposal('pairing', 'Accord éprouvé', `Votre police de titre, avec un texte courant pensé pour elle.`, pairing[0], pairing[1]),
      proposal('alternative', 'Variante', `Une autre voix de la même famille (${cat === 'sans' ? 'linéale' : cat === 'serif' ? 'à empattements' : cat === 'geometric' ? 'géométrique' : cat === 'display' ? 'd’affiche' : cat}).`, alternative[0], alternative[1]),
    ],
  };
}
