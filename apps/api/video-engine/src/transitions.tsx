/**
 * TRANSITIONS — dix façons de passer d'une scène à l'autre, chacune calculée
 * comme une fonction du temps.
 *
 *  cut          coupe franche, sur le temps (rythme, impact)
 *  flashCut     coupe franche + éclair de la couleur d'accent
 *  dissolve     fondu enchaîné (le cinéma, l'élégance)
 *  wipe         volet net, bord dans la couleur d'accent
 *  push         la scène suivante pousse la précédente
 *  zoomThrough  on traverse l'image (« infinite zoom »)
 *  whip         panoramique filé : flou de mouvement directionnel
 *  iris         raccord graphique : la scène suivante s'ouvre depuis le point
 *               focal de la précédente (là où était son texte)
 *  blockStack   bandes de couleur qui balayent et recouvrent
 *  slideOver    la nouvelle scène glisse par-dessus l'ancienne, qui s'efface
 *
 * Sortie à gauche + entrée à droite se lit comme une progression : les
 * transitions directionnelles suivent cette convention.
 */
import { CSSProperties, ReactNode } from 'react';
import { cue } from './cues';
import { Engine, Timed } from './context';
import { clamp, progress } from './time';

export const COVER = new Set(['wipe', 'blockStack', 'flashCut']);
export const HARD = new Set(['cut', 'flashCut']);

/** Fenêtres de visibilité et d'entrée de chaque scène, selon ses transitions. */
export function timeline(scenes: Omit<Timed, 'index' | 'end' | 'visFrom' | 'visTo' | 'tin' | 'tout' | 'span'>[], tr: number, duration: number): Timed[] {
  const out = scenes.map((s, i) => {
    const kind = s.motion.transition || 'cut';
    const overlap = i > 0 && !HARD.has(kind) && !COVER.has(kind);
    const visFrom = i === 0 ? 0 : overlap ? s.start - tr * 0.5 : s.start;
    const settle = i === 0 ? 0.12 : HARD.has(kind) ? 0.06 : COVER.has(kind) ? tr * 0.35 : tr * 0.2;
    return { ...s, index: i, end: s.start + s.duration, visFrom, tin: s.start + settle, visTo: 0, tout: null as number | null, span: 0 };
  });
  out.forEach((s, i) => {
    const next = out[i + 1];
    const nk = next?.motion.transition || 'cut';
    s.visTo = !next ? duration + 1 : HARD.has(nk) || COVER.has(nk) ? next.start : next.start + tr * 0.5;
    s.span = s.visTo - s.visFrom;
    // Une coupe ou un fondu ne cachent rien : les éléments sortent eux-mêmes,
    // en deux tiers de leur durée d'entrée, juste avant.
    if (next && (HARD.has(nk) || nk === 'dissolve')) s.tout = next.start - tr * 0.45;
  });
  return out;
}

/** Point focal (en % du cadre) d'un ancrage : centre de l'iris suivant. */
function focal(anchor: string): [number, number] {
  const map: Record<string, [number, number]> = {
    'top-left': [28, 28],
    'center-left': [30, 50],
    'bottom-left': [30, 72],
    center: [50, 50],
    'bottom-center': [50, 72],
    'top-center': [50, 28],
    right: [66, 50],
  };
  return map[anchor] || [50, 50];
}

/** Style de la scène i à l'instant t (sa transition d'entrée ET celle de sortie). */
export function sceneStyle(e: Engine, s: Timed): CSSProperties {
  const { t, data, ease } = e;
  const tr = data.direction.pacing.transition;
  const style: CSSProperties = {};
  const transforms: string[] = [];
  const filters: string[] = [];
  const axis = e.horizontal ? 'X' : 'Y';

  // Entrée.
  const kind = s.motion.transition;
  if (s.index > 0 && kind) {
    const c = s.start;
    const prev = e.scenes[s.index - 1];
    const p = ease(progress(t, c - tr * 0.5, tr));
    switch (kind) {
      case 'dissolve':
        style.opacity = p;
        break;
      case 'push':
        transforms.push(`translate${axis}(${(1 - p) * 100}%)`);
        break;
      case 'zoomThrough': {
        const q = ease(progress(t, c - tr * 0.25, tr * 0.75));
        style.opacity = q;
        transforms.push(`scale(${1.25 - 0.25 * q})`);
        if (q < 1) filters.push(`blur(${(1 - q) * 10}px)`);
        break;
      }
      case 'whip': {
        const q = ease(progress(t, c - tr * 0.2, tr * 0.55));
        transforms.push(`translateX(${(1 - q) * 45}%) skewX(${(1 - q) * -8}deg)`);
        if (q < 1) filters.push(`blur(${(1 - q) * 22}px)`);
        break;
      }
      case 'iris': {
        const [x, y] = focal(prev?.motion.anchor || 'center');
        style.clipPath = `circle(${p * 150}% at ${x}% ${y}%)`;
        break;
      }
      case 'slideOver':
        transforms.push(`translateY(${(1 - p) * 100}%)`);
        style.boxShadow = '0 -2vmin 6vmin rgba(0,0,0,0.18)';
        break;
      default:
        break;
    }
  }

  // Sortie (préparée par la scène suivante).
  const next = e.scenes[s.index + 1];
  if (next?.motion.transition) {
    const c = next.start;
    const p = ease(progress(t, c - tr * 0.5, tr));
    switch (next.motion.transition) {
      case 'push':
        transforms.push(`translate${axis}(${-p * 100}%)`);
        break;
      case 'zoomThrough': {
        const q = clamp(progress(t, c - tr * 0.5, tr * 0.75));
        transforms.push(`scale(${1 + 0.6 * q * q})`);
        style.opacity = (style.opacity ?? 1) as number * (1 - q);
        break;
      }
      case 'whip': {
        const q = e.easeIn(progress(t, c - tr * 0.45, tr * 0.45));
        transforms.push(`translateX(${-q * 45}%) skewX(${q * 8}deg)`);
        if (q > 0) filters.push(`blur(${q * 22}px)`);
        break;
      }
      case 'slideOver': {
        const dim = clamp(p) * 0.25;
        filters.push(`brightness(${1 - dim})`);
        break;
      }
      default:
        break;
    }
  }

  if (transforms.length) style.transform = transforms.join(' ');
  if (filters.length) style.filter = filters.join(' ');
  return style;
}

/** Calques de transition (bandes, éclair) posés au-dessus des scènes. */
export function TransitionLayers({ e }: { e: Engine }): ReactNode {
  const { t, data, ease, easeIn } = e;
  const tr = data.direction.pacing.transition;
  const layers: ReactNode[] = [];
  e.scenes.forEach((s, i) => {
    const kind = s.motion.transition;
    if (i === 0 || !kind) return;
    const c = s.start;
    const sf = data.surfaces[s.surface] || data.surfaces.light;
    // Le son de la transition.
    if (kind === 'cut') {
      if (i % 2 === 0) cue(`tr:${s.key}`, c - 0.02, 'click', 0.5);
    } else if (kind === 'flashCut') cue(`tr:${s.key}`, c - 0.04, 'impact', 0.7);
    else if (kind === 'dissolve' || kind === 'iris') cue(`tr:${s.key}`, c - tr * 0.5, 'softwhoosh', 0.7);
    else cue(`tr:${s.key}`, c - tr * 0.5, 'whoosh');

    if (t < c - tr || t > c + tr) return;
    const axis = e.horizontal ? 'X' : 'Y';
    if (kind === 'wipe') {
      const p = ease(progress(t, c - tr * 0.5, tr * 0.5));
      const q = easeIn(progress(t, c, tr * 0.5));
      const pos = t < c ? (1 - p) * -100 : q * 100;
      layers.push(<div key={`w${i}`} className="tr-layer" style={{ background: sf.bg, transform: `translate${axis}(${pos}%)` }}><span className="tr-edge" style={{ background: sf.hl }} /></div>);
    }
    if (kind === 'blockStack') {
      const colors = [sf.hl, data.surfaces.secondary?.bg || sf.hl, sf.bg];
      colors.forEach((col, k) => {
        const p = ease(progress(t, c - tr * 0.55 + k * 0.06, tr * 0.45));
        const q = easeIn(progress(t, c + k * 0.05, tr * 0.45));
        const pos = t < c + k * 0.05 ? (1 - p) * -101 : q * 101;
        layers.push(<div key={`b${i}${k}`} className="tr-layer" style={{ background: col, transform: `translate${axis}(${pos}%)` }} />);
      });
    }
    if (kind === 'flashCut') {
      const o = t < c ? clamp(progress(t, c - 0.08, 0.08)) : 1 - clamp(progress(t, c, 0.16));
      if (o > 0) layers.push(<div key={`f${i}`} className="tr-layer" style={{ background: sf.hl, opacity: o * 0.9 }} />);
    }
  });
  return <>{layers}</>;
}
