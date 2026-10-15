/**
 * Les illustrations des sites, composées par le code.
 *
 * Avant, le modèle de texte dessinait une scène entière en formes SVG. Un
 * petit modèle ne sait pas dessiner : le résultat était abstrait, souvent
 * illisible, jamais professionnel.
 *
 * Ici, le modèle ne dessine plus. Il choisit QUOI montrer — une icône
 * principale et trois icônes d'appui, dans le jeu lucide (dessiné par des
 * professionnels, cohérent, net à toutes les tailles). Le code les met en
 * scène dans une composition soignée et constante : formes de fond aux teintes
 * de la charte, cartes blanches à ombre douce, trame, liaisons. Le rendu ne
 * dépend plus du talent du modèle.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { lucideIcons, resolveIcon } from '../autocorrect.js';

export type SpotLayout = 'halo' | 'panel' | 'flow';

export interface SpotRequest {
  /** Icône principale puis icônes d'appui (noms lucide, corrigés si besoin). */
  icons: string[];
  /** Couleur de marque, accent, secondaire (hexadécimal). */
  palette: string[];
  /** Fond clair du panneau. */
  ground: string;
  aspect: '16:9' | '4:3' | '1:1' | '3:4';
  layout: SpotLayout;
  /** Graine de variation (identifiant de l'emplacement). */
  seed: string;
}

const VIEWBOX: Record<SpotRequest['aspect'], [number, number]> = {
  '16:9': [640, 360],
  '4:3': [480, 360],
  '1:1': [400, 400],
  '3:4': [360, 480],
};

/* -------------------------------------------------------------------------- */
/*  Tracés lucide                                                              */
/* -------------------------------------------------------------------------- */

type IconNode = Array<[string, Record<string, string>]>;

let fileByName: Map<string, string> | null = null;
const nodeCache = new Map<string, IconNode | null>();

function esmDir(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('lucide-react/dist/lucide-react.d.ts')), 'esm');
}

/** Nom exporté (alias compris) → fichier du tracé. */
function iconFiles(): Map<string, string> {
  if (fileByName) return fileByName;
  fileByName = new Map();
  try {
    const index = readFileSync(join(esmDir(), 'lucide-react.js'), 'utf8');
    for (const match of Array.from(index.matchAll(/export \{([^}]+)\} from '\.\/icons\/([\w-]+)\.js';/g))) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()!.trim();
        if (name) fileByName.set(name, match[2]);
      }
    }
  } catch {
    // Sans le paquet, aucune icône : la composition tombe sur ses formes seules.
  }
  return fileByName;
}

/** Les éléments SVG d'une icône lucide (grille 24 × 24, trait). */
export function iconNode(name: string): IconNode | null {
  if (nodeCache.has(name)) return nodeCache.get(name)!;
  let node: IconNode | null = null;
  const file = iconFiles().get(name);
  if (file) {
    try {
      const source = readFileSync(join(esmDir(), 'icons', `${file}.js`), 'utf8');
      const array = source.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*\])\s*\);/)?.[1];
      if (array) node = JSON.parse(array.replace(/(\w+):\s/g, '"$1": ')) as IconNode;
    } catch {
      node = null;
    }
  }
  nodeCache.set(name, node);
  return node;
}

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Une icône dessinée à une position et une taille données. */
function icon(name: string, cx: number, cy: number, size: number, color: string, weight = 1.75): string {
  const node = iconNode(name) ?? iconNode('Sparkles');
  if (!node) return '';
  const scale = size / 24;
  const children = node
    .map(([tag, attrs]) => {
      const rest = Object.entries(attrs)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${key}="${escapeAttr(String(value))}"`)
        .join(' ');
      return `<${tag} ${rest}/>`;
    })
    .join('');
  return `<g transform="translate(${round(cx - size / 2)} ${round(cy - size / 2)}) scale(${round(scale, 3)})" fill="none" stroke="${color}" stroke-width="${round(weight / Math.max(scale / 2.2, 1), 3)}" stroke-linecap="round" stroke-linejoin="round">${children}</g>`;
}

/* -------------------------------------------------------------------------- */
/*  Primitives de composition                                                  */
/* -------------------------------------------------------------------------- */

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

/** Une graine stable tirée d'un texte : la même section donne la même image. */
function random(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const SHADOW = '#0f172a';

/** Une carte blanche à ombre douce (deux couches décalées, sans filtre). */
function card(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `<rect x="${round(x)}" y="${round(y + 10)}" width="${round(w)}" height="${round(h)}" rx="${r}" fill="${SHADOW}" fill-opacity="0.05"/>`,
    `<rect x="${round(x)}" y="${round(y + 4)}" width="${round(w)}" height="${round(h)}" rx="${r}" fill="${SHADOW}" fill-opacity="0.06"/>`,
    `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${r}" fill="#ffffff"/>`,
  ].join('');
}

/** Une ligne de texte simulée. */
const bar = (x: number, y: number, w: number, color: string, opacity: number, h = 8) =>
  `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${h}" rx="${h / 2}" fill="${color}" fill-opacity="${opacity}"/>`;

/** Une trame de points, discrète, dans un rectangle. */
function dots(x: number, y: number, cols: number, rows: number, gap: number, color: string): string {
  const out: string[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) out.push(`<circle cx="${round(x + i * gap)}" cy="${round(y + j * gap)}" r="1.8"/>`);
  }
  return `<g fill="${color}" fill-opacity="0.28">${out.join('')}</g>`;
}

/** Une forme de fond organique (courbe fermée lissée autour d'un centre). */
function blob(cx: number, cy: number, radius: number, color: string, opacity: number, rand: () => number): string {
  const points = 7;
  const coords = Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    const r = radius * (0.82 + rand() * 0.3);
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  });
  // Courbe de Catmull-Rom convertie en Béziers : un contour doux et fermé.
  let d = `M${round(coords[0][0])} ${round(coords[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = coords[(i - 1 + points) % points];
    const p1 = coords[i];
    const p2 = coords[(i + 1) % points];
    const p3 = coords[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `<path d="${d} Z" fill="${color}" fill-opacity="${opacity}"/>`;
}

/** Une pastille : carte blanche carrée avec une icône. */
function tile(cx: number, cy: number, size: number, name: string, color: string, tint: string): string {
  const half = size / 2;
  return [
    card(cx - half, cy - half, size, size, Math.round(size * 0.26)),
    `<rect x="${round(cx - half * 0.62)}" y="${round(cy - half * 0.62)}" width="${round(size * 0.62)}" height="${round(size * 0.62)}" rx="${round(size * 0.18)}" fill="${tint}" fill-opacity="0.12"/>`,
    icon(name, cx, cy, size * 0.42, color),
  ].join('');
}

/* -------------------------------------------------------------------------- */
/*  Compositions                                                               */
/* -------------------------------------------------------------------------- */

interface Scene {
  w: number;
  h: number;
  primary: string;
  accent: string;
  secondary: string;
  ground: string;
  main: string;
  support: string[];
  rand: () => number;
}

/** Halo : le pictogramme principal au centre d'un disque, trois pastilles en orbite. */
function halo(s: Scene): string {
  const cx = s.w / 2;
  const cy = s.h / 2 + 4;
  const disc = Math.min(s.w, s.h) * 0.25;
  const orbit = disc * 1.62;
  const angles = [-150, -28, 95].map((deg) => ((deg + (s.rand() - 0.5) * 18) * Math.PI) / 180);
  const colors = [s.primary, s.accent, s.primary];
  return [
    blob(cx - disc * 0.9, cy - disc * 0.4, disc * 1.5, s.primary, 0.08, s.rand),
    blob(cx + disc * 1.1, cy + disc * 0.5, disc * 1.1, s.accent, 0.1, s.rand),
    dots(cx + disc * 1.25, cy - disc * 1.55, 6, 4, 14, s.primary),
    dots(cx - disc * 2.1, cy + disc * 0.9, 5, 3, 14, s.accent),
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(orbit)}" fill="none" stroke="${s.primary}" stroke-opacity="0.22" stroke-width="1.5" stroke-dasharray="3 7" stroke-linecap="round"/>`,
    `<circle cx="${round(cx)}" cy="${round(cy + 8)}" r="${round(disc)}" fill="${SHADOW}" fill-opacity="0.08"/>`,
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(disc)}" fill="${s.primary}"/>`,
    `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(disc * 0.78)}" fill="#ffffff" fill-opacity="0.1"/>`,
    icon(s.main, cx, cy, disc * 0.95, '#ffffff', 1.6),
    ...s.support.slice(0, 3).map((name, index) => {
      // Les pastilles restent dans le cadre, ombre comprise.
      const size = disc * 0.62;
      const margin = size / 2 + 14;
      const x = Math.min(s.w - margin, Math.max(margin, cx + Math.cos(angles[index]) * orbit));
      const y = Math.min(s.h - margin - 10, Math.max(margin, cy + Math.sin(angles[index]) * orbit));
      return tile(x, y, size, name, colors[index], colors[index]);
    }),
  ].join('');
}

/** Vignette : une carte d'interface (en-tête, lignes, pastilles) et un badge flottant. */
function panel(s: Scene): string {
  const w = Math.min(s.w * 0.62, 340);
  const h = Math.min(s.h * 0.7, 250);
  const x = (s.w - w) / 2 - s.w * 0.04;
  const y = (s.h - h) / 2;
  const pad = 22;
  const rows = s.support.slice(0, 3).map((name, index) => {
    const ry = y + 78 + index * ((h - 96) / 3);
    const color = index === 1 ? s.accent : s.primary;
    return [
      `<circle cx="${round(x + pad + 16)}" cy="${round(ry + 14)}" r="16" fill="${color}" fill-opacity="0.12"/>`,
      icon(name, x + pad + 16, ry + 14, 17, color),
      bar(x + pad + 44, ry + 5, w * (0.42 + s.rand() * 0.2), SHADOW, 0.14),
      bar(x + pad + 44, ry + 18, w * (0.24 + s.rand() * 0.16), SHADOW, 0.08, 6),
    ].join('');
  });
  const bx = x + w - 18;
  const by = y + h - 30;
  return [
    blob(s.w * 0.3, s.h * 0.42, s.h * 0.42, s.primary, 0.08, s.rand),
    blob(s.w * 0.74, s.h * 0.66, s.h * 0.3, s.accent, 0.1, s.rand),
    dots(x + w + 26, y + 6, 5, 5, 14, s.primary),
    card(x, y, w, h, 18),
    `<rect x="${round(x + pad)}" y="${round(y + pad)}" width="36" height="36" rx="10" fill="${s.primary}"/>`,
    icon(s.main, x + pad + 18, y + pad + 18, 20, '#ffffff', 2),
    bar(x + pad + 50, y + pad + 6, w * 0.38, SHADOW, 0.2),
    bar(x + pad + 50, y + pad + 22, w * 0.22, SHADOW, 0.1, 6),
    `<line x1="${round(x + pad)}" y1="${round(y + 70)}" x2="${round(x + w - pad)}" y2="${round(y + 70)}" stroke="${SHADOW}" stroke-opacity="0.07" stroke-width="1.5"/>`,
    ...rows,
    `<circle cx="${round(bx)}" cy="${round(by + 6)}" r="34" fill="${SHADOW}" fill-opacity="0.1"/>`,
    `<circle cx="${round(bx)}" cy="${round(by)}" r="34" fill="${s.accent}"/>`,
    icon(s.support[3] ?? 'Check', bx, by, 30, '#ffffff', 2),
  ].join('');
}

/** Parcours : trois étapes en pastilles, reliées par une courbe pointillée, la principale au centre. */
function flow(s: Scene): string {
  const cy = s.h / 2;
  const size = Math.min(s.w / 5.2, s.h * 0.34);
  const xs = [s.w * 0.2, s.w * 0.5, s.w * 0.8];
  const ys = [cy + size * 0.35, cy - size * 0.3, cy + size * 0.35];
  const path = `M${round(xs[0])} ${round(ys[0])} C${round(xs[0] + size)} ${round(ys[0] - size * 1.1)} ${round(xs[1] - size)} ${round(ys[1] - size * 0.2)} ${round(xs[1])} ${round(ys[1])} S${round(xs[2] - size)} ${round(ys[2] + size * 0.9)} ${round(xs[2])} ${round(ys[2])}`;
  const names = [s.support[0] ?? 'Sparkles', s.main, s.support[1] ?? 'Check'];
  return [
    blob(s.w * 0.5, cy, s.h * 0.46, s.primary, 0.07, s.rand),
    dots(s.w * 0.06, s.h * 0.1, 6, 3, 14, s.accent),
    dots(s.w * 0.78, s.h * 0.78, 6, 3, 14, s.primary),
    `<path d="${path}" fill="none" stroke="${s.primary}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>`,
    ...names.map((name, index) => {
      const big = index === 1;
      const tileSize = big ? size * 1.18 : size;
      if (!big) return tile(xs[index], ys[index], tileSize, name, index === 0 ? s.primary : s.accent, index === 0 ? s.primary : s.accent);
      return [
        `<circle cx="${round(xs[1])}" cy="${round(ys[1] + 8)}" r="${round(tileSize / 2)}" fill="${SHADOW}" fill-opacity="0.09"/>`,
        `<circle cx="${round(xs[1])}" cy="${round(ys[1])}" r="${round(tileSize / 2)}" fill="${s.primary}"/>`,
        icon(name, xs[1], ys[1], tileSize * 0.46, '#ffffff', 1.8),
      ].join('');
    }),
    ...[0, 1, 2].map((index) => {
      const nx = xs[index] + (index === 1 ? size * 0.5 : size * 0.42);
      const ny = ys[index] - (index === 1 ? size * 0.55 : size * 0.42);
      return `<circle cx="${round(nx)}" cy="${round(ny)}" r="12" fill="#ffffff" stroke="${s.primary}" stroke-opacity="0.25"/><text x="${round(nx)}" y="${round(ny + 4)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="${s.primary}">${index + 1}</text>`;
    }),
  ].join('');
}

const LAYOUTS: Record<SpotLayout, (scene: Scene) => string> = { halo, panel, flow };

/** Les icônes demandées, corrigées, distinctes, au nombre de quatre. */
export function pickIcons(requested: string[], subject: string): string[] {
  const icons = lucideIcons();
  const chosen: string[] = [];
  const push = (name: string) => {
    if (name && icons.has(name) && !chosen.includes(name)) chosen.push(name);
  };
  for (const name of requested) push(resolveIcon(String(name).replace(/[^\w-]/g, '')));
  for (const word of subject.split(/[^\p{L}]+/u).filter((item) => item.length > 3)) {
    const icon = resolveIcon(word);
    if (icon !== 'Sparkles') push(icon);
  }
  for (const fallback of ['Sparkles', 'Star', 'CircleCheck', 'Heart', 'Leaf']) push(fallback);
  return chosen.slice(0, 4);
}

/** L'illustration composée, en SVG autonome. */
export function composeSpot(request: SpotRequest): string {
  const [w, h] = VIEWBOX[request.aspect];
  const [primary, accent = primary, secondary = accent] = request.palette;
  const [main, ...support] = request.icons.length ? request.icons : ['Sparkles'];
  const scene: Scene = { w, h, primary, accent, secondary, ground: request.ground, main, support, rand: random(request.seed) };
  const body = LAYOUTS[request.layout](scene);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img"><rect width="${w}" height="${h}" fill="${request.ground}"/>${body}</svg>`;
}
