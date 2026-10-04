/**
 * Animations du LOGO VECTORIEL (IDEM génère le logo en SVG) : le logo est posé
 * en ligne dans la page, puis chaque forme est animée — fonction du temps,
 * déterministe.
 *
 *   draw      les contours se tracent, puis le remplissage monte (pur, sans addon)
 *   trace     une plume parcourt les contours (GSAP DrawSVG + CustomEase), puis remplissage
 *   morph     un point devient le logo, forme par forme (flubber `fromCircle`)
 *   assemble  les formes arrivent de directions différentes et s'emboîtent (pur)
 *   wipe      un balayage oblique révèle le logo entier (pur, accepte tout SVG)
 *
 * Le graphe de capacités ne propose une variante que si le SVG s'y prête
 * (nombre de formes, texte, image embarquée) ; ici, en cas d'échec à la
 * préparation, on se replie sur `wipe`.
 */
import { CSSProperties, useLayoutEffect, useMemo, useRef } from 'react';
import { useEngine, useLocalTime } from '../context';
import { addon } from '../shared';
import { clamp, hash, mix, progress } from '../time';

type Ease = (p: number) => number;
interface Ctx {
  ease: Ease;
  back: Ease;
  primary: string;
}
interface Plan {
  apply(lt: number): void;
}

const SHAPE_SEL = 'path,circle,rect,ellipse,polygon,polyline,line';
const HIDDEN_PARENTS = 'defs,clipPath,mask,pattern,symbol,marker';

function shapesOf(svg: SVGSVGElement): SVGGeometryElement[] {
  return [...svg.querySelectorAll<SVGGeometryElement>(SHAPE_SEL)].filter((el) => !el.closest(HIDDEN_PARENTS) && getComputedStyle(el).display !== 'none');
}
function textsOf(svg: SVGSVGElement): SVGGraphicsElement[] {
  return [...svg.querySelectorAll<SVGGraphicsElement>('text,image')].filter((el) => !el.closest(HIDDEN_PARENTS));
}

/** Pixels écran par unité locale d'un élément (indépendant de la mise à l'échelle de l'aperçu). */
function screenScale(el: SVGGraphicsElement): number {
  const m = el.getScreenCTM();
  return m ? Math.hypot(m.a, m.b) || 1 : 1;
}

/** Enveloppe un élément dans un <g> : on anime le groupe sans écraser l'attribut transform de la forme. */
function wrap(el: SVGGraphicsElement): SVGGElement {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  el.parentNode!.insertBefore(g, el);
  g.appendChild(el);
  g.style.transformBox = 'fill-box';
  g.style.transformOrigin = 'center';
  return g;
}

function paintOf(el: Element, prop: 'fill' | 'stroke', fallback: string): string {
  const v = getComputedStyle(el)[prop];
  return !v || v === 'none' || v.startsWith('url(') ? fallback : v;
}

// ─── draw / trace ───────────────────────────────────────────────────────────

function strokeSetup(svg: SVGSVGElement, c: Ctx) {
  const width = svg.getBoundingClientRect().width || 1;
  return shapesOf(svg).map((el) => {
    const cs = getComputedStyle(el);
    const filled = cs.fill !== 'none';
    const len = Math.max(1, el.getTotalLength());
    const sw = filled ? (0.007 * width) / screenScale(el) : parseFloat(cs.strokeWidth) || 1;
    el.style.stroke = filled ? paintOf(el, 'fill', c.primary) : paintOf(el, 'stroke', c.primary);
    el.style.strokeWidth = String(sw);
    el.style.strokeLinecap = 'round';
    el.style.strokeLinejoin = 'round';
    return { el, len, filled };
  });
}

function drawPlan(svg: SVGSVGElement, c: Ctx): Plan | null {
  const items = strokeSetup(svg, c);
  if (!items.length) return null;
  const texts = textsOf(svg);
  const D = 1.25;
  const gap = Math.min(0.09, 0.55 / items.length);
  const end = (items.length - 1) * gap + D;
  return {
    apply(lt) {
      items.forEach((it, i) => {
        const p = c.ease(progress(lt, i * gap, D));
        const f = it.filled ? clamp((lt - (i * gap + D * 0.6)) / 0.45) : 0;
        it.el.style.strokeDasharray = `${it.len} ${it.len}`;
        it.el.style.strokeDashoffset = String(it.len * (1 - p));
        if (it.filled) {
          it.el.style.fillOpacity = String(f);
          it.el.style.strokeOpacity = String(1 - clamp((f - 0.5) / 0.5));
        }
      });
      const tp = c.ease(progress(lt, end - 0.35, 0.6));
      texts.forEach((el) => (el.style.opacity = String(tp)));
    },
  };
}

function tracePlan(svg: SVGSVGElement, c: Ctx): Plan | null {
  const g = addon('gsap');
  if (!g) return null;
  const items = strokeSetup(svg, c);
  if (!items.length) return null;
  const texts = textsOf(svg);
  const D = 1.1;
  const gap = Math.min(0.32, 1.2 / items.length);
  const hand = g.CustomEase.create('idem-hand', 'M0,0 C0.25,0.04 0.42,0.62 0.6,0.8 0.76,0.96 0.88,1 1,1');
  const tl = g.timeline();
  items.forEach((it, i) => {
    tl.fromTo(it.el, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: D, ease: hand }, i * gap);
    if (it.filled) tl.fromTo(it.el, { fillOpacity: 0, strokeOpacity: 1 }, { fillOpacity: 1, strokeOpacity: 0, duration: 0.5, ease: 'power2.out' }, i * gap + D * 0.75);
  });
  const end = (items.length - 1) * gap + D;
  if (texts.length) tl.fromTo(texts, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.05 }, end - 0.2);
  // La plume : un point qui suit le contour en cours de tracé.
  const pen = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  root.appendChild(pen);
  svg.appendChild(root);
  const rootScale = screenScale(root);
  pen.setAttribute('r', String((0.012 * (svg.getBoundingClientRect().width || 1)) / rootScale));
  pen.style.fill = c.primary;
  return {
    apply(lt) {
      tl.seek(lt, true);
      const i = Math.min(items.length - 1, Math.floor(lt / gap));
      const local = lt - i * gap;
      const it = items[Math.max(0, i)];
      const on = lt < end && local >= 0 && local <= D;
      pen.style.opacity = on ? '1' : String(1 - clamp((lt - end) / 0.2));
      if (!it) return;
      const p = hand(clamp(local / D));
      const pt = it.el.getPointAtLength(it.len * p);
      const m = root.getCTM()?.inverse().multiply(it.el.getCTM()!);
      const q = m ? new DOMPoint(pt.x, pt.y).matrixTransform(m) : pt;
      pen.setAttribute('cx', String(q.x));
      pen.setAttribute('cy', String(q.y));
    },
  };
}

// ─── morph ──────────────────────────────────────────────────────────────────

const num = (el: Element, a: string) => parseFloat(el.getAttribute(a) || '0') || 0;

/** Le tracé `d` d'une forme élémentaire, dans ses coordonnées locales. */
function toPathD(el: SVGGeometryElement): string | null {
  switch (el.tagName.toLowerCase()) {
    case 'path':
      return el.getAttribute('d');
    case 'circle':
    case 'ellipse': {
      const cx = num(el, 'cx');
      const cy = num(el, 'cy');
      const rx = el.tagName === 'circle' ? num(el, 'r') : num(el, 'rx');
      const ry = el.tagName === 'circle' ? rx : num(el, 'ry');
      return `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0Z`;
    }
    case 'rect': {
      const x = num(el, 'x');
      const y = num(el, 'y');
      return `M${x},${y}h${num(el, 'width')}v${num(el, 'height')}h${-num(el, 'width')}Z`;
    }
    case 'polygon':
    case 'polyline': {
      const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      if (pts.length < 4) return null;
      let d = `M${pts[0]},${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]},${pts[i + 1]}`;
      return el.tagName === 'polygon' ? `${d}Z` : d;
    }
    default:
      return null;
  }
}

/** Remplace une forme élémentaire par un <path> équivalent (seul `d` se morphose). */
function asPath(el: SVGGeometryElement, d: string): SVGPathElement {
  if (el.tagName.toLowerCase() === 'path') return el as SVGPathElement;
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  for (const a of [...el.attributes]) if (!/^(cx|cy|r|rx|ry|x|y|width|height|points|x1|x2|y1|y2)$/.test(a.name)) p.setAttribute(a.name, a.value);
  p.setAttribute('d', d);
  el.replaceWith(p);
  return p;
}

function morphPlan(svg: SVGSVGElement, c: Ctx): Plan | null {
  const fl = addon('flubber');
  if (!fl) return null;
  const shapes = shapesOf(svg);
  if (!shapes.length || shapes.length > 16) return null;
  const box = svg.getBBox();
  const size = Math.max(box.width, box.height) || 1;
  const rootCenter = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2);
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(probe);
  const toRoot = (el: SVGGraphicsElement) => probe.getCTM()!.inverse().multiply(el.getCTM()!);
  const items: { el: SVGPathElement; interp: (t: number) => string }[] = [];
  try {
    for (const shape of shapes) {
      const d = toPathD(shape);
      if (!d) return null;
      const el = asPath(shape, d);
      const m = toRoot(el);
      const k = Math.hypot(m.a, m.b) || 1;
      const local = rootCenter.matrixTransform(m.inverse());
      items.push({ el, interp: fl.fromCircle(local.x, local.y, (size * 0.16) / k, d, { maxSegmentLength: size / k / 60 }) });
    }
  } catch {
    return null;
  }
  const texts = textsOf(svg);
  return {
    apply(lt) {
      const grow = c.back(progress(lt, 0, 0.45));
      const p = c.ease(progress(lt, 0.4, 1.1));
      svg.style.transform = `scale(${mix(0.2, 1, grow)})`;
      svg.style.opacity = String(clamp(grow * 3));
      for (const it of items) it.el.setAttribute('d', p >= 1 ? it.interp(1) : it.interp(p));
      const tp = c.ease(progress(lt, 1.25, 0.5));
      texts.forEach((el) => (el.style.opacity = String(tp)));
    },
  };
}

// ─── assemble ───────────────────────────────────────────────────────────────

function assemblePlan(svg: SVGSVGElement, c: Ctx): Plan | null {
  const els = [...shapesOf(svg), ...textsOf(svg)];
  if (els.length < 2 || els.length > 48) return null;
  const width = svg.getBoundingClientRect().width || 1;
  const groups = els.map((el, i) => {
    const g = wrap(el);
    const k = screenScale(g);
    const angle = hash(i * 7.31 + 1) * Math.PI * 2;
    const dist = ((0.35 + 0.45 * hash(i * 3.7 + 2)) * width) / k;
    return { g, dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, rot: (hash(i * 1.9 + 3) - 0.5) * 90 };
  });
  const gap = Math.min(0.12, 0.9 / groups.length);
  return {
    apply(lt) {
      groups.forEach((it, i) => {
        const p = c.back(progress(lt, 0.15 + i * gap, 1.1));
        const q = 1 - p;
        it.g.style.transform = `translate(${it.dx * q}px, ${it.dy * q}px) rotate(${it.rot * q}deg) scale(${mix(0.4, 1, p)})`;
        it.g.style.opacity = String(clamp(p * 2.2));
      });
    },
  };
}

// ─── wipe ───────────────────────────────────────────────────────────────────

function wipePlan(svg: SVGSVGElement, c: Ctx): Plan {
  return {
    apply(lt) {
      const p = c.ease(progress(lt, 0.1, 1.4));
      // Balayage oblique (12°) : la diagonale traverse le logo de gauche à droite.
      const x = mix(-25, 125, p);
      svg.style.clipPath = `polygon(0 0, ${x}% 0, ${x - 25}% 100%, 0 100%)`;
      svg.style.transform = `scale(${mix(1.06, 1, p)})`;
    },
  };
}

const PLANS: Record<string, (svg: SVGSVGElement, c: Ctx) => Plan | null> = {
  draw: drawPlan,
  trace: tracePlan,
  morph: morphPlan,
  assemble: assemblePlan,
  wipe: wipePlan,
};

export const SVG_LOGO_VARIANTS = Object.keys(PLANS);

/** Le logo vectoriel animé. `at` : début de l'animation (temps local de la scène). */
export function LogoMotion({ variant, at = 0, height, align = 'center', style }: { variant: string; at?: number; height: number; align?: 'center' | 'left'; style?: CSSProperties }) {
  const { data, ease, back } = useEngine();
  const lt = useLocalTime();
  const ref = useRef<HTMLDivElement>(null);
  const plan = useRef<Plan | null>(null);
  useLayoutEffect(() => {
    if (plan.current || !ref.current) return;
    const svg = ref.current.querySelector('svg');
    if (!svg) return;
    // Le logo remplit sa boîte (un logo large est limité par la largeur, un symbole par la hauteur).
    svg.setAttribute('preserveAspectRatio', align === 'left' ? 'xMinYMid meet' : 'xMidYMid meet');
    const c: Ctx = { ease, back, primary: data.palette.primary };
    try {
      plan.current = (PLANS[variant] || wipePlan)(svg, c) || wipePlan(svg, c);
    } catch (e) {
      console.error('logo motion', (e as Error).message);
      plan.current = wipePlan(svg, c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    plan.current?.apply(Math.max(0, lt - at));
  });
  // React 19 réécrit innerHTML dès que l'objet change : il doit rester le même d'une image à l'autre,
  // sinon les formes animées seraient remplacées par un logo neuf à chaque image.
  const html = useMemo(() => ({ __html: data.kit?.logoSvg || '' }), [data.kit?.logoSvg]);
  if (!data.kit?.logoSvg) return null;
  return <div ref={ref} className="kit-logo" style={{ height, ...style }} dangerouslySetInnerHTML={html} />;
}
