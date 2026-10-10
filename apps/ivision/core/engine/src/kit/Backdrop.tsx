/**
 * Fonds du kit (inspirés de Magic UI / React Bits, réécrits pour la vidéo) :
 * fonctions du temps, aux couleurs de la surface courante, jamais sombres par
 * défaut (politique de surface claire).
 *
 * Le graphe en choisit UN par vidéo et ne le pose que sur deux scènes au plus,
 * des scènes de texte : un fond sur toutes les scènes serait du « décor par
 * défaut » (anti-slop).
 */
import { CSSProperties, ReactElement, useLayoutEffect, useMemo, useRef } from 'react';
import { useEngine, useLocalTime, useScene } from '../context';
import { addon } from '../shared';
import { clamp, hash, mix, progress } from '../time';
import { FlowField, Sketch, SketchShape } from './Sketch';
import { VoronoiField } from './Viz';
import { Flat3D } from './Zdog';

/** Coin opposé au texte : le fond occupe l'espace que la composition laisse libre. */
function useFreeCorner(): { x: number; y: number } {
  const s = useScene();
  const a = s.motion.anchor;
  return {
    x: a.includes('left') || a === 'right' ? 100 : a.includes('center') || a === 'center' ? 85 : 0,
    y: a.startsWith('top') ? 100 : a.startsWith('bottom') ? 0 : 100,
  };
}

function DotGrid() {
  const { ease, u } = useEngine();
  const lt = useLocalTime();
  const c = useFreeCorner();
  const r = mix(0, 85, ease(progress(lt, 0, 1.4)));
  const mask = `radial-gradient(circle at ${c.x}% ${c.y}%, #000 ${r * 0.55}%, transparent ${r}%)`;
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(circle, var(--soft) ${u * 0.32}px, transparent ${u * 0.36}px)`,
        backgroundSize: `${u * 4}px ${u * 4}px`,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}

function Halftone() {
  const { ease, u } = useEngine();
  const lt = useLocalTime();
  const s = useScene();
  const c = useFreeCorner();
  const p = ease(progress(lt, 0, 1.1));
  const drift = (lt / Math.max(1, s.span)) * 2;
  const mask = `radial-gradient(circle at ${c.x}% ${c.y}%, #000 0%, transparent ${mix(10, 62, p)}%)`;
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(circle, var(--hl-soft) 0, var(--hl-soft) ${u * 0.55}px, transparent ${u * 0.6}px)`,
        backgroundSize: `${u * 1.6}px ${u * 1.6}px`,
        backgroundPosition: `${drift * u}px ${drift * u}px`,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}

const SHAPES = ['circle', 'square', 'ring', 'triangle', 'pill', 'circle', 'square'] as const;

function ShapeField() {
  const { back, u } = useEngine();
  const lt = useLocalTime();
  const s = useScene();
  const c = useFreeCorner();
  const seed = s.index * 13.7;
  return (
    <div className="absolute inset-0">
      {SHAPES.map((shape, i) => {
        // Les formes se groupent du côté libre ; dérive lente, rotation propre à chacune.
        const x = clamp(mix(c.x > 50 ? 52 : 2, c.x > 50 ? 92 : 42, hash(seed + i)), 0, 94);
        const y = clamp(mix(c.y > 50 ? 55 : 4, c.y > 50 ? 92 : 40, hash(seed + i * 3.1)), 0, 94);
        const size = mix(7, 16, hash(seed + i * 7.3)) * u;
        const p = back(progress(lt, 0.08 * i, 0.7));
        const rot = (hash(seed + i * 5.9) - 0.5) * 60 + lt * (hash(seed + i) - 0.5) * 30;
        const dy = Math.sin(lt * 0.9 + i) * u * 0.8;
        const color = i % 3 === 0 ? 'var(--hl)' : 'var(--hl-soft)';
        const base: CSSProperties = {
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: shape === 'pill' ? size * 0.45 : size,
          transform: `translateY(${dy}px) rotate(${rot}deg) scale(${p})`,
          opacity: clamp(p) * (i % 3 === 0 ? 0.9 : 0.75),
        };
        if (shape === 'triangle') return <span key={i} style={{ ...base, background: color, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />;
        if (shape === 'ring') return <span key={i} style={{ ...base, borderRadius: '50%', border: `${size * 0.16}px solid ${color}` }} />;
        return <span key={i} style={{ ...base, background: color, borderRadius: shape === 'square' ? size * 0.12 : 999 }} />;
      })}
    </div>
  );
}

/** Grille en vague depuis le centre (anime.js : stagger en grille), repli pur si l'addon manque. */
function StaggerGrid() {
  const { horizontal, u } = useEngine();
  const lt = useLocalTime();
  const cols = horizontal ? 16 : 9;
  const rows = horizontal ? 9 : 16;
  const ref = useRef<HTMLDivElement>(null);
  const tl = useRef<any>(null);
  const anime = addon('anime');
  useLayoutEffect(() => {
    if (!anime || !ref.current || tl.current) return;
    const cells = ref.current.querySelectorAll('span');
    tl.current = anime
      .createTimeline({ autoplay: false })
      .add(cells, { scale: [0, 1], opacity: [0, 1], duration: 520, ease: 'outQuad', delay: anime.stagger(28, { grid: [cols, rows], from: 'center' }) })
      .add(cells, { scale: [1, 0.55], duration: 900, ease: 'inOutSine', delay: anime.stagger(22, { grid: [cols, rows], from: 'center' }) });
  });
  useLayoutEffect(() => {
    // Posée dans les bornes de la timeline : au-delà, la vague reste sur sa dernière image.
    if (tl.current) tl.current.seek(Math.min(lt * 1000, Math.max(0, tl.current.duration - 1)));
  });
  const cells = useMemo(() => Array.from({ length: cols * rows }, (_, i) => i), [cols, rows]);
  return (
    <div ref={ref} className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, opacity: 0.35 }}>
      {cells.map((i) => {
        // Sans anime.js : même vague, calculée ici.
        let style: CSSProperties = {};
        if (!anime) {
          const cx = (i % cols) - (cols - 1) / 2;
          const cy = Math.floor(i / cols) - (rows - 1) / 2;
          const p = clamp(progress(lt, Math.hypot(cx, cy) * 0.03, 0.5));
          style = { transform: `scale(${p})`, opacity: p };
        }
        return <span key={i} className="m-auto rounded-pill bg-hl" style={{ width: u * 1.3, height: u * 1.3, ...style }} />;
      })}
    </div>
  );
}

function Marquee() {
  const { data, u } = useEngine();
  const lt = useLocalTime();
  const word = data.brandName.toUpperCase();
  const row = (dir: 1 | -1, top: string) => (
    <div className="absolute left-0 whitespace-nowrap font-display" style={{ top, transform: `translateX(${dir * -lt * u * 6 - (dir < 0 ? u * 40 : 0)}px)`, fontSize: u * 22, fontWeight: 900, lineHeight: 1, color: 'transparent', WebkitTextStroke: `${Math.max(1.5, u * 0.22)}px var(--soft)` }}>
      {Array.from({ length: 6 }, () => word).join('  ·  ')}
    </div>
  );
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.9 }}>
      {row(1, '6%')}
      {row(-1, '68%')}
    </div>
  );
}

function Spotlight() {
  const { ease } = useEngine();
  const lt = useLocalTime();
  const s = useScene();
  const p = ease(progress(lt, 0, 1.2));
  const k = lt / Math.max(1, s.span);
  const x = mix(20, 78, k);
  const y = mix(30, 60, Math.sin(k * Math.PI));
  return <div className="absolute inset-0" style={{ opacity: p, background: `radial-gradient(ellipse 55% 45% at ${x}% ${y}%, var(--hl-soft), transparent 70%)` }} />;
}

/** Graduations de règle sur deux bords : précision, mesure. */
function Ticks() {
  const { ease, u } = useEngine();
  const lt = useLocalTime();
  const p = ease(progress(lt, 0.1, 1.2));
  const n = 40;
  const ticks = (axis: 'x' | 'y') =>
    Array.from({ length: n + 1 }, (_, i) => {
      const long = i % 5 === 0;
      const len = (long ? 2.4 : 1.2) * u;
      const pos = `${(i / n) * 100}%`;
      const style: CSSProperties =
        axis === 'x'
          ? { left: pos, bottom: u * 2, width: Math.max(1, u * 0.12), height: len }
          : { top: pos, left: u * 2, height: Math.max(1, u * 0.12), width: len };
      return <span key={`${axis}${i}`} className="absolute bg-ink" style={{ ...style, opacity: long ? 0.55 : 0.3 }} />;
    });
  return (
    <div className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>
      {ticks('x')}
      {ticks('y')}
    </div>
  );
}

/** Masque radial qui découvre le fond depuis le coin libre (l'espace que le texte laisse). */
function useCornerMask(spread = 85, dur = 1.4): CSSProperties {
  const { ease } = useEngine();
  const lt = useLocalTime();
  const c = useFreeCorner();
  const r = mix(0, spread, ease(progress(lt, 0, dur)));
  const mask = `radial-gradient(circle at ${c.x}% ${c.y}%, #000 ${r * 0.5}%, transparent ${r}%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/** Lignes de flux dans un champ de bruit simplex, du côté libre (addon draw). */
function FlowFieldBg() {
  const mask = useCornerMask(95, 1.6);
  return (
    <div className="absolute inset-0" style={mask}>
      <FlowField lines={38} steps={24} seed={11} opacity={0.4} />
    </div>
  );
}

/** Formes de la marque tracées à la main (rough.js), qui se dessinent l'une après l'autre. */
function SketchShapesBg() {
  const { ease } = useEngine();
  const lt = useLocalTime();
  const c = useFreeCorner();
  const cx = c.x > 50 ? 78 : 22;
  const cy = c.y > 50 ? 76 : 24;
  const shapes: { draw: SketchShape; color: string }[] = [
    { draw: { shape: 'circle', cx, cy, d: 26 }, color: 'var(--hl)' },
    { draw: { shape: 'rectangle', x: cx - 16, y: cy - 6, w: 20, h: 20 }, color: 'var(--c-primary)' },
    { draw: { shape: 'line', x1: cx - 22, y1: cy + 16, x2: cx + 14, y2: cy + 8 }, color: 'var(--ink)' },
    { draw: { shape: 'arc', cx: cx + 6, cy: cy - 14, w: 18, h: 18, start: Math.PI, stop: Math.PI * 1.9 }, color: 'var(--c-accent)' },
  ];
  return (
    <div className="absolute inset-0" style={{ opacity: 0.55 }}>
      {shapes.map((sh, i) => (
        <Sketch key={i} draw={sh.draw} color={sh.color} p={ease(progress(lt, 0.15 + i * 0.25, 0.9))} weight={0.35} roughness={1.4} seed={13 + i} preserve="xMidYMid meet" />
      ))}
    </div>
  );
}

/** Mosaïque de Voronoï aux couleurs de la charte, du côté libre (addon viz). */
function VoronoiBg() {
  const mask = useCornerMask(80, 1.5);
  return (
    <div className="absolute inset-0" style={mask}>
      <VoronoiField cells={24} seed={9} opacity={0.28} />
    </div>
  );
}

/** Objets plats en pseudo-3D (Zdog) qui tournent lentement du côté libre. */
function Flat3DBg() {
  const lt = useLocalTime();
  const c = useFreeCorner();
  const pos: CSSProperties = { position: 'absolute', width: '42%', height: '42%', left: c.x > 50 ? '56%' : '2%', top: c.y > 50 ? '56%' : '2%', opacity: clamp(lt / 0.8) * 0.85 };
  return (
    <div style={pos}>
      <Flat3D
        rotate={{ x: -0.35 + Math.sin(lt * 0.4) * 0.08, y: lt * 0.45 }}
        items={[
          { kind: 'box', width: 22, height: 22, depth: 22, color: 'var(--hl)', shade: 'var(--c-primary)', x: -14, y: 6 },
          { kind: 'ring', diameter: 30, stroke: 3, color: 'var(--c-accent)', x: 14, y: -10, rotate: { x: Math.PI / 2.4 } },
          { kind: 'sphere', diameter: 12, color: 'var(--c-secondary)', x: 18, y: 16 },
        ]}
      />
    </div>
  );
}

const BACKDROPS: Record<string, () => ReactElement> = {
  'flow-field': FlowFieldBg,
  'sketch-shapes': SketchShapesBg,
  voronoi: VoronoiBg,
  flat3d: Flat3DBg,
  'dot-grid': DotGrid,
  halftone: Halftone,
  'shape-field': ShapeField,
  'stagger-grid': StaggerGrid,
  marquee: Marquee,
  spotlight: Spotlight,
  ticks: Ticks,
};

/** Le fond de la scène, si le graphe l'a posé sur elle. */
export function Backdrop() {
  const { data } = useEngine();
  const s = useScene();
  const id = data.kit?.background;
  if (!s.backdrop || !id || id === 'none') return null;
  const B = BACKDROPS[id];
  return B ? (
    <div className="kit-backdrop pointer-events-none absolute inset-0" aria-hidden>
      <B />
    </div>
  ) : null;
}
