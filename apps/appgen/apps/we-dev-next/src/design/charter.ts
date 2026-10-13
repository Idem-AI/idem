/**
 * La charte du projet, lue comme TOUS les livrables IDEM la lisent.
 *
 * La charte graphique, les business plans, les decks et les visuels tirent
 * leur identité de trois champs — `branding.colors`, `branding.typography`,
 * `branding.logo` — et de la direction artistique (`branding.artDirection`).
 * Les lecteurs canoniques vivent dans `apps/ivision/core/src/brand/brand-kit.ts`
 * et dans le moteur `@idem/graphic-engine` (`brandFromIdem`, `buildTokens`).
 *
 * Le serveur appgen se construit seul en production (son Dockerfile ne copie
 * pas les paquets partagés) : il ne peut pas importer ces modules à
 * l'exécution. Ce fichier en est donc le MIROIR, champ pour champ, avec le même
 * ordre de priorité. Si les lecteurs canoniques changent, celui-ci doit suivre.
 *
 * Ce qui était faux avant lui, et que le site trahissait :
 * - les polices étaient chargées par leur NOM depuis Google Fonts, alors que la
 *   charte stocke la feuille réelle (`cssUrl`) — une police Fontshare,
 *   Fontsource ou importée ne se chargeait jamais ;
 * - la direction artistique était tirée au sort dans un catalogue propre au
 *   site, en ignorant celle de la charte (`styleId`) ;
 * - la rampe de couleur était recalculée à luminosité fixe : la couleur
 *   primaire de la marque n'apparaissait nulle part sur le site.
 */

import { contrastRatio, hexToOklch, oklchToHex } from './color.js';

export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'background' | 'text';
const PALETTE_ROLES: PaletteRole[] = ['primary', 'secondary', 'accent', 'background', 'text'];

/** `#ABC`, `#aabbcc`, `aabbcc` → `#aabbcc` ; toute autre forme → ''. (brand-kit.normalizeHex) */
export function normalizeHex(value: unknown): string {
  if (typeof value !== 'string') return '';
  let hex = value.trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(hex)) hex = hex.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{8}$/.test(hex)) hex = hex.slice(0, 6);
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : '';
}

/** Palette déclarée par la charte, normalisée ; les rôles illisibles sont omis. (brand-kit.readPalette) */
export function readPalette(branding: any): Partial<Record<PaletteRole, string>> {
  const source = branding?.colors?.colors;
  const palette: Partial<Record<PaletteRole, string>> = {};
  for (const role of PALETTE_ROLES) {
    const hex = normalizeHex(source?.[role]);
    if (hex) palette[role] = hex;
  }
  return palette;
}

export interface CharterFonts {
  display: string;
  body: string;
  displayCss?: string;
  bodyCss?: string;
  sheetUrl?: string;
}

/**
 * Les deux familles de la charte, avec leur feuille de style RÉELLE.
 * (brand-kit.readFonts — la famille déclarée sur `primary`/`secondary` passe
 * avant le nom historique `primaryFont`/`secondaryFont`.)
 */
export function readFonts(branding: any): CharterFonts {
  const typography = branding?.typography;
  const display = String(typography?.primary?.family || typography?.primaryFont || '').trim();
  const body = String(typography?.secondary?.family || typography?.secondaryFont || '').trim();
  const sheet = String(typography?.url || '').trim();
  const css = (value: unknown) => {
    const url = typeof value === 'string' ? value.trim() : '';
    return /^https?:\/\//.test(url) ? url : undefined;
  };
  return {
    display,
    body,
    displayCss: css(typography?.primary?.cssUrl),
    bodyCss: css(typography?.secondary?.cssUrl),
    sheetUrl: /^https?:\/\//.test(sheet) ? sheet : undefined,
  };
}

/**
 * Le logo à poser sur une page claire, avec les replis de la charte.
 * (brand-kit.resolveLogoSlot sur `assetUrls.withText.lightBackground`)
 *
 * Les `assetUrls` sont des PNG prêts à l'emploi ; `svg` et `variations` sont
 * des URL de SVG — ou, pour les projets anciens, du SVG en ligne.
 */
const LIGHT_HEADER_SLOTS = [
  'assetUrls.withText.lightBackground',
  'variations.withText.lightBackground',
  'assetUrls.primary',
  'svg',
];

const ICON_SLOTS = [
  'assetUrls.iconOnly.lightBackground',
  'variations.iconOnly.lightBackground',
  'assetUrls.icon',
  'iconSvg',
  'assetUrls.primary',
  'svg',
];

const readPath = (source: unknown, path: string): string => {
  const value = path
    .split('.')
    .reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), source);
  return typeof value === 'string' ? value.trim() : '';
};

export function resolveHeaderLogo(logo: unknown): string {
  for (const slot of LIGHT_HEADER_SLOTS) {
    const value = readPath(logo, slot);
    if (value) return value;
  }
  return '';
}

export function resolveIconLogo(logo: unknown): string {
  for (const slot of ICON_SLOTS) {
    const value = readPath(logo, slot);
    if (value) return value;
  }
  return '';
}

/**
 * Les styles de direction artistique, tels que le moteur graphique les définit.
 * (MIROIR des champs structurels de `packages/graphic-engine/src/design-system/tokens/styles.data.ts`)
 *
 * `radius` est en px, `typeRatio` la raison de l'échelle typographique,
 * `density` la densité retenue en premier par le moteur.
 */
export interface CharterStyle {
  id: string;
  name: string;
  radius: number;
  typeRatio: number;
  density: 'airy' | 'balanced' | 'dense';
}

export const CHARTER_STYLES: Record<string, CharterStyle> = {
  minimalism: { id: 'minimalism', name: 'Minimalism', radius: 0, typeRatio: 1.5, density: 'airy' },
  maximalism: { id: 'maximalism', name: 'Maximalism', radius: 8, typeRatio: 1.618, density: 'balanced' },
  futuristic: { id: 'futuristic', name: 'Futuristic', radius: 4, typeRatio: 1.414, density: 'airy' },
  'vector-art': { id: 'vector-art', name: 'Vector Art', radius: 16, typeRatio: 1.333, density: 'airy' },
  'collage-art': { id: 'collage-art', name: 'Collage', radius: 0, typeRatio: 1.5, density: 'balanced' },
  retro: { id: 'retro', name: 'Retro', radius: 24, typeRatio: 1.414, density: 'airy' },
  cyberpunk: { id: 'cyberpunk', name: 'Cyberpunk', radius: 2, typeRatio: 1.5, density: 'airy' },
  'pop-art': { id: 'pop-art', name: 'Pop Art', radius: 0, typeRatio: 1.618, density: 'airy' },
  glassmorphism: { id: 'glassmorphism', name: 'Glassmorphism', radius: 24, typeRatio: 1.333, density: 'airy' },
  clay: { id: 'clay', name: 'Clay 3D', radius: 32, typeRatio: 1.333, density: 'airy' },
  'pixel-art': { id: 'pixel-art', name: 'Pixel Art', radius: 0, typeRatio: 1.25, density: 'airy' },
  editorial: { id: 'editorial', name: 'Editorial', radius: 0, typeRatio: 1.5, density: 'balanced' },
  y2k: { id: 'y2k', name: 'Y2K', radius: 28, typeRatio: 1.414, density: 'airy' },
  swiss: { id: 'swiss', name: 'Swiss Design', radius: 0, typeRatio: 1.25, density: 'balanced' },
  surreal: { id: 'surreal', name: 'Surrealism', radius: 0, typeRatio: 1.618, density: 'airy' },
  bohemian: { id: 'bohemian', name: 'Bohemian', radius: 40, typeRatio: 1.414, density: 'balanced' },
  victorian: { id: 'victorian', name: 'Victorian', radius: 4, typeRatio: 1.5, density: 'balanced' },
  graffiti: { id: 'graffiti', name: 'Graffiti', radius: 0, typeRatio: 1.618, density: 'airy' },
  aurora: { id: 'aurora', name: 'Aurora', radius: 20, typeRatio: 1.414, density: 'airy' },
  handwritten: { id: 'handwritten', name: 'Handwritten', radius: 12, typeRatio: 1.414, density: 'balanced' },
};

export function resolveCharterStyle(styleId: unknown): CharterStyle | null {
  const key = typeof styleId === 'string' ? styleId.trim() : '';
  return CHARTER_STYLES[key] ?? null;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Rampe ANCRÉE sur la couleur de la marque : `600` est exactement la primaire.
 *
 * C'est le cran que portent les boutons, les appels à l'action, l'offre mise en
 * avant. Recalculer la rampe à luminosité fixe — ce que faisait la forge —
 * donnait des boutons d'une couleur voisine, jamais celle de la charte.
 * Les crans clairs montent vers le blanc, les foncés descendent vers le noir,
 * en partant de la luminosité réelle de la primaire.
 */
export function buildAnchoredRamp(primary: string): Record<string, string> {
  const base = hexToOklch(primary);
  if (!base) return {};

  const ramp: Record<string, string> = {};

  // Interpolation de luminosité depuis la primaire, chroma qui faiblit vers les
  // extrêmes pour rester dans le gamut.
  const toward = (target: number, share: number, chromaKeep: number) =>
    oklchToHex({
      l: clamp01(base.l + (target - base.l) * share),
      c: Math.max(0, base.c * chromaKeep),
      h: base.h,
    });

  ramp['50'] = toward(0.985, 0.94, 0.14);
  ramp['100'] = toward(0.985, 0.86, 0.24);
  ramp['200'] = toward(0.985, 0.72, 0.42);
  ramp['300'] = toward(0.985, 0.55, 0.62);
  ramp['400'] = toward(0.985, 0.36, 0.82);
  ramp['500'] = toward(0.985, 0.16, 0.95);
  ramp['600'] = normalizeHex(primary);
  ramp['700'] = toward(0.12, 0.18, 0.96);
  ramp['800'] = toward(0.12, 0.36, 0.88);
  ramp['900'] = toward(0.12, 0.54, 0.74);
  ramp['950'] = toward(0.12, 0.72, 0.6);

  return ramp;
}

/** L'encre lisible sur une couleur : blanc ou presque-noir, le plus contrasté. */
export function readableOn(background: string, dark = '#111111'): string {
  return contrastRatio('#ffffff', background) >= contrastRatio(dark, background) ? '#ffffff' : dark;
}

/** Une surface est-elle claire ? (politique IDEM : les sites restent clairs) */
export function isLightSurface(hex: string): boolean {
  const o = hexToOklch(hex);
  return Boolean(o && o.l >= 0.6);
}

/**
 * Les adresses à essayer pour DÉPOSER le logo dans le projet, SVG d'abord.
 *
 * Un SVG s'écrit comme un fichier texte, reste net à toute taille et pèse peu ;
 * les `assetUrls` sont des PNG, embarqués seulement à défaut. Le SVG en ligne
 * des projets anciens n'est pas une adresse : il est écarté ici.
 */
export function embeddableLogoUrls(logo: unknown): string[] {
  const order = [
    'variations.withText.lightBackground',
    'svg',
    'assetUrls.withText.lightBackground',
    'assetUrls.primary',
  ];
  const urls: string[] = [];
  for (const slot of order) {
    const value = readPath(logo, slot);
    if (value && /^https?:\/\//.test(value) && !urls.includes(value)) urls.push(value);
  }
  return urls;
}
