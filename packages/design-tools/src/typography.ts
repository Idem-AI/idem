/**
 * LES PAIRES DE POLICES — quelle police de texte va avec une police de titre (ou l'inverse).
 *
 * Un petit répertoire écrit pour IDEM (Google Fonts, licences OFL), classé par famille de dessin. La règle d'une
 * paire : un contraste de famille (empattements / sans), une hauteur d'x et un esprit proches, jamais deux polices de
 * caractère. Les polices de la MARQUE ne sont jamais remplacées : l'outil complète celle qui manque.
 */
import { z } from 'zod';
import type { DesignTool } from './tool';

export type FontClass = 'geometric-sans' | 'humanist-sans' | 'grotesque' | 'serif' | 'slab' | 'display' | 'mono';

export const FONT_CLASSES: Record<string, FontClass> = {
  Inter: 'grotesque', 'IBM Plex Sans': 'grotesque', 'Work Sans': 'grotesque', 'Space Grotesk': 'grotesque', Manrope: 'grotesque', 'Public Sans': 'grotesque',
  Poppins: 'geometric-sans', Montserrat: 'geometric-sans', 'DM Sans': 'geometric-sans', Outfit: 'geometric-sans', Sora: 'geometric-sans', Urbanist: 'geometric-sans', 'Plus Jakarta Sans': 'geometric-sans', Lexend: 'geometric-sans',
  'Source Sans 3': 'humanist-sans', 'Open Sans': 'humanist-sans', 'Noto Sans': 'humanist-sans', 'Fira Sans': 'humanist-sans', Lato: 'humanist-sans', Nunito: 'humanist-sans', Mulish: 'humanist-sans',
  'Playfair Display': 'serif', 'DM Serif Display': 'serif', Fraunces: 'serif', Lora: 'serif', Merriweather: 'serif', 'Libre Baskerville': 'serif', 'Cormorant Garamond': 'serif', 'Source Serif 4': 'serif', 'EB Garamond': 'serif', 'Newsreader': 'serif',
  'Roboto Slab': 'slab', 'Zilla Slab': 'slab', Arvo: 'slab', 'Bitter': 'slab',
  'Bebas Neue': 'display', Anton: 'display', 'Archivo Black': 'display', 'Syne': 'display', 'Unbounded': 'display', 'Righteous': 'display',
  'JetBrains Mono': 'mono', 'IBM Plex Mono': 'mono', 'Space Mono': 'mono',
};

/** Les paires conseillées : pour une police de titre, des polices de texte (dans l'ordre de préférence). */
const PAIRS: Record<string, string[]> = {
  'Playfair Display': ['Source Sans 3', 'Inter', 'Lato'],
  'DM Serif Display': ['DM Sans', 'Inter', 'Work Sans'],
  Fraunces: ['Inter', 'Manrope', 'Work Sans'],
  'Cormorant Garamond': ['Montserrat', 'Lato', 'Source Sans 3'],
  'Libre Baskerville': ['Source Sans 3', 'Open Sans'],
  Merriweather: ['Open Sans', 'Lato', 'Source Sans 3'],
  Lora: ['Inter', 'Open Sans', 'Nunito'],
  'Bebas Neue': ['Montserrat', 'Inter', 'Lato'],
  Anton: ['Roboto Slab', 'Inter', 'Work Sans'],
  'Archivo Black': ['Inter', 'Work Sans'],
  Syne: ['Inter', 'DM Sans'],
  Unbounded: ['Manrope', 'Inter'],
  'Space Grotesk': ['Inter', 'Source Serif 4', 'IBM Plex Mono'],
  Poppins: ['Lora', 'Open Sans', 'Inter'],
  Montserrat: ['Merriweather', 'Lato', 'Source Sans 3'],
  Sora: ['Inter', 'Newsreader'],
  Outfit: ['Inter', 'Source Serif 4'],
  'Roboto Slab': ['Open Sans', 'Lato'],
  'Zilla Slab': ['Work Sans', 'Inter'],
  Inter: ['Source Serif 4', 'Newsreader', 'Fraunces'],
  Manrope: ['Fraunces', 'Newsreader'],
};

/** La famille de contraste attendue : un titre à empattements appelle un texte sans, et inversement. */
const COMPLEMENT: Record<FontClass, FontClass[]> = {
  serif: ['humanist-sans', 'grotesque', 'geometric-sans'],
  slab: ['humanist-sans', 'grotesque'],
  display: ['grotesque', 'geometric-sans', 'humanist-sans'],
  'geometric-sans': ['serif', 'humanist-sans'],
  grotesque: ['serif', 'mono'],
  'humanist-sans': ['serif', 'slab'],
  mono: ['grotesque', 'serif'],
};

export function classOf(family: string): FontClass | undefined {
  return FONT_CLASSES[family.trim()];
}

/** Les polices de texte proposées pour un titre donné (et la raison). */
export function bodyFor(display: string): { family: string; reason: string }[] {
  const known = PAIRS[display.trim()];
  if (known) return known.map((family) => ({ family, reason: 'paire éprouvée' }));
  const cls = classOf(display);
  if (!cls) return [{ family: 'Inter', reason: 'police inconnue du répertoire : un texte neutre' }];
  const wanted = COMPLEMENT[cls];
  return Object.entries(FONT_CLASSES)
    .filter(([, c]) => wanted.includes(c) && c !== 'display' && c !== 'mono')
    .slice(0, 4)
    .map(([family, c]) => ({ family, reason: `contraste ${cls} / ${c}` }));
}

/** Les polices de titre proposées pour un texte donné. */
export function displayFor(body: string): { family: string; reason: string }[] {
  const direct = Object.entries(PAIRS).filter(([, bodies]) => bodies.includes(body.trim())).map(([family]) => ({ family, reason: 'paire éprouvée' }));
  if (direct.length) return direct.slice(0, 4);
  const cls = classOf(body);
  const wanted = cls ? COMPLEMENT[cls] : ['serif' as FontClass];
  return Object.entries(FONT_CLASSES)
    .filter(([, c]) => wanted.includes(c) || c === 'display')
    .slice(0, 4)
    .map(([family]) => ({ family, reason: 'contraste de famille' }));
}

const pairInput = z.object({ display: z.string().optional(), body: z.string().optional() }).refine((v) => v.display || v.body, 'display ou body');

export const typePairsTool: DesignTool<z.infer<typeof pairInput>, { display: string[]; body: string[] }> = {
  name: 'typePairs',
  description: 'Font pairing: given the brand display font, readable body fonts (or the reverse). Never replaces a brand font.',
  schema: pairInput as unknown as z.ZodType<z.infer<typeof pairInput>>,
  run: async ({ display, body }) => ({
    display: display ? [display] : body ? displayFor(body).map((p) => p.family) : [],
    body: body ? [body] : display ? bodyFor(display).map((p) => p.family) : [],
  }),
};
