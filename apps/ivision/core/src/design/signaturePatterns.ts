/**
 * LES MOTIFS SIGNATURE D'UNE MARQUE — tirés de SON logo et de SON projet, pas d'un répertoire commun.
 *
 * Avant, les motifs venaient de sept géométries (rayures, grille, points…) choisies par le style : deux
 * projets du même style avaient exactement les mêmes. Ici, chaque marque reçoit quatre tuiles SVG qui
 * n'appartiennent qu'à elle :
 *
 *   principal  le SYMBOLE du logo répété selon une trame propre au projet (carrée, décalée, en quinconce,
 *              en losange), à une échelle et avec des rotations tirées par la graine du projet ;
 *   secondaire une tuile DESSINÉE par l'IA d'après le projet et la forme du logo (validée par le code) ;
 *              à défaut, une géométrie générée qui suit le langage du logo (courbes ou angles) ;
 *   trame fine le symbole en semis minuscule — une texture qui se devine ;
 *   inversé    le CONTOUR du symbole, en grand, sur l'aplat de la marque.
 *
 * Toutes les tuiles sont RÉPÉTABLES par construction (chaque élément est redessiné décalé d'une tuile sur
 * les bords) et ne contiennent que des formes vectorielles nettoyées : ni script, ni image, ni texte.
 */
import type { BrandPatternKind, BrandPatternPlan } from './brandPatterns';
import { brandPatternSvg } from './brandPatterns';

export type SignatureSource = 'logo' | 'ai' | 'geometry';

export interface SignaturePattern extends BrandPatternPlan {
  svg: string;
  source: SignatureSource;
}

export interface SignaturePatternInput {
  /** La graine : l'identité du projet et de son logo (même projet, mêmes motifs ; autre projet, autres motifs). */
  seed: string;
  /** Le symbole du logo (SVG en ligne), s'il existe. */
  iconSvg?: string | null;
  colors: { primary: string; accent: string; surface: string; subtle: string };
  /** La tuile dessinée par l'IA (contenu SVG nettoyé par `sanitizeAuthoredTile`, cadre 100 × 100). */
  authoredTile?: string | null;
  /** Le répertoire géométrique du style : dernier recours. */
  repertoire: BrandPatternKind[];
}

// ─── Hasard semé ────────────────────────────────────────────────────────────

function rngOf(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rnd: () => number, list: readonly T[]): T => list[Math.floor(rnd() * list.length) % list.length];
const r2 = (v: number) => Math.round(v * 100) / 100;

// ─── Le symbole du logo, nettoyé ────────────────────────────────────────────

/** Le jeton d'une couleur claire du logo : remplacé par le fond du motif (mode plein) ou l'encre (contour). */
const GROUND_TOKEN = '#00ff01';

/** Une couleur claire (blanc, crème, gris très pâle) : une découpe du symbole, pas de l'encre. */
function isLight(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === 'white' || v === '#fff' || v === '#ffffff') return true;
  const m = v.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/);
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.82;
}

/** Le contenu vectoriel d'un SVG et sa boîte, nettoyés (aucun script, image, texte, lien) et recolorés en `currentColor`. */
export function iconSymbol(svg: string | null | undefined): { inner: string; viewBox: [number, number, number, number]; rounded: boolean } | null {
  if (!svg || !/<svg[\s>]/i.test(svg)) return null;
  const open = svg.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const vb = open.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().split(/[\s,]+/).map(Number);
  const w = Number(open.match(/\swidth\s*=\s*["']([\d.]+)/i)?.[1]);
  const h = Number(open.match(/\sheight\s*=\s*["']([\d.]+)/i)?.[1]);
  const viewBox: [number, number, number, number] | null = vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0 ? [vb[0], vb[1], vb[2], vb[3]] : w > 0 && h > 0 ? [0, 0, w, h] : null;
  if (!viewBox) return null;
  let inner = svg.slice(svg.indexOf(open) + open.length, svg.lastIndexOf('</svg>'));
  inner = inner
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|foreignObject|image|text|title|desc|metadata)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(image|use)\b[^>]*\/>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(class|id|clip-path|mask|filter)\s*=\s*("[^"]*"|'[^']*')/gi, '')
    // Les couleurs deviennent celles du motif : les CLAIRES (le trait blanc d'un grain de café, une découpe)
    // prennent le fond, les autres l'encre ; « none » reste « none » (un contour reste un contour).
    .replace(/\s(fill|stroke)\s*=\s*(["'])(?!none)([^"']*)\2/gi, (_m, prop: string, _q: string, value: string) => ` ${prop}="${isLight(value) ? GROUND_TOKEN : 'currentColor'}"`)
    .replace(/(fill|stroke)\s*:\s*(?!none)([^;"']+)/gi, (_m, prop: string, value: string) => `${prop}:${isLight(value) ? GROUND_TOKEN : 'currentColor'}`)
    .replace(/<defs>\s*<\/defs>/g, '')
    .trim();
  if (!/<(path|circle|ellipse|rect|polygon|polyline|line)\b/i.test(inner) || inner.length > 60_000) return null;
  // Le langage du logo : des courbes (arcs, cercles) ou des angles (droites).
  const curves = (inner.match(/[aAcCqQsS]/g) ?? []).length + (inner.match(/<(circle|ellipse)\b/gi) ?? []).length * 8;
  const lines = (inner.match(/[lLhHvV]/g) ?? []).length + (inner.match(/<(rect|polygon|polyline|line)\b/gi) ?? []).length * 4;
  return { inner, viewBox, rounded: curves >= lines };
}

// ─── Construction d'une tuile répétable ─────────────────────────────────────

interface Placed {
  x: number;
  y: number;
  size: number;
  rotate: number;
}

/** Une tuile : le symbole posé à chaque place, redessiné décalé d'une tuile pour que la répétition soit parfaite. */
function tileWithSymbol(t: number, ground: string, ink: string, symbol: NonNullable<ReturnType<typeof iconSymbol>>, places: Placed[], mode: 'fill' | 'outline', stroke = 1.2): string {
  const [vx, vy, vw, vh] = symbol.viewBox;
  const paint = mode === 'fill' ? `fill="${ink}" color="${ink}"` : `fill="none" stroke="${ink}" color="${ink}" stroke-width="${r2((stroke * Math.max(vw, vh)) / 40)}"`;
  const uses: string[] = [];
  for (const p of places) {
    for (const dx of [-t, 0, t]) {
      for (const dy of [-t, 0, t]) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x + p.size / 2 < 0 || x - p.size / 2 > t || y + p.size / 2 < 0 || y - p.size / 2 > t) continue;
        uses.push(`<use href="#m" x="${r2(x - p.size / 2)}" y="${r2(y - p.size / 2)}" width="${r2(p.size)}" height="${r2(p.size)}"${p.rotate ? ` transform="rotate(${p.rotate} ${r2(x)} ${r2(y)})"` : ''}/>`);
      }
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}">`,
    `<defs><symbol id="m" viewBox="${vx} ${vy} ${vw} ${vh}" overflow="visible"><g ${paint}>${mode === 'outline' ? symbol.inner.replace(/fill="currentColor"/g, 'fill="none" stroke="currentColor"').replace(new RegExp(GROUND_TOKEN, 'g'), 'currentColor') : symbol.inner.replace(new RegExp(GROUND_TOKEN, 'g'), ground)}</g></symbol></defs>`,
    `<rect width="${t}" height="${t}" fill="${ground}"/>`,
    ...uses,
    '</svg>',
  ].join('');
}

/** Les places d'une trame dans une tuile, selon le tracé tiré par la graine. */
function lattice(kind: 'square' | 'halfdrop' | 'brick' | 'diamond', t: number, size: number, rotations: number[], rnd: () => number): Placed[] {
  const rot = (i: number) => rotations[i % rotations.length];
  switch (kind) {
    case 'square':
      return [{ x: t / 2, y: t / 2, size, rotate: rot(0) }];
    case 'halfdrop':
      return [
        { x: t / 4, y: t / 4, size, rotate: rot(0) },
        { x: (3 * t) / 4, y: (3 * t) / 4, size, rotate: rot(1) },
      ];
    case 'brick':
      return [
        { x: t / 4, y: t / 4, size, rotate: rot(0) },
        { x: (3 * t) / 4, y: t / 4, size, rotate: rot(1) },
        { x: 0, y: (3 * t) / 4, size, rotate: rot(2) },
        { x: t / 2, y: (3 * t) / 4, size, rotate: rot(3) },
      ];
    case 'diamond':
    default:
      return [
        { x: 0, y: 0, size, rotate: rot(0) },
        { x: t / 2, y: t / 2, size, rotate: rot(1) + (rnd() < 0.5 ? 0 : 45) },
      ];
  }
}

// ─── La géométrie générée (sans logo, ou en second motif) ───────────────────

/** Une tuile géométrique qui suit le langage du logo — courbes ou angles — et dont chaque paramètre vient de la graine. */
function generatedGeometry(t: number, ground: string, ink: string, rounded: boolean, rnd: () => number): string {
  const shapes: string[] = [];
  const copies = (draw: (ox: number, oy: number) => string) => {
    for (const ox of [-t, 0, t]) for (const oy of [-t, 0, t]) shapes.push(draw(ox, oy));
  };
  if (rounded) {
    const rings = 2 + Math.floor(rnd() * 3);
    const step = (t / 2) / (rings + 1);
    const corner = rnd() < 0.5;
    const sw = r2(step * (0.25 + rnd() * 0.3));
    copies((ox, oy) =>
      Array.from({ length: rings }, (_, i) => {
        const r = step * (i + 1);
        return corner
          ? `<circle cx="${ox}" cy="${oy}" r="${r2(r)}" fill="none" stroke="${ink}" stroke-width="${sw}"/><circle cx="${r2(ox + t / 2)}" cy="${r2(oy + t / 2)}" r="${r2(r)}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`
          : `<circle cx="${r2(ox + t / 2)}" cy="${r2(oy + t / 2)}" r="${r2(r)}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`;
      }).join('')
    );
    const dots = Math.floor(rnd() * 3);
    if (dots) copies((ox, oy) => `<circle cx="${ox}" cy="${r2(oy + t / 2)}" r="${r2(step * 0.4)}" fill="${ink}"/>`);
  } else {
    // Des zigzags qui traversent toute la tuile (donc continus d'une tuile à l'autre) et un accent triangulaire.
    const teeth = 2 + 2 * Math.floor(rnd() * 2);
    const depth = r2(t * (0.1 + rnd() * 0.12));
    const sw = r2(t * (0.03 + rnd() * 0.035));
    const rows = 1 + Math.floor(rnd() * 2);
    const vertical = rnd() < 0.35;
    const accentOn = rnd() < 0.6;
    copies((ox, oy) => {
      const w = t / teeth;
      const lines = Array.from({ length: rows }, (_, r) => {
        const base = (t * (r + 0.5)) / rows - depth / 2;
        const pts = Array.from({ length: teeth + 1 }, (_, i) => (vertical ? `${r2(ox + base + (i % 2 ? depth : 0))},${r2(oy + i * w)}` : `${r2(ox + i * w)},${r2(oy + base + (i % 2 ? depth : 0))}`)).join(' ');
        return `<polyline points="${pts}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
      }).join('');
      const s = t * 0.09;
      const cx = ox + (vertical ? t * 0.75 : t / teeth / 2);
      const cy = oy + (vertical ? t / teeth / 2 : t * (rows > 1 ? 0.5 : 0.82));
      const tri = accentOn ? `<polygon points="${r2(cx)},${r2(cy - s)} ${r2(cx + s)},${r2(cy + s)} ${r2(cx - s)},${r2(cy + s)}" fill="${ink}"/>` : '';
      return lines + tri;
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}"><rect width="${t}" height="${t}" fill="${ground}"/>${shapes.join('')}</svg>`;
}

/** La tuile de l'IA (cadre 100 × 100), mise à l'échelle et rendue répétable. */
function authoredTileSvg(content: string, t: number, ground: string, ink: string): string {
  const copies: string[] = [];
  for (const ox of [-100, 0, 100]) for (const oy of [-100, 0, 100]) copies.push(`<g transform="translate(${ox} ${oy})">${content}</g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 100 100"><rect width="100" height="100" fill="${ground}"/><g color="${ink}" fill="${ink}" stroke="${ink}">${copies.join('')}</g></svg>`;
}

// ─── La tuile de l'IA, validée ──────────────────────────────────────────────

const TILE_TAGS = new Set(['g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const TILE_ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-rule', 'fill-opacity', 'stroke-opacity']);

/**
 * Le dessin de l'IA, nettoyé : seules des formes vectorielles et leurs attributs géométriques passent ; toute
 * couleur devient `currentColor` (le motif est à l'encre de la marque). `null` s'il ne reste pas un vrai motif.
 */
export function sanitizeAuthoredTile(raw: string): string | null {
  const body = (raw.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i)?.[1] ?? raw).replace(/```[a-z]*|```/gi, '');
  const out: string[] = [];
  let shapes = 0;
  const re = /<\/?([a-zA-Z]+)\b([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    if (!TILE_TAGS.has(tag)) continue;
    if (m[0].startsWith('</')) {
      out.push(`</${tag}>`);
      continue;
    }
    const attrs: string[] = [];
    const ar = /([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = ar.exec(m[2]))) {
      const name = a[1].toLowerCase();
      if (!TILE_ATTRS.has(name)) continue;
      let value = (a[3] ?? a[4] ?? '').slice(0, 4000);
      if ((name === 'fill' || name === 'stroke') && value !== 'none') value = 'currentColor';
      if (/url\(|javascript:|expression\(/i.test(value)) continue;
      attrs.push(`${name}="${value.replace(/"/g, '')}"`);
    }
    if (tag !== 'g') shapes += 1;
    out.push(`<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}${m[3] ? '/' : ''}>`);
  }
  const content = out.join('');
  return shapes >= 3 && content.length <= 12_000 ? content : null;
}

// ─── Les quatre motifs ──────────────────────────────────────────────────────

export function signaturePatterns(input: SignaturePatternInput): SignaturePattern[] {
  const rnd = rngOf(input.seed);
  const { primary, accent, surface, subtle } = input.colors;
  const symbol = iconSymbol(input.iconSvg);
  const rounded = symbol?.rounded ?? rnd() < 0.5;
  const fallback = (i: number) => input.repertoire[i % Math.max(1, input.repertoire.length)] ?? 'dots';
  const geometryPlan = (id: string, label: string, role: string, ink: string, ground: string, tile: number, i: number): SignaturePattern => {
    const kind = fallback(i);
    return { id, label, role, kind, ink, ground, tile, source: 'geometry', svg: brandPatternSvg({ kind, ink, ground, tile }) };
  };
  const out: SignaturePattern[] = [];

  // 1. Le symbole, sur une trame propre au projet.
  if (symbol) {
    const t = Math.round(88 + rnd() * 56);
    const kind = pick(rnd, ['square', 'halfdrop', 'brick', 'diamond'] as const);
    const size = r2(t * (kind === 'brick' ? 0.3 : 0.36 + rnd() * 0.14));
    const rotations = pick(rnd, [[0], [0, 180], [0, 90, 180, 270], [0, 45], [-12, 12]]);
    out.push({ id: 'primary', label: 'Motif principal', role: 'Le symbole de la marque en trame : aplats et fonds de page', kind: 'dots', ink: primary, ground: surface, tile: t, source: 'logo', svg: tileWithSymbol(t, surface, primary, symbol, lattice(kind, t, size, rotations, rnd), 'fill') });
  } else {
    const t = Math.round(64 + rnd() * 48);
    out.push({ id: 'primary', label: 'Motif principal', role: 'Aplats et fonds de page', kind: 'weave', ink: primary, ground: surface, tile: t, source: 'geometry', svg: generatedGeometry(t, surface, primary, rounded, rnd) });
  }

  // 2. La tuile de l'IA, sinon une géométrie dans le langage du logo.
  {
    const t = Math.round(72 + rnd() * 48);
    if (input.authoredTile) out.push({ id: 'secondary', label: 'Motif secondaire', role: 'Dessiné pour la marque : zones de rappel', kind: 'weave', ink: accent, ground: surface, tile: t, source: 'ai', svg: authoredTileSvg(input.authoredTile, t, surface, accent) });
    else out.push({ id: 'secondary', label: 'Motif secondaire', role: 'Zones de rappel', kind: rounded ? 'arcs' : 'chevron', ink: accent, ground: surface, tile: t, source: 'geometry', svg: generatedGeometry(t, surface, accent, rounded, rnd) });
  }

  // 3. La trame fine : le symbole en semis minuscule.
  if (symbol) {
    const t = Math.round(48 + rnd() * 24);
    const places: Placed[] = Array.from({ length: 2 + Math.floor(rnd() * 2) }, (_, i) => ({ x: r2((i * t) / 2 + rnd() * t * 0.3), y: r2(rnd() * t), size: r2(t * 0.16), rotate: Math.round(rnd() * 4) * 90 }));
    out.push({ id: 'subtle', label: 'Trame fine', role: 'Semis du symbole : fonds discrets', kind: 'dots', ink: primary, ground: subtle, tile: t, source: 'logo', svg: tileWithSymbol(t, subtle, primary, symbol, places, 'fill') });
  } else out.push(geometryPlan('subtle', 'Trame fine', 'Fonds discrets', primary, subtle, 32, 2));

  // 4. Le contour du symbole, en grand, sur l'aplat de la marque.
  if (symbol) {
    const t = Math.round(110 + rnd() * 60);
    out.push({ id: 'inverted', label: 'Motif inversé', role: 'Le contour du symbole : sur fond de marque', kind: 'weave', ink: surface, ground: primary, tile: t, source: 'logo', svg: tileWithSymbol(t, primary, surface, symbol, lattice(pick(rnd, ['diamond', 'halfdrop'] as const), t, r2(t * 0.62), [0, pick(rnd, [0, 90, 180])], rnd), 'outline') });
  } else out.push(geometryPlan('inverted', 'Motif inversé', 'Sur fond de marque', surface, primary, 48, 3));

  return out;
}
