/**
 * <IconMotion> — un pictogramme SVG animé, forme par forme.
 *
 * Les bibliothèques d'icônes (Lucide, Tabler, Phosphor, Heroicons) sont lues côté serveur comme
 * des SVG (jamais comme des composants React) : c'est ce qui permet de les animer. Le SVG est
 * décomposé en formes (`path`, `circle`, `rect`…) et chacune reçoit son avancement.
 *
 *   <IconMotion svg={s.icons?.[0]} mode="draw" at={0.2} dur={1} style={{ width: 12 * u, height: 12 * u, color: 'var(--hl-text)' }} />
 *
 * Modes :
 *   draw     icône au trait : les tracés se dessinent l'un après l'autre. Icône pleine : le contour se
 *            dessine, puis le remplissage monte.
 *   stagger  les formes apparaissent une à une (échelle + fondu)
 *   pop      l'icône jaillit en dépassant sa taille
 *   pulse    elle bat doucement, en continu
 *   wiggle   elle se balance, en continu
 *   morph    elle devient l'icône `to` (flubber)
 *
 * Tout est une fonction du temps de la scène. Sans l'addon flubber, `morph` fond d'une icône à l'autre.
 */
import { createElement, CSSProperties, useMemo } from 'react';
import { useLocalTime } from '../context';
import { addon } from '../shared';
import { clamp, mix, progress } from '../time';

export type IconMode = 'draw' | 'stagger' | 'pop' | 'pulse' | 'wiggle' | 'morph';
export const ICON_MODES: IconMode[] = ['draw', 'stagger', 'pop', 'pulse', 'wiggle', 'morph'];

interface Shape {
  tag: string;
  attrs: Record<string, string>;
}
interface Parsed {
  viewBox: string;
  size: number;
  root: Record<string, string>;
  stroke: boolean;
  shapes: Shape[];
}

const CAMEL: Record<string, string> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
};
const SHAPE_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);

const cache = new Map<string, Parsed | null>();

function parse(svg: string): Parsed | null {
  if (cache.has(svg)) return cache.get(svg)!;
  let out: Parsed | null = null;
  try {
    // Analyse HTML, tolérante : certains SVG de bibliothèques répètent un attribut (Heroicons : aria-hidden),
    // ce que l'analyse XML stricte refuse.
    const doc = new DOMParser().parseFromString(`<body>${svg}</body>`, 'text/html');
    const el = doc.querySelector('svg');
    if (el) {
      const root: Record<string, string> = {};
      for (const a of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) if (el.hasAttribute(a)) root[a] = el.getAttribute(a)!;
      const shapes: Shape[] = [];
      const walk = (node: Element) => {
        for (const child of Array.from(node.children)) {
          const tag = child.nodeName.toLowerCase();
          if (SHAPE_TAGS.has(tag)) {
            const attrs: Record<string, string> = {};
            for (const a of Array.from(child.attributes)) attrs[a.name] = a.value;
            // Les rectangles de cadrage invisibles (Tabler : `stroke="none"`) ne se dessinent pas.
            if (attrs.stroke === 'none' && attrs.fill === 'none') continue;
            shapes.push({ tag, attrs });
          } else if (tag === 'g') walk(child);
        }
      };
      walk(el);
      const vb = el.getAttribute('viewBox') || '0 0 24 24';
      const size = Number(vb.split(/[\s,]+/)[2]) || 24;
      if (shapes.length) out = { viewBox: vb, size, root, stroke: root.stroke != null && root.stroke !== 'none', shapes };
    }
  } catch {
    out = null;
  }
  if (cache.size > 300) cache.clear();
  cache.set(svg, out);
  return out;
}

const num = (v: string | undefined, d = 0) => (v == null ? d : Number(v) || d);

/** Toute forme de base en tracé (flubber n'interpole que des tracés). */
function toPath(s: Shape): string {
  const a = s.attrs;
  switch (s.tag) {
    case 'path':
      return a.d || '';
    case 'circle': {
      const [cx, cy, r] = [num(a.cx), num(a.cy), num(a.r)];
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    }
    case 'ellipse': {
      const [cx, cy, rx, ry] = [num(a.cx), num(a.cy), num(a.rx), num(a.ry)];
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    }
    case 'rect': {
      const [x, y, w, h] = [num(a.x), num(a.y), num(a.width), num(a.height)];
      const r = Math.min(num(a.rx, num(a.ry)), w / 2, h / 2);
      return r > 0 ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z` : `M${x} ${y}h${w}v${h}h${-w}Z`;
    }
    case 'line':
      return `M${num(a.x1)} ${num(a.y1)}L${num(a.x2)} ${num(a.y2)}`;
    default: {
      const pts = (a.points || '').trim().split(/[\s,]+/).map(Number);
      let d = '';
      for (let i = 0; i + 1 < pts.length; i += 2) d += `${i ? 'L' : 'M'}${pts[i]} ${pts[i + 1]}`;
      return s.tag === 'polygon' ? `${d}Z` : d;
    }
  }
}

/** Les attributs React d'une forme, sans ce que l'animation pose elle-même. */
function reactAttrs(attrs: Record<string, string>, drop: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) if (!drop.includes(k)) out[CAMEL[k] || k] = v;
  return out;
}

const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
const back = (x: number) => {
  const c = clamp(x) - 1;
  return 1 + 2.4 * c * c * c + 1.4 * c * c;
};

export interface IconMotionProps {
  svg?: string;
  mode?: IconMode;
  /** Pour `morph` : l'icône d'arrivée. */
  to?: string;
  at?: number;
  dur?: number;
  /** Avancement imposé, 0 → 1 (sinon calculé depuis `at` et `dur`). */
  p?: number;
  style?: CSSProperties;
  className?: string;
}

export function IconMotion({ svg, mode = 'draw', to, at = 0, dur = 1, p, style, className }: IconMotionProps) {
  const lt = useLocalTime();
  const from = useMemo(() => (svg ? parse(svg) : null), [svg]);
  const dest = useMemo(() => (to ? parse(to) : null), [to]);
  const flubber = addon('flubber');
  // Les paires de formes d'un morphose (calculées une fois par couple d'icônes).
  const morphs = useMemo(() => {
    if (mode !== 'morph' || !from || !dest || !flubber) return null;
    try {
      const n = Math.max(from.shapes.length, dest.shapes.length);
      return Array.from({ length: n }, (_, i) => {
        const a = from.shapes[Math.min(i, from.shapes.length - 1)];
        const b = dest.shapes[Math.min(i, dest.shapes.length - 1)];
        return flubber.interpolate(toPath(a), toPath(b), { maxSegmentLength: 2 });
      });
    } catch {
      return null;
    }
  }, [mode, from, dest, flubber]);
  if (!from) return null;
  const q = clamp(p ?? progress(lt, at, dur));
  const n = from.shapes.length;
  const stagger = 0.6 / Math.max(1, n);
  const win = Math.max(0.3, 1 - stagger * (n - 1));
  const own = (i: number) => clamp((q - i * stagger) / win);
  // Une classe (ex. `inline-flex`, `block`) décide de l'affichage ; sans classe, une boîte en ligne.
  const wrap: CSSProperties = { ...(className ? {} : { display: 'inline-block' }), ...style };
  const svgProps = { viewBox: from.viewBox, width: '100%', height: '100%', 'aria-hidden': true, fill: from.root.fill, stroke: from.root.stroke, strokeWidth: from.root['stroke-width'], strokeLinecap: from.root['stroke-linecap'], strokeLinejoin: from.root['stroke-linejoin'], overflow: 'visible' } as Record<string, unknown>;
  const spring = { transformBox: 'fill-box', transformOrigin: 'center' } as CSSProperties;

  if (mode === 'morph' && dest) {
    const k = smooth(q);
    const shapes = morphs
      ? morphs.map((f, i) => createElement('path', { key: i, d: f(k), ...reactAttrs(from.shapes[Math.min(i, from.shapes.length - 1)].attrs, ['d']) }))
      : [
          ...from.shapes.map((s, i) => createElement(s.tag, { key: `a${i}`, ...reactAttrs(s.attrs), opacity: 1 - k })),
          ...dest.shapes.map((s, i) => createElement(s.tag, { key: `b${i}`, ...reactAttrs(s.attrs), opacity: k })),
        ];
    return (
      <span className={className} style={wrap} aria-hidden>
        {createElement('svg', { ...svgProps, fill: dest.root.fill ?? from.root.fill, stroke: dest.root.stroke ?? from.root.stroke }, ...shapes)}
      </span>
    );
  }

  const shapes = from.shapes.map((s, i) => {
    const qi = own(i);
    const a = reactAttrs(s.attrs);
    // Posée, l'icône est EXACTEMENT l'icône fixe : aucun reste d'animation (tirets, contour ajouté, échelle).
    if (q >= 1 && mode !== 'pulse' && mode !== 'wiggle') return createElement(s.tag, { key: i, ...a });
    if (mode === 'draw') {
      if (from.stroke) return createElement(s.tag, { key: i, ...a, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - smooth(qi), style: { opacity: qi > 0.001 ? 1 : 0 } });
      // Icône pleine : le contour se dessine (70 % du temps), puis le remplissage monte.
      const line = smooth(clamp(q / 0.7));
      const fill = smooth((q - 0.55) / 0.45);
      return createElement(s.tag, { key: i, ...a, pathLength: 1, stroke: 'currentColor', strokeWidth: from.size * 0.022, strokeLinejoin: 'round', strokeDasharray: 1, strokeDashoffset: 1 - line, fillOpacity: fill, style: { opacity: q > 0.001 ? 1 : 0 } });
    }
    if (mode === 'stagger') return createElement(s.tag, { key: i, ...a, style: { ...spring, opacity: smooth(qi * 1.6), transform: `scale(${mix(0.4, 1, back(qi))})` } });
    return createElement(s.tag, { key: i, ...a });
  });

  let transform = '';
  if (mode === 'pop' && q < 1) transform = `scale(${mix(0, 1, back(q))})`;
  else if (mode === 'pulse') transform = `scale(${1 + 0.09 * Math.sin(lt * 4.2)})`;
  else if (mode === 'wiggle') transform = `rotate(${(Math.sin(lt * 5) * 9 * Math.exp(-0.12 * lt)).toFixed(2)}deg)`;
  return (
    <span className={className} style={wrap} aria-hidden>
      {createElement('svg', { ...svgProps, style: { transform: transform || undefined, ...(mode === 'pop' && q < 1 ? { opacity: smooth(q * 3) } : {}) } }, ...shapes)}
    </span>
  );
}
