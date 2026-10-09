/**
 * LES LOGOS COMPOSÉS PAR LE CODE — le cran Low de la jauge de créativité pour l'identité visuelle.
 *
 * Aucun appel au modèle : trois propositions tirées d'une bibliothèque de marques et de
 * wordmarks dessinés ici, adaptées à la marque (palette, police de titre vectorisée, initiales)
 * et à sa direction artistique (rayon des angles, affinités de formes). Les propositions passent
 * ensuite par les mêmes étapes que les logos dessinés par l'IA : lockup composé sur les vraies
 * métriques de la police (`lockup/logoLockup.service.ts`), contrôle `svgGate`, déclinaisons.
 *
 *   type « icon »     une marque (abstraite ou monogramme) + le nom, posé par le lockup
 *   type « name »     le nom seul, vectorisé, avec un accent (point, filet, barre, capitales espacées)
 *   type « initial »  le monogramme seul
 */
import logger from '../../config/logger';
import type { LogoLockupSpec, LogoModel, LogoType } from '../../models/logo.model';
import { resolveStyle } from '../design/artDirection.catalog';
import { contrastRatio } from '../design/color';
import { inspectSvg } from '../design/svgGate';
import { fontLoader } from './lockup/fontLoader.service';
import { logoLockupService } from './lockup/logoLockup.service';
import { round } from './lockup/svgGeometry.util';
import { buildWordmarkGeometry, estimateWordmarkWidth } from './lockup/wordmark.util';

export interface TemplateLogoInput {
  brandName: string;
  type: LogoType;
  palette: { primary?: string; secondary?: string; accent?: string; text?: string; background?: string };
  typography: { family: string; cssUrl?: string };
  styleId?: string | null;
  /** Graine stable (projet) : deux projets n'obtiennent pas les trois mêmes propositions. */
  seed: string;
  count?: number;
}

/** Les deux encres d'une marque : lisibles sur fond clair, distinctes l'une de l'autre. */
interface MarkInk {
  ink: string;
  alt: string;
  /** Rayon des angles, en unités du carré 100 × 100 (0 : le style refuse l'arrondi). */
  r: number;
  initials: string;
}

interface MarkDef {
  label: string;
  concept: string;
  /** Monogramme : la marque porte les initiales. */
  letters?: boolean;
  /** Styles de direction artistique où la forme est à sa place (tirée en premier). */
  affinity: string[];
  draw: (m: MarkInk) => string;
}

const TEXT_ATTRS = (size: number, fill: string) =>
  `x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="700" letter-spacing="-0.02em" fill="${fill}"`;
const monoSize = (initials: string, base: number) => (initials.length > 1 ? base * 0.78 : base);

export const LOGO_MARKS: Record<string, MarkDef> = {
  monoCircle: {
    label: 'Monogramme cerclé',
    concept: 'Les initiales de la marque, réservées en blanc dans un disque plein : un sceau simple, lisible jusqu’à la taille d’une favicon.',
    letters: true,
    affinity: ['editorial', 'minimalism', 'victorian', 'retro'],
    draw: (m) => `<circle cx="50" cy="50" r="48" fill="${m.ink}"/><text ${TEXT_ATTRS(monoSize(m.initials, 50), '#FFFFFF')}>${m.initials}</text>`,
  },
  monoSquare: {
    label: 'Monogramme en tuile',
    concept: 'Les initiales posées dans une tuile aux angles de la direction artistique : un bloc compact qui tient sur une application comme sur un tampon.',
    letters: true,
    affinity: ['swiss', 'futuristic', 'vector-art', 'clay', 'glassmorphism'],
    draw: (m) => `<rect x="2" y="2" width="96" height="96" rx="${m.r}" fill="${m.ink}"/><text ${TEXT_ATTRS(monoSize(m.initials, 50), '#FFFFFF')}>${m.initials}</text>`,
  },
  monoRing: {
    label: 'Monogramme à l’anneau',
    concept: 'Les initiales à l’encre de la marque dans un anneau fin, ponctué d’un point d’accent : une signature légère, élégante sur papier.',
    letters: true,
    affinity: ['minimalism', 'editorial', 'bohemian', 'handwritten'],
    draw: (m) =>
      `<circle cx="50" cy="50" r="44" fill="none" stroke="${m.ink}" stroke-width="5"/><circle cx="81" cy="19" r="8" fill="${m.alt}"/><text ${TEXT_ATTRS(monoSize(m.initials, 44), m.ink)}>${m.initials}</text>`,
  },
  initialBar: {
    label: 'Initiales soulignées',
    concept: 'Les initiales en grand, soulignées d’un filet à la couleur d’accent : le geste de l’éditeur qui signe sa page.',
    letters: true,
    affinity: ['swiss', 'editorial', 'pop-art', 'graffiti'],
    draw: (m) =>
      `<text x="50" y="44" text-anchor="middle" dominant-baseline="central" font-size="${monoSize(m.initials, 66)}" font-weight="700" letter-spacing="-0.03em" fill="${m.ink}">${m.initials}</text><rect x="20" y="84" width="60" height="9" rx="${Math.min(4.5, m.r)}" fill="${m.alt}"/>`,
  },
  orbit: {
    label: 'Orbite',
    concept: 'Un anneau tenu par un point d’accent en mouvement : la marque qui fait graviter son public autour d’une promesse.',
    affinity: ['futuristic', 'aurora', 'minimalism', 'cyberpunk'],
    draw: (m) => `<circle cx="46" cy="54" r="34" fill="none" stroke="${m.ink}" stroke-width="10"/><circle cx="78" cy="22" r="13" fill="${m.alt}"/>`,
  },
  stackedBars: {
    label: 'Barres étagées',
    concept: 'Trois barres qui décroissent : une progression lisible d’un coup d’œil, une marque qui avance par étapes.',
    affinity: ['swiss', 'minimalism', 'futuristic', 'editorial'],
    draw: (m) => {
      const r = Math.min(7, m.r);
      return `<rect x="8" y="18" width="84" height="16" rx="${r}" fill="${m.ink}"/><rect x="8" y="42" width="62" height="16" rx="${r}" fill="${m.alt}"/><rect x="8" y="66" width="40" height="16" rx="${r}" fill="${m.ink}"/>`;
    },
  },
  bloom: {
    label: 'Éclosion',
    concept: 'Quatre quarts de cercle qui s’ouvrent autour d’un centre commun : une forme accueillante, qui pousse vers l’extérieur.',
    affinity: ['bohemian', 'clay', 'handwritten', 'maximalism', 'aurora'],
    draw: (m) =>
      [
        `<path d="M47 47 L47 5 A42 42 0 0 0 5 47 Z" fill="${m.ink}"/>`,
        `<path d="M53 47 L95 47 A42 42 0 0 0 53 5 Z" fill="${m.alt}"/>`,
        `<path d="M53 53 L53 95 A42 42 0 0 0 95 53 Z" fill="${m.ink}"/>`,
        `<path d="M47 53 L5 53 A42 42 0 0 0 47 95 Z" fill="${m.alt}"/>`,
      ].join(''),
  },
  chevrons: {
    label: 'Double élan',
    concept: 'Deux chevrons qui montent l’un derrière l’autre : la croissance, dite avec la forme la plus directe qui soit.',
    affinity: ['pop-art', 'graffiti', 'retro', 'maximalism', 'y2k'],
    draw: (m) =>
      `<path d="M14 58 L50 24 L86 58" fill="none" stroke="${m.ink}" stroke-width="13" stroke-linecap="${m.r ? 'round' : 'square'}" stroke-linejoin="${m.r ? 'round' : 'miter'}"/><path d="M14 86 L50 52 L86 86" fill="none" stroke="${m.alt}" stroke-width="13" stroke-linecap="${m.r ? 'round' : 'square'}" stroke-linejoin="${m.r ? 'round' : 'miter'}"/>`,
  },
  foldedTile: {
    label: 'Tuile pliée',
    concept: 'Une tuile coupée en diagonale, deux couleurs de la charte de part et d’autre du pli : la rencontre de deux savoir-faire.',
    affinity: ['swiss', 'vector-art', 'futuristic', 'glassmorphism'],
    draw: (m) => {
      const r = Math.min(20, m.r);
      return r
        ? `<path d="M${6 + r} 6 H94 L6 94 V${6 + r} A${r} ${r} 0 0 1 ${6 + r} 6 Z" fill="${m.ink}"/><path d="M94 6 V${94 - r} A${r} ${r} 0 0 1 ${94 - r} 94 H6 Z" fill="${m.alt}"/>`
        : `<path d="M6 6 H94 L6 94 Z" fill="${m.ink}"/><path d="M94 6 V94 H6 Z" fill="${m.alt}"/>`;
    },
  },
  sunrise: {
    label: 'Lever',
    concept: 'Un demi-disque posé sur deux lignes d’horizon : le début de journée, l’énergie de ce qui commence.',
    affinity: ['retro', 'bohemian', 'clay', 'aurora', 'handwritten'],
    draw: (m) => {
      const r = Math.min(4, m.r);
      return `<path d="M12 66 A38 38 0 0 1 88 66 Z" fill="${m.ink}"/><rect x="12" y="74" width="76" height="8" rx="${r}" fill="${m.alt}"/><rect x="26" y="88" width="48" height="8" rx="${r}" fill="${m.alt}"/>`;
    },
  },
  weave: {
    label: 'Tissage',
    concept: 'Une trame de neuf carrés alternés, comme les bandes d’un tissage : une marque faite de liens, solide parce qu’entrecroisée.',
    affinity: ['maximalism', 'pop-art', 'collage-art', 'vector-art', 'pixel-art'],
    draw: (m) => {
      const cells: string[] = [];
      const r = Math.min(6, m.r);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push(`<rect x="${6 + j * 31}" y="${6 + i * 31}" width="26" height="26" rx="${r}" fill="${(i + j) % 2 ? m.alt : m.ink}"/>`);
      return cells.join('');
    },
  },
  leaves: {
    label: 'Deux feuilles',
    concept: 'Deux feuilles issues d’une même tige, chacune à une couleur de la charte : une croissance naturelle, à deux voix.',
    affinity: ['bohemian', 'handwritten', 'clay', 'editorial', 'victorian'],
    draw: (m) =>
      `<path d="M50 10 C70 32 70 62 50 88 C30 62 30 32 50 10 Z" fill="${m.ink}" transform="rotate(-24 50 88)"/><path d="M50 10 C70 32 70 62 50 88 C30 62 30 32 50 10 Z" fill="${m.alt}" transform="rotate(24 50 88)"/>`,
  },
  diamond: {
    label: 'Losange serti',
    concept: 'Un losange plein serti dans un contour : la valeur mise en avant, précise et précieuse.',
    affinity: ['victorian', 'editorial', 'futuristic', 'cyberpunk', 'y2k'],
    draw: (m) => `<path d="M50 4 L96 50 L50 96 L4 50 Z" fill="none" stroke="${m.ink}" stroke-width="7" stroke-linejoin="${m.r ? 'round' : 'miter'}"/><path d="M50 28 L72 50 L50 72 L28 50 Z" fill="${m.alt}"/>`,
  },
};

export const LOGO_WORDMARKS = {
  plain: { label: 'Logotype', concept: 'Le nom de la marque dans sa police de titre, sans ornement : la typographie porte seule l’identité.', caps: false, tracking: -0.01, weight: 700 },
  dot: { label: 'Logotype ponctué', concept: 'Le nom suivi d’un point à la couleur d’accent : une affirmation, nette comme une fin de phrase.', caps: false, tracking: -0.015, weight: 700 },
  underline: { label: 'Logotype souligné', concept: 'Le nom souligné d’un filet d’accent sur sa première moitié : une signature éditoriale, posée.', caps: false, tracking: 0, weight: 700 },
  bar: { label: 'Logotype à la barre', concept: 'Une barre verticale à la couleur d’accent ouvre le nom : la marque comme un titre de rubrique.', caps: false, tracking: 0, weight: 700 },
  spaced: { label: 'Capitales espacées', concept: 'Le nom en capitales largement espacées : une présence calme et haut de gamme.', caps: true, tracking: 0.18, weight: 600 },
} as const;
export type WordmarkStyle = keyof typeof LOGO_WORDMARKS;

const LETTER_MARKS = Object.keys(LOGO_MARKS).filter((id) => LOGO_MARKS[id].letters);

/** Initiales de la marque (deux lettres au plus pour un monogramme). */
export function brandInitials(brandName: string): string {
  const words = (brandName || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'B';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Les deux encres de la marque, lisibles sur blanc (≥ 3:1 pour la principale). */
export function markInks(palette: TemplateLogoInput['palette']): { ink: string; alt: string } {
  const hex = (v?: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : undefined);
  const candidates = [hex(palette.primary), hex(palette.secondary), hex(palette.accent), hex(palette.text)].filter(Boolean) as string[];
  const ink = candidates.find((c) => contrastRatio(c, '#FFFFFF') >= 3) || '#111827';
  const alt =
    [hex(palette.accent), hex(palette.secondary), hex(palette.primary)].find(
      (c) => c && c.toLowerCase() !== ink.toLowerCase() && contrastRatio(c, '#FFFFFF') >= 1.6 && contrastRatio(c, ink) >= 1.25
    ) || ink;
  return { ink, alt };
}

/** Le menu des formes pour ce type et ce style, celles qui lui ressemblent d'abord, ordre propre au projet. */
export function logoMenu(type: LogoType, styleId: string | null | undefined, seed: string): string[] {
  if (type === 'name') {
    const ids = Object.keys(LOGO_WORDMARKS);
    const start = hash(seed) % ids.length;
    return [...ids.slice(start), ...ids.slice(0, start)];
  }
  const pool = type === 'initial' ? LETTER_MARKS : Object.keys(LOGO_MARKS);
  const style = styleId || 'editorial';
  const score = (id: string) => (LOGO_MARKS[id].affinity.includes(style) ? 0 : 1) + (hash(`${seed}:${id}`) % 1000) / 1000;
  return [...pool].sort((a, b) => score(a) - score(b));
}

/** Rayon des angles des marques : celui du style, ramené au carré 100 × 100. */
const cornerRadius = (styleId?: string | null) => {
  const radius = resolveStyle(styleId).radius ?? 8;
  return radius <= 0 ? 0 : radius <= 4 ? 8 : 18;
};

const svgOf = (inner: string, w = 100, h = 100) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(w)} ${round(h)}">${inner}</svg>`;

/** Le nom seul, vectorisé dans la police de titre, avec son accent. */
async function composeWordmark(input: TemplateLogoInput, style: WordmarkStyle, inks: { ink: string; alt: string }): Promise<string> {
  const def = LOGO_WORDMARKS[style];
  const text = def.caps ? input.brandName.toUpperCase() : input.brandName;
  const cap = 48;
  const loaded = await fontLoader.load(input.typography.family, def.weight, input.typography.cssUrl);
  const geometry = loaded ? buildWordmarkGeometry(text, loaded, { capHeight: cap, letterSpacingEm: def.tracking }) : null;
  const fontSize = geometry?.fontSize ?? cap / 0.7;
  const width = geometry?.inkWidth ?? estimateWordmarkWidth(text, fontSize, def.tracking);
  const ascent = geometry?.ascent ?? cap;
  const descent = geometry?.descent ?? fontSize * 0.21;
  const lead = style === 'bar' ? cap * 0.62 : 0;
  const pad = 4;
  const baseline = pad + ascent;
  const word = geometry
    ? `<g id="wordmark" transform="translate(${round(pad + lead + geometry.inkOffsetX)} ${round(baseline)})"><path d="${geometry.pathData}" fill="${inks.ink}"/></g>`
    : `<text id="wordmark" x="${round(pad + lead)}" y="${round(baseline)}" font-family="'${input.typography.family}', sans-serif" font-size="${round(fontSize)}" font-weight="${def.weight}" letter-spacing="${def.tracking}em" fill="${inks.ink}">${escapeXml(text)}</text>`;
  let accent = '';
  let extraW = 0;
  let extraH = 0;
  if (style === 'dot') {
    const r = cap * 0.15;
    accent = `<circle cx="${round(pad + width + cap * 0.12 + r)}" cy="${round(baseline - r)}" r="${round(r)}" fill="${inks.alt}"/>`;
    extraW = cap * 0.12 + 2 * r;
  } else if (style === 'underline') {
    const y = baseline + Math.max(descent, cap * 0.12) + cap * 0.16;
    accent = `<rect x="${pad}" y="${round(y)}" width="${round(width * 0.42)}" height="${round(cap * 0.12)}" rx="${round(cap * 0.06)}" fill="${inks.alt}"/>`;
    extraH = y + cap * 0.12 - (baseline + descent);
  } else if (style === 'bar') {
    accent = `<rect x="${pad}" y="${round(baseline - cap)}" width="${round(cap * 0.18)}" height="${round(cap)}" fill="${inks.alt}"/>`;
  }
  return svgOf(word + accent, pad * 2 + lead + width + extraW, pad * 2 + ascent + descent + Math.max(0, extraH));
}

/** La marque seule (icône), initiales vectorisées dans la police de titre. */
async function composeMark(id: string, input: TemplateLogoInput, inks: { ink: string; alt: string }): Promise<string | null> {
  const def = LOGO_MARKS[id];
  if (!def) return null;
  const raw = svgOf(def.draw({ ...inks, r: cornerRadius(input.styleId), initials: escapeXml(brandInitials(input.brandName)) }));
  if (!def.letters) return raw;
  const outlined = await logoLockupService.outlineSvgText(raw, input.typography.family, 700, input.typography.cssUrl);
  // Police introuvable : un monogramme en texte vivant se rendrait dans une autre police.
  return /<text\b/i.test(outlined) ? null : outlined;
}

/**
 * Trois propositions (ou `count`) composées par le code. Chaque proposition est contrôlée par
 * `svgGate` ; une forme qui ne passe pas (police introuvable pour un monogramme) cède la
 * place à la suivante du menu.
 */
export async function composeTemplateLogos(input: TemplateLogoInput): Promise<LogoModel[]> {
  const count = input.count ?? 3;
  const inks = markInks(input.palette);
  const paletteHexes = Object.values(input.palette).filter((v): v is string => typeof v === 'string');
  const menu = logoMenu(input.type, input.styleId, input.seed);
  const logos: LogoModel[] = [];
  for (const id of menu) {
    if (logos.length >= count) break;
    try {
      const index = logos.length;
      const base = { id: `concept${String(index + 1).padStart(2, '0')}`, type: input.type, fonts: [input.typography.family] };
      if (input.type === 'name') {
        const style = id as WordmarkStyle;
        const svg = await composeWordmark(input, style, inks);
        // Police introuvable : le nom reste en texte (mode dégradé du lockup), seul défaut toléré.
        const report = inspectSvg(svg, { palette: paletteHexes });
        if (!report.ok && !report.defects.every((d) => d.code === 'live_text')) continue;
        logos.push({ ...base, name: LOGO_WORDMARKS[style].label, concept: LOGO_WORDMARKS[style].concept, colors: [...new Set([inks.ink, inks.alt])], svg });
        continue;
      }
      const mark = await composeMark(id, input, inks);
      if (!mark || !inspectSvg(mark, { palette: paletteHexes }).ok) continue;
      const def = LOGO_MARKS[id];
      if (input.type === 'initial') {
        logos.push({ ...base, name: def.label, concept: def.concept, colors: [...new Set([inks.ink, inks.alt])], svg: mark, iconSvg: mark });
        continue;
      }
      const spec: LogoLockupSpec = {
        brandName: input.brandName,
        fontFamily: input.typography.family,
        fontCssUrl: input.typography.cssUrl,
        fontWeight: 700,
        letterSpacing: 0,
        wordmarkColor: inks.ink,
        arrangement: index === 1 ? 'stacked' : 'horizontal',
      };
      const composed = await logoLockupService.compose(mark, spec);
      if (!composed) continue;
      logos.push({ ...base, name: def.label, concept: def.concept, colors: [...new Set([inks.ink, inks.alt])], svg: composed.svg, iconSvg: composed.iconSvg, lockup: composed.spec });
    } catch (error: any) {
      logger.warn(`[LogoTemplates] forme « ${id} » écartée`, { error: error?.message });
    }
  }
  return logos;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
