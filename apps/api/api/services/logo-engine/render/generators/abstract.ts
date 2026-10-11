/**
 * MODULE B (1/2) — SYMBOLES ABSTRAITS : rosaces, orbites, arcs, barres, chevrons, trames, facettes,
 * cubes, ruches, vagues, spirales, rayons, bandes, treillis, intersections, papier plié.
 *
 * Constructions géométriques paramétrées, dessinées dans la boîte 0–100. Aucune n'est littérale :
 * leur sens vient du secteur et de la personnalité de la marque (étiquettes `tags`), c'est le
 * planificateur — ou l'agent — qui les associe.
 */
import type { GeometryKernel } from '../../kernel/geometry';
import { around, rotateBy, scaleBy, skewXBy, translate } from '../../kernel/geometry';
import { arcBandPath, circlePath, ellipsePath, linePath, polar, polyPath, rectPath, regularPolygonPoints, ringPath, smoothClosedPath } from '../../kernel/primitives';
import type { Pt } from '../../kernel/primitives';
import { bool, GenPart, num, opt, register, Tone } from './registry';

/** Fait pivoter un tracé autour d'un point. */
export function rotated(k: GeometryKernel, d: string, deg: number, cx = 50, cy = 50): string {
  if (!deg) return d;
  const shape = k.fromPath(d);
  return shape ? k.transform(shape, around(rotateBy(deg), cx, cy)).d : d;
}

export function mirrored(k: GeometryKernel, d: string, cx = 50): string {
  const shape = k.fromPath(d);
  return shape ? k.transform(shape, around(scaleBy(-1, 1), cx, 50)).d : d;
}

export function moved(k: GeometryKernel, d: string, dx: number, dy: number): string {
  const shape = k.fromPath(d);
  return shape ? k.transform(shape, translate(dx, dy)).d : d;
}

export function scaled(k: GeometryKernel, d: string, s: number, cx = 50, cy = 50): string {
  const shape = k.fromPath(d);
  return shape ? k.transform(shape, around(scaleBy(s), cx, cy)).d : d;
}

/** Booléen sur des tracés ; repli sur le premier tracé si le noyau échoue. */
export function combineD(k: GeometryKernel, op: 'union' | 'subtract' | 'intersect' | 'exclude', a: string, b: string): string {
  const sa = k.fromPath(a);
  const sb = k.fromPath(b);
  if (!sa || !sb) return a;
  return k.combine(op, sa, sb)?.d ?? a;
}

const tone = (d: string, t: Tone): GenPart => ({ d, tone: t });

/** Pétale pointant vers le haut, base en (cx, cy - r0), pointe en (cx, cy - r1). */
function petalPath(kind: string, cx: number, cy: number, r0: number, r1: number, w: number): string {
  const L = r1 - r0;
  const by = cy - r0;
  const ty = cy - r1;
  switch (kind) {
    case 'ellipse':
      return ellipsePath(cx, by - L / 2, w / 2, L / 2);
    case 'diamond':
      return polyPath([[cx, by], [cx + w / 2, by - L / 2], [cx, ty], [cx - w / 2, by - L / 2]]);
    case 'round':
      return circlePath(cx, (by + ty) / 2, Math.min(w, L) / 2);
    case 'drop':
      return `M${cx} ${ty}C${cx + w * 0.15} ${ty + L * 0.25} ${cx + w * 0.62} ${by - L * 0.55} ${cx + w * 0.5} ${by - L * 0.18}C${cx + w * 0.44} ${by + L * 0.1} ${cx - w * 0.44} ${by + L * 0.1} ${cx - w * 0.5} ${by - L * 0.18}C${cx - w * 0.62} ${by - L * 0.55} ${cx - w * 0.15} ${ty + L * 0.25} ${cx} ${ty}Z`;
    default:
      return `M${cx} ${by}C${cx + w * 0.62} ${by - L * 0.18} ${cx + w * 0.55} ${by - L * 0.78} ${cx} ${ty}C${cx - w * 0.55} ${by - L * 0.78} ${cx - w * 0.62} ${by - L * 0.18} ${cx} ${by}Z`;
  }
}

register({
  id: 'rosette',
  label: 'Rosace',
  family: 'abstract',
  tags: ['fleur', 'flower', 'nature', 'bien-être', 'wellness', 'beauté', 'beauty', 'cosmétique', 'spa', 'communauté', 'community', 'unité', 'harmonie', 'artisanat', 'mode', 'fashion', 'féminin'],
  tones: 2,
  params: {
    petals: num(3, 12, 6, true),
    shape: opt(['leaf', 'ellipse', 'drop', 'diamond', 'round']),
    inner: num(0, 0.45, 0.12),
    spread: num(0.35, 1, 0.62),
    twist: num(-35, 35, 0),
    alt: bool(false),
    core: opt(['none', 'dot', 'ring'], 'none'),
  },
  build: (p, { kernel: k }) => {
    const n = p.petals as number;
    const R = 46;
    const r0 = (p.inner as number) * R;
    const rmid = (r0 + R) / 2;
    const w = Math.min(((2 * Math.PI * rmid) / n) * (p.spread as number) * 1.5, (R - r0) * 0.95);
    const base = petalPath(p.shape as string, 50, 50, r0, R, w);
    const parts: GenPart[] = [];
    for (let i = 0; i < n; i++) {
      let d = base;
      if (p.twist) d = rotated(k, d, p.twist as number, 50, 50 - r0);
      d = rotated(k, d, (360 / n) * i);
      parts.push(tone(d, p.alt && i % 2 ? 'b' : 'a'));
    }
    if (p.core === 'dot') parts.push(tone(circlePath(50, 50, Math.max(4, r0 * 0.62 + 2)), 'c'));
    if (p.core === 'ring') parts.push(tone(ringPath(50, 50, Math.max(7, r0 + 3), 3), 'c'));
    return parts;
  },
});

register({
  id: 'orbit',
  label: 'Orbite',
  family: 'abstract',
  tags: ['orbite', 'orbit', 'tech', 'technologie', 'data', 'données', 'réseau', 'network', 'espace', 'space', 'global', 'innovation', 'startup', 'cloud', 'ia', 'ai', 'fintech'],
  tones: 2,
  params: {
    rings: num(1, 3, 1, true),
    thick: num(4, 14, 8),
    dots: num(1, 3, 1, true),
    dotSize: num(6, 16, 11),
    gap: num(0, 120, 0),
    tilt: num(-60, 60, 0),
  },
  build: (p, { kernel: k }) => {
    const parts: GenPart[] = [];
    const rings = p.rings as number;
    const thick = p.thick as number;
    const gap = p.gap as number;
    for (let i = 0; i < rings; i++) {
      const r = 44 - i * (thick + 5);
      if (r - thick < 3) break;
      const band = gap > 5 ? arcBandPath(50, 50, r, thick, gap / 2 + i * 40, 360 - gap / 2 + i * 40, true) : ringPath(50, 50, r, thick);
      parts.push(tone(rotated(k, band, p.tilt as number), 'a'));
    }
    const dots = p.dots as number;
    for (let i = 0; i < dots; i++) {
      const angle = 35 + (360 / dots) * i;
      const [x, y] = polar(50, 50, 44 - thick / 2, angle);
      parts.push(tone(circlePath(x, y, (p.dotSize as number) / 2), 'c'));
    }
    return parts;
  },
});

register({
  id: 'arcs',
  label: 'Arcs concentriques',
  family: 'abstract',
  tags: ['signal', 'wifi', 'connexion', 'connect', 'communication', 'média', 'media', 'son', 'sound', 'radio', 'télécom', 'telecom', 'onde', 'wave', 'mobile', 'écoute'],
  tones: 2,
  params: {
    count: num(2, 5, 3, true),
    sweep: num(100, 300, 200),
    thick: num(5, 12, 8),
    gap: num(3, 10, 5),
    start: num(-180, 180, 0),
    fan: num(0, 50, 0),
    round: bool(true),
    accentCore: bool(false),
  },
  build: (p) => {
    const parts: GenPart[] = [];
    const count = p.count as number;
    const thick = p.thick as number;
    const step = thick + (p.gap as number);
    for (let i = 0; i < count; i++) {
      const r = 46 - i * step;
      if (r - thick < 2) break;
      const from = (p.start as number) - (p.sweep as number) / 2 + i * (p.fan as number);
      parts.push(tone(arcBandPath(50, 50, r, thick, from, from + (p.sweep as number), p.round as boolean), i % 2 && p.accentCore ? 'c' : 'a'));
    }
    if (p.accentCore) parts.push(tone(circlePath(50, 50, Math.max(3, 46 - count * step + thick / 2)), 'c'));
    return parts;
  },
});

register({
  id: 'bars',
  label: 'Barres',
  family: 'abstract',
  tags: ['croissance', 'growth', 'finance', 'banque', 'bank', 'investissement', 'invest', 'statistiques', 'analytics', 'data', 'progrès', 'progress', 'performance', 'conseil', 'consulting', 'audio', 'musique', 'music'],
  tones: 2,
  params: {
    count: num(3, 6, 4, true),
    profile: opt(['rise', 'peak', 'wave', 'step']),
    slant: num(-15, 15, 0),
    radius: num(0, 1, 0.5),
    gap: num(3, 10, 6),
    accentLast: bool(true),
  },
  build: (p, { kernel: k }) => {
    const n = p.count as number;
    const gap = p.gap as number;
    const w = (84 - gap * (n - 1)) / n;
    const parts: GenPart[] = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      let hFrac = 0.3 + 0.7 * t;
      if (p.profile === 'peak') hFrac = 0.35 + 0.65 * (1 - Math.abs(t - 0.5) * 2);
      if (p.profile === 'wave') hFrac = 0.55 + 0.4 * Math.sin(t * Math.PI * 2);
      if (p.profile === 'step') hFrac = 0.3 + 0.7 * (Math.floor(t * 3) / 2);
      const h = 18 + 70 * Math.min(1, Math.max(0.12, hFrac));
      let d = rectPath(8 + i * (w + gap), 94 - h, w, h, (p.radius as number) * w * 0.5);
      if (p.slant) d = rotated(k, d, 0);
      parts.push(tone(d, p.accentLast && i === n - 1 ? 'c' : i % 2 ? 'b' : 'a'));
    }
    if (p.slant) {
      return parts.map((part) => {
        const s = k.fromPath(part.d);
        return s ? { ...part, d: k.transform(s, around(skewXBy(-(p.slant as number)), 50, 94)).d } : part;
      });
    }
    return parts;
  },
});

register({
  id: 'chevrons',
  label: 'Chevrons',
  family: 'abstract',
  tags: ['avancer', 'forward', 'élan', 'progrès', 'progress', 'transport', 'logistique', 'logistics', 'sport', 'énergie', 'energy', 'vitesse', 'speed', 'croissance', 'growth', 'direction', 'mobilité', 'mobility'],
  tones: 2,
  params: {
    count: num(2, 4, 2, true),
    thick: num(8, 18, 13),
    open: num(40, 90, 62),
    direction: opt(['up', 'right', 'down', 'left']),
    step: num(0.6, 1.4, 1),
    round: bool(true),
  },
  build: (p, { kernel: k }) => {
    const n = p.count as number;
    const t = p.thick as number;
    const half = (p.open as number) / 2;
    const arm = 38;
    const rise = arm * Math.cos((half * Math.PI) / 180);
    const run = arm * Math.sin((half * Math.PI) / 180);
    const spacing = t * 1.55 * (p.step as number);
    const total = rise + (n - 1) * spacing + t;
    const top = 50 - total / 2;
    const parts: GenPart[] = [];
    for (let i = 0; i < n; i++) {
      const y = top + i * spacing;
      const apex: Pt = [50, y];
      const left: Pt = [50 - run, y + rise];
      const right: Pt = [50 + run, y + rise];
      const d = polyPath([left, apex, right, [right[0], right[1] + t], [50, y + t], [left[0], left[1] + t]], p.round ? t * 0.35 : 0);
      const dir = { up: 0, right: 90, down: 180, left: 270 }[p.direction as string] ?? 0;
      parts.push(tone(rotated(k, d, dir), i % 2 ? 'b' : 'a'));
    }
    return parts;
  },
});

register({
  id: 'tiles',
  label: 'Trame de tuiles',
  family: 'abstract',
  tags: ['modulaire', 'modular', 'structure', 'construction', 'bâtiment', 'architecture', 'pixel', 'design', 'tissage', 'weave', 'kente', 'artisanat', 'systèmes', 'plateforme', 'platform', 'saas', 'communauté'],
  tones: 3,
  params: {
    grid: num(2, 4, 3, true),
    pattern: opt(['checker', 'corner', 'diagonal', 'gradient', 'plus', 'random']),
    round: num(0, 0.5, 0.2),
    gap: num(2, 8, 4),
  },
  build: (p, { rng }) => {
    const n = p.grid as number;
    const gap = p.gap as number;
    const size = (88 - gap * (n - 1)) / n;
    const parts: GenPart[] = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        let show = true;
        let t: Tone = 'a';
        const pattern = p.pattern as string;
        if (pattern === 'checker') t = (row + col) % 2 ? 'b' : 'a';
        else if (pattern === 'corner') show = !(row === 0 && col === n - 1);
        else if (pattern === 'diagonal') t = row === col ? 'c' : (row + col) % 2 ? 'b' : 'a';
        else if (pattern === 'gradient') {
          t = 'a';
        } else if (pattern === 'plus') show = row === Math.floor(n / 2) || col === Math.floor(n / 2) || n === 2;
        else if (pattern === 'random') {
          show = rng() > 0.2;
          t = rng() > 0.7 ? 'c' : 'a';
        }
        if (!show) continue;
        let s = size;
        let ox = 0;
        let oy = 0;
        if (pattern === 'gradient') {
          const f = 0.45 + 0.55 * ((row + col) / (2 * (n - 1)));
          s = size * f;
          ox = (size - s) / 2;
          oy = (size - s) / 2;
        }
        const x = 6 + col * (size + gap) + ox;
        const y = 6 + row * (size + gap) + oy;
        parts.push(tone(rectPath(x, y, s, s, (p.round as number) * s), t));
      }
    }
    return parts;
  },
});

register({
  id: 'facets',
  label: 'Gemme à facettes',
  family: 'abstract',
  tags: ['luxe', 'luxury', 'valeur', 'value', 'bijou', 'jewel', 'diamant', 'diamond', 'premium', 'précieux', 'qualité', 'quality', 'finance', 'crypto', 'cristal', 'or'],
  tones: 3,
  params: {
    sides: num(5, 8, 6, true),
    depth: num(0.35, 0.7, 0.5),
    rotation: num(0, 60, 0),
    gap: num(0, 3, 1.2),
  },
  build: (p, { kernel: k }) => {
    const n = p.sides as number;
    const outer = regularPolygonPoints(50, 50, 46, n, p.rotation as number);
    const inner = regularPolygonPoints(50, 50, 46 * (p.depth as number), n, (p.rotation as number) + 180 / n);
    const parts: GenPart[] = [];
    const gap = p.gap as number;
    for (let i = 0; i < n; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % n];
      const c = inner[(i + 1) % n];
      const d0 = inner[i];
      let d = polyPath([a, b, c, d0]);
      if (gap) d = scaled(k, d, 1 - gap / 40, (a[0] + b[0] + c[0] + d0[0]) / 4, (a[1] + b[1] + c[1] + d0[1]) / 4);
      parts.push(tone(d, i % 2 ? 'b' : 'a'));
    }
    parts.push(tone(polyPath(inner), 'c'));
    return parts;
  },
});

register({
  id: 'cube',
  label: 'Cube isométrique',
  family: 'abstract',
  tags: ['cube', 'boîte', 'box', 'colis', 'package', 'logistique', 'logistics', 'bloc', 'block', 'blockchain', 'tech', 'saas', '3d', 'stockage', 'storage', 'produit', 'product', 'e-commerce'],
  tones: 3,
  params: { gap: num(0, 4, 1.5), open: bool(false), top: opt(['a', 'c'], 'a') },
  build: (p, { kernel: k }) => {
    const T: Pt = [50, 5];
    const UR: Pt = [90, 27.5];
    const LR: Pt = [90, 72.5];
    const B: Pt = [50, 95];
    const LL: Pt = [10, 72.5];
    const UL: Pt = [10, 27.5];
    const C: Pt = [50, 50];
    const g = p.gap as number;
    const face = (pts: Pt[]) => {
      const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
      const cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      return scaled(k, polyPath(pts), 1 - g / 20, cx, cy);
    };
    const parts: GenPart[] = [tone(face([T, UR, C, UL]), p.top as Tone), tone(face([UL, C, B, LL]), 'b'), tone(face([C, UR, LR, B]), 'a')];
    if (p.open) {
      const notch = polyPath([[50, 50], [70, 38.5], [70, 61.5], [50, 73]]);
      return parts.map((part) => ({ ...part, d: combineD(k, 'subtract', part.d, notch) }));
    }
    return parts;
  },
});

register({
  id: 'hexcluster',
  label: 'Ruche',
  family: 'abstract',
  tags: ['ruche', 'hive', 'hexagone', 'hexagon', 'communauté', 'community', 'réseau', 'network', 'chimie', 'science', 'tech', 'collaboration', 'équipe', 'team', 'miel', 'honey', 'agriculture'],
  tones: 3,
  params: { count: num(3, 7, 3, true), gap: num(1.5, 6, 3), round: num(0, 6, 2), pattern: opt(['mono', 'duo', 'accent']) },
  build: (p) => {
    const count = p.count as number;
    const gap = p.gap as number;
    const R = count >= 7 ? 15.5 : count >= 4 ? 21 : 24;
    const w = Math.sqrt(3) * R;
    const triangle: Pt[] = [[50, 50 - R * 0.95], [50 - (w + gap) / 2, 50 + R * 0.55], [50 + (w + gap) / 2, 50 + R * 0.55]];
    const rhombus: Pt[] = [[50, 50 - (R * 1.5 + gap)], [50 - (w + gap) / 2, 50], [50 + (w + gap) / 2, 50], [50, 50 + (R * 1.5 + gap)]];
    const flower: Pt[] = [[50, 50], ...Array.from({ length: 6 }, (_, i) => polar(50, 50, w + gap, 60 * i))];
    const used: Pt[] = count <= 3 ? triangle : count === 4 ? rhombus : count === 5 ? [...rhombus, [50, 50]] : flower;
    return used.map((c, i) => {
      const d = polyPath(regularPolygonPoints(c[0], c[1], R - gap * 0.2, 6, 0), p.round as number);
      const t: Tone = p.pattern === 'mono' ? 'a' : p.pattern === 'duo' ? (i % 2 ? 'b' : 'a') : i === used.length - 1 ? 'c' : i % 2 ? 'b' : 'a';
      return tone(d, t);
    });
  },
});

register({
  id: 'wave',
  label: 'Vagues',
  family: 'abstract',
  tags: ['eau', 'water', 'mer', 'sea', 'océan', 'ocean', 'fluide', 'flow', 'liquide', 'rythme', 'musique', 'music', 'voyage', 'travel', 'détente', 'bien-être', 'fleuve', 'pêche', 'boisson', 'drink', 'cosmétique'],
  tones: 2,
  params: {
    layers: num(2, 4, 3, true),
    amp: num(4, 14, 8),
    periods: num(1, 3, 1.5),
    thick: num(8, 16, 11),
    clip: opt(['circle', 'square', 'free']),
    phase: num(0, 360, 0),
  },
  build: (p, { kernel: k }) => {
    const layers = p.layers as number;
    const amp = p.amp as number;
    const thick = p.thick as number;
    const step = thick + amp * 1.3;
    const startY = 50 - (step * (layers - 1)) / 2 - thick / 2;
    const parts: GenPart[] = [];
    const clipD = p.clip === 'circle' ? circlePath(50, 50, 46) : p.clip === 'square' ? rectPath(5, 5, 90, 90, 20) : null;
    for (let i = 0; i < layers; i++) {
      const y0 = startY + i * step;
      const top: Pt[] = [];
      const bottom: Pt[] = [];
      const N = 24;
      for (let j = 0; j <= N; j++) {
        const x = -4 + (108 * j) / N;
        const yy = y0 + amp * Math.sin(((x / 100) * (p.periods as number) * 2 * Math.PI) + ((p.phase as number) * Math.PI) / 180 + i * 0.6);
        top.push([x, yy]);
        bottom.push([x, yy + thick]);
      }
      const smooth = (pts: Pt[]) => pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('');
      const d = `${smooth(top)}L${bottom[bottom.length - 1][0].toFixed(2)} ${bottom[bottom.length - 1][1].toFixed(2)}${bottom
        .slice()
        .reverse()
        .map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`)
        .join('')}Z`;
      parts.push(tone(clipD ? combineD(k, 'intersect', d, clipD) : d, i % 2 ? 'b' : 'a'));
    }
    return parts;
  },
});

register({
  id: 'spiral',
  label: 'Spirale',
  family: 'abstract',
  tags: ['spirale', 'spiral', 'croissance', 'growth', 'évolution', 'cycle', 'infini', 'créativité', 'creative', 'sagesse', 'wisdom', 'coquille', 'shell', 'art', 'studio'],
  tones: 2,
  params: { turns: num(1.4, 3.2, 2.2), thick: num(5, 12, 8), taper: bool(true), dot: bool(true) },
  build: (p) => {
    const turns = p.turns as number;
    const maxR = 44;
    const N = Math.round(26 * turns);
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const angle = t * turns * 360 + 20;
      const r = 6 + (maxR - 6) * t;
      const half = ((p.thick as number) / 2) * (p.taper ? 0.35 + 0.65 * t : 1);
      const a = polar(50, 50, r - half, angle);
      const b = polar(50, 50, r + half, angle);
      left.push(a);
      right.push(b);
    }
    const d = `M${right.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}L${left
      .slice()
      .reverse()
      .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
      .join('L')}Z`;
    const parts = [tone(d, 'a')];
    if (p.dot) {
      const c = polar(50, 50, 6, 20);
      parts.push(tone(circlePath(c[0], c[1], (p.thick as number) * 0.65), 'c'));
    }
    return parts;
  },
});

register({
  id: 'sunburst',
  label: 'Rayons',
  family: 'abstract',
  tags: ['soleil', 'sun', 'rayon', 'ray', 'énergie', 'energy', 'solaire', 'solar', 'lumière', 'light', 'espoir', 'hope', 'afrique', 'africa', 'éducation', 'matin', 'idée', 'idea', 'éclat'],
  tones: 2,
  params: {
    rays: num(6, 16, 10, true),
    inner: num(14, 28, 20),
    outer: num(36, 48, 44),
    width: num(5, 14, 8),
    core: opt(['disc', 'ring', 'none']),
    round: bool(true),
  },
  build: (p) => {
    const parts: GenPart[] = [];
    const n = p.rays as number;
    for (let i = 0; i < n; i++) {
      const a = (360 / n) * i;
      const [x1, y1] = polar(50, 50, p.inner as number, a);
      const [x2, y2] = polar(50, 50, p.outer as number, a);
      parts.push(tone(linePath(x1, y1, x2, y2, p.width as number, p.round as boolean), 'a'));
    }
    const coreR = (p.inner as number) - 6;
    if (p.core === 'disc') parts.push(tone(circlePath(50, 50, coreR), 'c'));
    if (p.core === 'ring') parts.push(tone(ringPath(50, 50, coreR, 5), 'c'));
    return parts;
  },
});

register({
  id: 'zigzag',
  label: 'Bandes en zigzag',
  family: 'abstract',
  tags: ['afrique', 'africa', 'kente', 'ndebele', 'motif', 'pattern', 'tissu', 'textile', 'wax', 'pagne', 'artisanat', 'craft', 'culture', 'tradition', 'mode', 'fashion', 'rythme', 'musique', 'danse'],
  tones: 3,
  params: { rows: num(1, 3, 2, true), peaks: num(3, 6, 4, true), thick: num(7, 14, 10), amp: num(8, 22, 14), clip: opt(['square', 'circle', 'free']) },
  build: (p, { kernel: k }) => {
    const rows = p.rows as number;
    const peaks = p.peaks as number;
    const amp = p.amp as number;
    const thick = p.thick as number;
    const gap = thick * 0.5;
    const total = rows * (amp + thick) + (rows - 1) * gap;
    const top = 50 - total / 2;
    const clipD = p.clip === 'circle' ? circlePath(50, 50, 46) : p.clip === 'square' ? rectPath(5, 5, 90, 90, 14) : null;
    const parts: GenPart[] = [];
    for (let r = 0; r < rows; r++) {
      const y0 = top + r * (amp + thick + gap);
      const pts: Pt[] = [];
      for (let i = 0; i <= peaks * 2; i++) pts.push([4 + (92 * i) / (peaks * 2), y0 + (i % 2 ? amp : 0)]);
      const d = `M${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}L${pts
        .slice()
        .reverse()
        .map(([x, y]) => `${x.toFixed(2)} ${(y + thick).toFixed(2)}`)
        .join('L')}Z`;
      parts.push(tone(clipD ? combineD(k, 'intersect', d, clipD) : d, r === 1 ? 'c' : r % 2 ? 'b' : 'a'));
    }
    return parts;
  },
});

register({
  id: 'lattice',
  label: 'Treillis en losanges',
  family: 'abstract',
  tags: ['treillis', 'lattice', 'tissage', 'weave', 'africa', 'afrique', 'motif', 'pattern', 'réseau', 'network', 'sécurité', 'filet', 'net', 'maille', 'tricot', 'textile', 'mode'],
  tones: 3,
  params: { grid: num(2, 4, 3, true), gap: num(2, 6, 3), center: opt(['accent', 'knockout', 'same']) },
  build: (p) => {
    const n = p.grid as number;
    const gap = p.gap as number;
    const cell = (88 - 0) / n;
    const parts: GenPart[] = [];
    // Losanges posés sur la diagonale d'une grille n×n (pointe en haut).
    const rowsCount = n * 2 - 1;
    for (let row = 0; row < rowsCount; row++) {
      const cols = row % 2 === 0 ? n : n - 1;
      for (let col = 0; col < cols; col++) {
        const cx = 6 + cell / 2 + col * cell + (row % 2 ? cell / 2 : 0);
        const cy = 6 + cell / 2 + (row * cell) / 2;
        const half = cell / 2 - gap / 2;
        const isCenter = row === n - 1 && col === Math.floor((cols - 1) / 2);
        const d = polyPath([[cx, cy - half], [cx + half, cy], [cx, cy + half], [cx - half, cy]], 1);
        if (isCenter && p.center === 'knockout') parts.push(tone(d, 'knockout'));
        else parts.push(tone(d, isCenter && p.center === 'accent' ? 'c' : (row + col) % 2 ? 'b' : 'a'));
      }
    }
    return parts;
  },
});

register({
  id: 'venn',
  label: 'Cercles entrelacés',
  family: 'abstract',
  tags: ['partenariat', 'partnership', 'lien', 'link', 'ensemble', 'together', 'communauté', 'community', 'rencontre', 'meeting', 'fusion', 'mariage', 'social', 'collectif', 'collaboration', 'inclusion', 'médiation', 'ong', 'association'],
  tones: 3,
  params: { count: num(2, 3, 2, true), overlap: num(0.25, 0.6, 0.42), mid: opt(['accent', 'knockout', 'none']) },
  build: (p, { kernel: k }) => {
    const parts: GenPart[] = [];
    const n = p.count as number;
    const r = n === 2 ? 28 : 24;
    const dist = r * 2 * (1 - (p.overlap as number));
    const centers: Pt[] = n === 2 ? [[50 - dist / 2, 50], [50 + dist / 2, 50]] : [polar(50, 50 + 4, dist / 1.4, 0), polar(50, 50 + 4, dist / 1.4, 120), polar(50, 50 + 4, dist / 1.4, 240)];
    centers.forEach((c, i) => parts.push(tone(circlePath(c[0], c[1], r), i % 2 ? 'b' : 'a')));
    if (p.mid !== 'none') {
      let inter = circlePath(centers[0][0], centers[0][1], r);
      for (let i = 1; i < centers.length; i++) inter = combineD(k, 'intersect', inter, circlePath(centers[i][0], centers[i][1], r));
      parts.push(tone(inter, p.mid === 'knockout' ? 'knockout' : 'c'));
    }
    return parts;
  },
});

register({
  id: 'fold',
  label: 'Papier plié',
  family: 'abstract',
  tags: ['message', 'envoi', 'send', 'courrier', 'mail', 'voyage', 'travel', 'livraison', 'delivery', 'communication', 'agence', 'vol', 'flight', 'avion', 'liberté', 'liberty', 'rapide', 'media'],
  tones: 3,
  params: { tilt: num(-25, 25, 0), keel: bool(true) },
  build: (p, { kernel: k }) => {
    const nose: Pt = [94, 10];
    const left: Pt = [6, 44];
    const tail: Pt = [40, 94];
    const fold: Pt = [42, 58];
    const parts: GenPart[] = [tone(polyPath([left, nose, fold], 2.5), 'a'), tone(polyPath([fold, nose, tail], 2.5), 'b')];
    if (p.keel) parts.push(tone(polyPath([fold, tail, [30, 70]], 2), 'c'));
    return p.tilt ? parts.map((part) => ({ ...part, d: rotated(k, part.d, p.tilt as number) })) : parts;
  },
});

export {};
